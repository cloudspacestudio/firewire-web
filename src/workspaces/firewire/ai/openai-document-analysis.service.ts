import Ajv, { ValidateFunction } from 'ajv'
import OpenAI, { APIError, toFile } from 'openai'

import { documentInspectionJsonSchema } from './document-analysis.schema'
import {
    DocumentAnalysisProgress,
    DocumentAnalysisBomProposal,
    DocumentAnalysisProjectContext,
    DocumentAnalysisProjectDetailProposal,
    DocumentAnalysisProjectField,
    DocumentInspectionResult
} from './document-analysis.types'

export const OPENAI_DOCUMENT_INPUT_MAX_BYTES = (50 * 1024 * 1024) - 1

const SUPPORTED_DOCUMENT_EXTENSIONS = new Set([
    'csv', 'doc', 'docx', 'md', 'pdf', 'ppt', 'pptx', 'tsv', 'txt', 'xls', 'xlsx'
])

export interface InspectDocumentInput {
    buffer: Buffer
    filename: string
    mimeType: string
    projectId: string
    documentId: string
    versionId: string
    projectContext: DocumentAnalysisProjectContext
    onProgress?: (progress: Omit<DocumentAnalysisProgress, 'updatedAt'>) => void | Promise<void>
    signal?: AbortSignal
}

export interface InspectDocumentOutput {
    result: DocumentInspectionResult
    model: string
    openAiFileId: string
    openAiFileDeletedAt: string
    openAiResponseId: string
    openAiRequestId: string
}

export class DocumentAnalysisConfigurationError extends Error {}

export class DocumentAnalysisProviderError extends Error {
    constructor(
        message: string,
        readonly statusCode: number,
        readonly code: string,
        readonly retryable: boolean
    ) {
        super(message)
    }
}

export class DocumentAnalysisInputError extends Error {
    constructor(message: string, readonly statusCode: number) {
        super(message)
    }
}

export class OpenAiDocumentAnalysisService {
    private readonly apiKey = String(process.env.OPENAI_API_KEY || '').trim()
    private readonly model = String(process.env.OPENAI_MODEL || '').trim()
    private readonly validateResult: ValidateFunction

    constructor() {
        this.validateResult = new Ajv({ allErrors: true, strict: false }).compile(documentInspectionJsonSchema)
    }

    getConfiguredModel(): string {
        return this.model
    }

    async inspectDocument(input: InspectDocumentInput): Promise<InspectDocumentOutput> {
        this.validateConfiguration()
        this.validateInput(input)

        const client = new OpenAI({
            apiKey: this.apiKey,
            timeout: Number(process.env.OPENAI_TIMEOUT_MS || 180000)
        })
        let openAiFileId = ''
        let openAiFileDeletedAt = ''
        let inspectionResult: DocumentInspectionResult | null = null
        let openAiResponseId = ''
        let openAiRequestId = ''

        try {
            await this.reportProgress(input, 'uploading', 'Uploading the document to OpenAI.', 35)
            const uploadedFile = await client.files.create({
                file: await toFile(input.buffer, input.filename, { type: input.mimeType || 'application/octet-stream' }),
                purpose: 'user_data',
                expires_after: {
                    anchor: 'created_at',
                    seconds: 24 * 60 * 60
                }
            }, { signal: input.signal })
            openAiFileId = uploadedFile.id
            await this.reportProgress(input, 'uploaded', 'Document uploaded. Starting structured analysis.', 50)

            await this.reportProgress(input, 'analyzing', 'OpenAI is reading the document and extracting grounded findings.', 60)
            const response = await this.withAnalysisHeartbeat(input, () => client.responses.create({
                model: this.model,
                store: false,
                instructions: this.getSystemInstructions(input.filename),
                input: [{
                    role: 'user',
                    content: [
                        { type: 'input_file', file_id: uploadedFile.id, detail: 'auto' },
                        {
                            type: 'input_text',
                            text: [
                                'Inspect this document and compare supported project details with the current Firewire project context below.',
                                'Return only the schema-constrained document inspection result.',
                                'CURRENT_FIREWIRE_PROJECT_CONTEXT',
                                JSON.stringify(input.projectContext),
                                'END_CURRENT_FIREWIRE_PROJECT_CONTEXT'
                            ].join('\n')
                        }
                    ]
                }],
                max_output_tokens: 12000,
                metadata: {
                    firewire_project_id: input.projectId,
                    firewire_document_id: input.documentId,
                    firewire_version_id: input.versionId
                },
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'firewire_document_inspection',
                        description: 'Grounded findings from one Firewire project document.',
                        strict: true,
                        schema: documentInspectionJsonSchema
                    }
                }
            }, { signal: input.signal }))

            if (!response.output_text) {
                throw new Error('OpenAI returned no document inspection output.')
            }

            await this.reportProgress(input, 'validating', 'Analysis received. Validating the structured findings.', 85)
            const parsed = JSON.parse(response.output_text) as DocumentInspectionResult
            if (!this.validateResult(parsed)) {
                const details = this.validateResult.errors
                    ?.map((error) => `${error.instancePath || '/'} ${error.message || 'is invalid'}`)
                    .join('; ')
                throw new Error(`OpenAI document inspection failed application schema validation: ${details || 'unknown validation error'}`)
            }

            inspectionResult = this.normalizeProjectActions(parsed, input.projectContext)
            openAiResponseId = response.id
            openAiRequestId = String((response as any)._request_id || '')
            await this.reportProgress(input, 'finalizing', 'Structured findings validated. Finalizing the inspection.', 95)
        } catch (error) {
            throw this.toProviderError(error)
        } finally {
            if (openAiFileId) {
                try {
                    await client.files.delete(openAiFileId)
                    openAiFileDeletedAt = new Date().toISOString()
                } catch (cleanupError) {
                    console.error('OpenAI temporary document cleanup failed.', {
                        fileId: openAiFileId,
                        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError || '')
                    })
                }
            }
        }

        if (!inspectionResult) {
            throw new Error('OpenAI returned no valid document inspection result.')
        }

        return {
            result: inspectionResult,
            model: this.model,
            openAiFileId,
            openAiFileDeletedAt,
            openAiResponseId,
            openAiRequestId
        }
    }

    private async reportProgress(
        input: InspectDocumentInput,
        stage: string,
        message: string,
        percent: number
    ): Promise<void> {
        if (!input.onProgress) {
            return
        }
        try {
            await input.onProgress({ stage, message, percent })
        } catch (error) {
            console.error('Document inspection progress update failed.', {
                projectId: input.projectId,
                documentId: input.documentId,
                versionId: input.versionId,
                stage,
                message: error instanceof Error ? error.message : String(error || '')
            })
        }
    }

    private normalizeProjectActions(
        result: DocumentInspectionResult,
        context: DocumentAnalysisProjectContext
    ): DocumentInspectionResult {
        const seen = new Set<DocumentAnalysisProjectField>()
        const proposedActions = (result.proposedActions || []).reduce<DocumentAnalysisProjectDetailProposal[]>((actions, proposal) => {
            if (seen.has(proposal.targetField)) {
                return actions
            }
            seen.add(proposal.targetField)
            const currentValue = this.getProjectContextValue(context, proposal.targetField)
            const proposedValue = String(proposal.proposedValue || '').trim()
            if (!proposedValue || this.projectValuesEqual(proposal.targetField, proposal.valueType, currentValue, proposedValue)) {
                return actions
            }
            actions.push({ ...proposal, currentValue, proposedValue })
            return actions
        }, [])
        return {
            ...result,
            proposedActions,
            proposedBomActions: this.normalizeBomProposals(result.proposedBomActions || [])
        }
    }

    private normalizeBomProposals(proposals: DocumentAnalysisBomProposal[]): DocumentAnalysisBomProposal[] {
        const normalized: DocumentAnalysisBomProposal[] = []
        for (const proposal of proposals) {
            const scheduleQuantity = Math.max(0, Math.floor(Number(proposal.scheduleQuantity || 0)))
            const drawingQuantity = Math.max(0, Math.floor(Number(proposal.drawingQuantity || 0)))
            const scheduleQuantityFound = !!proposal.scheduleQuantityFound && scheduleQuantity > 0
            const drawingQuantityFound = !!proposal.drawingQuantityFound && drawingQuantity > 0
            let quantityStatus: DocumentAnalysisBomProposal['quantityStatus'] = 'UNKNOWN'
            let reconciledQuantity = 0
            if (scheduleQuantityFound && drawingQuantityFound) {
                if (scheduleQuantity === drawingQuantity) {
                    quantityStatus = 'MATCHED'
                    reconciledQuantity = scheduleQuantity
                } else {
                    quantityStatus = 'CONFLICT'
                }
            } else if (scheduleQuantityFound) {
                quantityStatus = 'SCHEDULE_ONLY'
                reconciledQuantity = scheduleQuantity
            } else if (drawingQuantityFound) {
                quantityStatus = 'DRAWING_ONLY'
                reconciledQuantity = drawingQuantity
            }
            const identity = [
                proposal.partNumber,
                proposal.modelNumber,
                proposal.symbolLabel,
                proposal.deviceType
            ].map((value) => this.normalizeMatchText(value)).filter(Boolean).join('|')
            if (!identity || quantityStatus === 'UNKNOWN') {
                continue
            }
            const floorplanPlacementTarget = proposal.floorplanSymbolFound && reconciledQuantity > 0
                ? reconciledQuantity
                : 0
            normalized.push({
                ...proposal,
                proposalId: `bom-proposal-${normalized.length + 1}`,
                scheduleQuantityFound,
                scheduleQuantity,
                drawingQuantityFound,
                drawingQuantity,
                quantityStatus,
                reconciledQuantity,
                floorplanSymbolFound: !!proposal.floorplanSymbolFound,
                floorplanPlacementTarget,
                catalogMatch: {
                    status: 'NOT_EVALUATED',
                    entityType: 'NONE',
                    deviceId: '',
                    deviceName: '',
                    partId: '',
                    partNumber: '',
                    vendorName: '',
                    confidence: 0,
                    rationale: 'Firewire catalog matching has not been performed.'
                }
            })
        }
        return normalized
    }

    private normalizeMatchText(value: unknown): string {
        return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    }

    private getProjectContextValue(context: DocumentAnalysisProjectContext, targetField: DocumentAnalysisProjectField): string {
        if (targetField.startsWith('customerInfo.')) {
            const customerField = targetField.slice('customerInfo.'.length) as keyof DocumentAnalysisProjectContext['customerInfo']
            return String(context.customerInfo[customerField] || '')
        }
        return String(context[targetField as keyof Omit<DocumentAnalysisProjectContext, 'customerInfo'>] ?? '')
    }

    private projectValuesEqual(targetField: string, valueType: string, left: string, right: string): boolean {
        if (valueType === 'NUMBER') {
            const leftNumber = Number(String(left || '').replace(/,/g, '').trim())
            const rightNumber = Number(String(right || '').replace(/,/g, '').trim())
            return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && leftNumber === rightNumber
        }
        if (valueType === 'DATE') {
            const leftTime = Date.parse(left)
            const rightTime = Date.parse(right)
            return Number.isFinite(leftTime) && Number.isFinite(rightTime) && leftTime === rightTime
        }
        if (targetField === 'address' || targetField === 'customerInfo.billingAddress') {
            return this.normalizeAddressForComparison(left) === this.normalizeAddressForComparison(right)
        }
        return String(left || '').trim().toLocaleLowerCase() === String(right || '').trim().toLocaleLowerCase()
    }

    private normalizeAddressForComparison(value: unknown): string {
        const aliases: Record<string, string> = {
            avenue: 'ave', boulevard: 'blvd', drive: 'dr', east: 'e', highway: 'hwy',
            lane: 'ln', north: 'n', oklahoma: 'ok', road: 'rd', south: 's',
            street: 'st', suite: 'ste', west: 'w'
        }
        return String(value || '')
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .split(' ')
            .filter(Boolean)
            .map((token) => aliases[token] || token)
            .join(' ')
    }

    private async withAnalysisHeartbeat<T>(input: InspectDocumentInput, work: () => Promise<T>): Promise<T> {
        const startedAt = Date.now()
        const heartbeat = setInterval(() => {
            console.info('[document-inspection] OpenAI analysis is still in progress.', {
                projectId: input.projectId,
                documentId: input.documentId,
                versionId: input.versionId,
                elapsedSeconds: Math.round((Date.now() - startedAt) / 1000)
            })
        }, 15000)
        heartbeat.unref?.()
        try {
            return await work()
        } finally {
            clearInterval(heartbeat)
        }
    }

    private toProviderError(error: unknown): unknown {
        if (!(error instanceof APIError)) {
            return error
        }

        const providerMessage = String(error.message || '').toLowerCase()
        const providerCode = String(error.code || '').toLowerCase()
        const providerType = String(error.type || '').toLowerCase()
        const quotaExceeded = error.status === 429 && (
            providerCode === 'insufficient_quota'
            || providerType === 'insufficient_quota'
            || providerMessage.includes('no credits remaining')
            || providerMessage.includes('quota')
        )
        if (quotaExceeded) {
            return new DocumentAnalysisProviderError(
                'OpenAI API credits are exhausted. Add credits in OpenAI Platform billing, then try the inspection again.',
                429,
                'OPENAI_QUOTA_EXCEEDED',
                false
            )
        }
        if (error.status === 429) {
            return new DocumentAnalysisProviderError(
                'OpenAI is temporarily rate-limiting document inspection. Wait briefly, then try again.',
                429,
                'OPENAI_RATE_LIMITED',
                true
            )
        }
        if (error.status === 401 || error.status === 403) {
            return new DocumentAnalysisProviderError(
                'OpenAI rejected the server credentials. Verify the API key and project access.',
                503,
                'OPENAI_AUTHENTICATION_FAILED',
                false
            )
        }

        return new DocumentAnalysisProviderError(
            'OpenAI could not complete the document inspection. Try again later.',
            error.status && error.status >= 500 ? 502 : 500,
            'OPENAI_REQUEST_FAILED',
            error.status === undefined || error.status === 408 || error.status === 409 || error.status === 429 || error.status >= 500
        )
    }

    private validateConfiguration(): void {
        if (!this.apiKey || !this.model) {
            throw new DocumentAnalysisConfigurationError(
                'Document inspection is not configured. Set OPENAI_API_KEY and OPENAI_MODEL on the server.'
            )
        }
    }

    private validateInput(input: InspectDocumentInput): void {
        if (!input.buffer.length) {
            throw new DocumentAnalysisInputError('The selected document has no content.', 400)
        }
        if (input.buffer.length > OPENAI_DOCUMENT_INPUT_MAX_BYTES) {
            throw new DocumentAnalysisInputError(
                'The selected document is too large for direct inspection. OpenAI file inputs must be under 50 MB.',
                413
            )
        }

        const extension = input.filename.includes('.')
            ? input.filename.split('.').pop()?.toLowerCase() || ''
            : ''
        if (!SUPPORTED_DOCUMENT_EXTENSIONS.has(extension)) {
            throw new DocumentAnalysisInputError(
                `.${extension || 'unknown'} files are not supported by the initial document inspection workflow.`,
                415
            )
        }
    }

    private getSystemInstructions(filename: string): string {
        return [
            'You inspect construction documents for fire alarm, fire sprinkler, and electronic security projects.',
            `The source filename is ${JSON.stringify(filename)}. Use that exact filename in every source object.`,
            'Never invent a project fact or requirement. Use empty strings and empty arrays when information is not found.',
            'Distinguish DOCUMENT_FACT, AI_INTERPRETATION, ASSUMPTION, and UNRESOLVED_QUESTION exactly as defined by the schema.',
            'For every material finding, provide the page, section, or location when available. Do not fabricate a location.',
            'A blank source field means that location information was not available.',
            'Do not silently resolve conflicts or infer document precedence.',
            'Treat revisions and addenda as potentially superseding earlier requirements, but do not perform project-wide reconciliation in this pass.',
            'Do not declare which fire, building, electrical, life-safety, or related code legally applies from general knowledge.',
            'Use DOCUMENT-STATED only when the document explicitly names the code or standard.',
            'Use POTENTIALLY-APPLICABLE only for an AI interpretation and set verificationRequired to true.',
            'Never use JURISDICTION-VERIFIED in this document-only pass because no authoritative jurisdiction lookup is being performed.',
            'Prefer explicit uncertainty and unresolved questions over unsupported certainty.',
            'proposedActions is a review-only list of potential Firewire project-detail updates; it must never claim that an update was applied.',
            'Only propose UPDATE_PROJECT_DETAIL when the document supports a non-empty value and that value materially differs from the supplied current project value.',
            'Use only the targetField values defined by the schema. Return at most one proposal per targetField.',
            'Copy currentValue from the supplied project context and normalize proposedValue as plain text. Use digits only for NUMBER values when possible and ISO YYYY-MM-DD for DATE values when the complete date is known.',
            'Project type must be exactly Fire Alarm, Sprinkler, or Security. Only propose it when the document discipline clearly supports one of those values.',
            'Do not propose salesman, project status, difficulty, coordinates, code applicability, or any field that is not in the schema.',
            'A project-detail proposal must preserve evidenceType, confidence, rationale, and source provenance. Prefer DOCUMENT_FACT; make interpretations visibly AI_INTERPRETATION.',
            'proposedBomActions extracts device candidates and quantities for later human review. Do not claim a BOM row was created.',
            'Create a BOM proposal only when the document provides a positive schedule quantity, a positive drawing symbol count, or both. Do not guess quantities.',
            'Return at most one BOM proposal per unique device/equipment identity. Use whole-document totals when the same device appears on multiple plan pages.',
            'Keep scheduleQuantity and drawingQuantity as separate evidence. Set the corresponding Found boolean false and quantity 0 when that evidence was not located.',
            'drawingQuantity counts actual device-symbol placements in plan areas. Exclude symbols shown only in legends, schedules, details, examples, or title blocks.',
            'If schedule and drawing quantities disagree, use CONFLICT and reconciledQuantity 0. Never silently choose one count.',
            'If both quantities agree, use MATCHED. If only one exists, use SCHEDULE_ONLY or DRAWING_ONLY. The server will validate this reconciliation again.',
            'floorplanSymbolFound means the document contains a floorplan symbol or legend mark for this device. floorplanPlacementTarget may equal reconciledQuantity only when a symbol was found and there is no quantity conflict.',
            'Use empty proposalId and a NOT_EVALUATED catalogMatch with entityType NONE and blank match fields; Firewire will assign proposal identity and perform catalog matching after extraction.',
            'Keep manufacturer, modelNumber, and partNumber separate. partNumber must contain only the equipment identifier as printed, for example N-ANN-80, and must not be prefixed with manufacturer, category, or description text.',
            'Do not merge different device types merely because they have the same quantity. Preserve symbol label, manufacturer, model, part number, description, and separate schedule/drawing provenance.',
            'Risks are professional review aids, not legal, engineering, contractual, or AHJ determinations.'
        ].join('\n')
    }
}
