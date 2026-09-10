import Ajv, { ValidateFunction } from 'ajv'
import OpenAI, { APIConnectionTimeoutError, APIError, toFile } from 'openai'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'
import { DOMMatrix, ImageData, Path2D } from '@napi-rs/canvas'

import { documentInspectionJsonSchema, floorplanSymbolLocationJsonSchema } from './document-analysis.schema'
import {
    DocumentAnalysisProgress,
    DocumentAnalysisBomProposal,
    DocumentAnalysisFloorplanProposal,
    DocumentAnalysisFloorplanSymbolPlacement,
    DocumentAnalysisProjectContext,
    DocumentAnalysisProjectDetailProposal,
    DocumentAnalysisProjectField,
    DocumentInspectionResult
} from './document-analysis.types'

export const OPENAI_DOCUMENT_INPUT_MAX_BYTES = (50 * 1024 * 1024) - 1
const DEFAULT_OPENAI_REQUEST_TIMEOUT_MS = 360000

const getOpenAiRequestTimeoutMs = (): number => {
    const configured = Number(process.env.OPENAI_TIMEOUT_MS || DEFAULT_OPENAI_REQUEST_TIMEOUT_MS)
    return Number.isFinite(configured) && configured > 0
        ? Math.max(60000, Math.floor(configured))
        : DEFAULT_OPENAI_REQUEST_TIMEOUT_MS
}

const getOpenAiReasoningOptions = (): Record<string, unknown> => {
    const effort = String(process.env.OPENAI_REASONING_EFFORT || '').trim().toLowerCase()
    return ['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)
        ? { reasoning: { effort } }
        : {}
}

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
    onOpenAiFileUploaded?: (fileId: string) => void | Promise<void>
    onOpenAiFileDeleted?: (fileId: string, deletedAt: string) => void | Promise<void>
    onOpenAiResponseCreated?: (responseId: string, requestId: string) => void | Promise<void>
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

export interface OpenAiFileCleanupResult {
    deletedFileIds: string[]
    missingFileIds: string[]
}

export interface AnalyzeFloorplanDiagnosticInput {
    buffer: Buffer
    filename: string
    mimeType: string
    bomDevices: Array<{ deviceName: string, partNumber: string, symbolLabel: string, quantity: number }>
}

export interface FloorplanDiagnosticResult {
    summary: string
    drawingType: string
    rotationDegrees: number
    legend: {
        found: boolean
        location: string
        items: Array<{ deviceName: string, partNumber: string, symbolLabel: string, description: string }>
    }
    bomComparisons: Array<{ deviceName: string, partNumber: string, symbolLabel: string, expectedQuantity: number, visibleCandidateCount: number, notes: string }>
    symbolCandidates: Array<{ deviceName: string, partNumber: string, symbolLabel: string, xRatio: number, yRatio: number, confidence: number, evidence: string }>
    scaleCandidates: Array<{ printedScale: string, rulerLabel: string, startXRatio: number, startYRatio: number, endXRatio: number, endYRatio: number, realWorldFeet: number, confidence: number, evidence: string }>
    warnings: string[]
}

export interface LocateFloorplanSymbolsInput {
    buffer: Buffer
    filename: string
    mimeType: string
    projectId: string
    documentId: string
    versionId: string
    floorplanName: string
    sourcePageNumber: number
    bomCandidates: Array<Pick<DocumentAnalysisBomProposal,
        'proposalId' | 'deviceType' | 'symbolLabel' | 'manufacturer' | 'modelNumber' | 'partNumber' | 'description'> & {
            expectedProjectQuantity: number
        }>
    signal?: AbortSignal
}

interface FloorplanAnalysisTile {
    pageNumber: number
    buffer: Buffer
    xStartRatio: number
    yStartRatio: number
    widthRatio: number
    heightRatio: number
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
    private readonly validateFloorplanLocations: ValidateFunction

    constructor() {
        this.validateResult = new Ajv({ allErrors: true, strict: false }).compile(documentInspectionJsonSchema)
        this.validateFloorplanLocations = new Ajv({ allErrors: true, strict: false }).compile(floorplanSymbolLocationJsonSchema)
    }

    getConfiguredModel(): string {
        return this.model
    }

    async createLegendSymbolIconDataUrl(
        buffer: Buffer,
        legendSymbol: DocumentAnalysisBomProposal['legendSymbol']
    ): Promise<string> {
        if (!legendSymbol?.found || legendSymbol.pageNumber < 1) {
            throw new DocumentAnalysisInputError('The inspection did not capture usable legend artwork for this device.', 409)
        }

        const sourcePdf = await PDFDocument.load(buffer)
        if (legendSymbol.pageNumber > sourcePdf.getPageCount()) {
            throw new DocumentAnalysisInputError('The inspected legend page no longer exists in the source document.', 409)
        }
        const paddingX = Math.max(0.004, legendSymbol.widthRatio * 0.2)
        const paddingY = Math.max(0.004, legendSymbol.heightRatio * 0.2)
        const renderedPage = await this.renderPdfPageToPng(buffer, legendSymbol.pageNumber, 6000)
        const cropRegion = {
            xStartRatio: Math.max(0, legendSymbol.xRatio - paddingX),
            yStartRatio: Math.max(0, legendSymbol.yRatio - paddingY),
            widthRatio: Math.min(1, legendSymbol.xRatio + legendSymbol.widthRatio + paddingX)
                - Math.max(0, legendSymbol.xRatio - paddingX),
            heightRatio: Math.min(1, legendSymbol.yRatio + legendSymbol.heightRatio + paddingY)
                - Math.max(0, legendSymbol.yRatio - paddingY)
        }
        const renderedCrop = await this.cropImageRegion(renderedPage, cropRegion)
        const cleanedCrop = await this.removeDisconnectedLegendGridLines(renderedCrop, {
            xStartRatio: (legendSymbol.xRatio - cropRegion.xStartRatio) / cropRegion.widthRatio,
            yStartRatio: (legendSymbol.yRatio - cropRegion.yStartRatio) / cropRegion.heightRatio,
            widthRatio: legendSymbol.widthRatio / cropRegion.widthRatio,
            heightRatio: legendSymbol.heightRatio / cropRegion.heightRatio
        })
        return this.createMaskedIconDataUrl(cleanedCrop)
    }

    private async createMaskedIconDataUrl(renderedCrop: Buffer): Promise<string> {
        const { data, info } = await sharp(renderedCrop)
            .flatten({ background: '#ffffff' })
            .grayscale()
            .raw()
            .toBuffer({ resolveWithObject: true })
        const rgba = Buffer.alloc(info.width * info.height * 4)
        for (let index = 0; index < data.length; index += 1) {
            const alpha = Math.max(0, Math.min(255, Math.round((245 - data[index]) * 1.35)))
            const offset = index * 4
            rgba[offset] = 255
            rgba[offset + 1] = 255
            rgba[offset + 2] = 255
            rgba[offset + 3] = alpha < 18 ? 0 : alpha
        }
        const icon = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
            .trim({ background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .resize(256, 256, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } })
            .png()
            .toBuffer()
        return `data:image/png;base64,${icon.toString('base64')}`
    }

    async analyzeFloorplanDiagnostic(input: AnalyzeFloorplanDiagnosticInput): Promise<FloorplanDiagnosticResult> {
        this.validateConfiguration()
        if (!input.buffer.length) throw new DocumentAnalysisInputError('The floorplan has no readable content.', 400)
        const client = new OpenAI({ apiKey: this.apiKey, timeout: getOpenAiRequestTimeoutMs() })
        let uploadedFileId = ''
        try {
            const isImage = String(input.mimeType || '').toLowerCase().startsWith('image/')
            const mediaContent: any = isImage
                ? { type: 'input_image', image_url: `data:${input.mimeType};base64,${input.buffer.toString('base64')}`, detail: 'high' }
                : await (async() => {
                    const uploaded = await client.files.create({
                        file: await toFile(input.buffer, input.filename, { type: input.mimeType || 'application/pdf' }),
                        purpose: 'user_data',
                        expires_after: { anchor: 'created_at', seconds: 24 * 60 * 60 }
                    })
                    uploadedFileId = uploaded.id
                    return { type: 'input_file', file_id: uploaded.id, detail: 'high' }
                })()
            const focusedLocationsPromise = isImage
                ? this.locateDiagnosticSymbolsInTiles(client, input).catch((error) => {
                    console.error('Focused diagnostic tile scan failed.', error)
                    return [] as FloorplanDiagnosticResult['symbolCandidates']
                })
                : Promise.resolve([] as FloorplanDiagnosticResult['symbolCandidates'])
            const response = await client.responses.create({
                model: this.model,
                ...getOpenAiReasoningOptions(),
                store: false,
                instructions: [
                    'Inspect one construction floorplan for diagnostic purposes. Do not claim that any project data was changed.',
                    'The supplied image is the canonical raster used by the floorplan designer. Its complete pixel rectangle is the only coordinate system.',
                    'Use xRatio and yRatio from 0 to 1 across the complete supplied image, measured from its top-left corner. Do not compensate for DPI, printed page size, zoom, margins, or an imagined crop.',
                    'Separate actual plan placements from examples in legends, schedules, details, title blocks, and scale graphics.',
                    'Scan the actual plan area systematically from top-left to bottom-right in a grid. Report every visible instance of a supported BOM or legend symbol, not merely one representative example of each type.',
                    'Compare visible symbols to the supplied BOM devices, report uncertainty, and do not invent a location. Put the coordinate at the visual center of the symbol graphic, not its label or device-address text.',
                    'Inspect legends row by row and report printed symbol labels, device names, and part numbers when legible.',
                    'Look for printed architectural/engineering scales and graphic scale rulers. For a readable graphic ruler or dimension line, return the exact two endpoints and its realWorldFeet. Endpoints must be normalized across the full source page. Use zeros when endpoints or length cannot be read; do not infer them.',
                    'Return only the schema-constrained JSON result.'
                ].join('\n'),
                input: [{ role: 'user', content: [mediaContent, {
                    type: 'input_text',
                    text: `Analyze ${JSON.stringify(input.filename)}. CURRENT_BOM_DEVICES\n${JSON.stringify(input.bomDevices)}\nEND_CURRENT_BOM_DEVICES`
                }] }],
                max_output_tokens: 12000,
                text: { format: { type: 'json_schema', name: 'floorplan_diagnostic', strict: true, schema: {
                    type: 'object', additionalProperties: false,
                    properties: {
                        summary: { type: 'string' }, drawingType: { type: 'string' }, rotationDegrees: { type: 'integer' },
                        legend: { type: 'object', additionalProperties: false, properties: {
                            found: { type: 'boolean' }, location: { type: 'string' }, items: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
                                deviceName: { type: 'string' }, partNumber: { type: 'string' }, symbolLabel: { type: 'string' }, description: { type: 'string' }
                            }, required: ['deviceName', 'partNumber', 'symbolLabel', 'description'] } }
                        }, required: ['found', 'location', 'items'] },
                        bomComparisons: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
                            deviceName: { type: 'string' }, partNumber: { type: 'string' }, symbolLabel: { type: 'string' }, expectedQuantity: { type: 'integer' }, visibleCandidateCount: { type: 'integer' }, notes: { type: 'string' }
                        }, required: ['deviceName', 'partNumber', 'symbolLabel', 'expectedQuantity', 'visibleCandidateCount', 'notes'] } },
                        symbolCandidates: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
                            deviceName: { type: 'string' }, partNumber: { type: 'string' }, symbolLabel: { type: 'string' }, xRatio: { type: 'number' }, yRatio: { type: 'number' }, confidence: { type: 'number' }, evidence: { type: 'string' }
                        }, required: ['deviceName', 'partNumber', 'symbolLabel', 'xRatio', 'yRatio', 'confidence', 'evidence'] } },
                        scaleCandidates: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
                            printedScale: { type: 'string' }, rulerLabel: { type: 'string' }, startXRatio: { type: 'number' }, startYRatio: { type: 'number' }, endXRatio: { type: 'number' }, endYRatio: { type: 'number' }, realWorldFeet: { type: 'number' }, confidence: { type: 'number' }, evidence: { type: 'string' }
                        }, required: ['printedScale', 'rulerLabel', 'startXRatio', 'startYRatio', 'endXRatio', 'endYRatio', 'realWorldFeet', 'confidence', 'evidence'] } },
                        warnings: { type: 'array', items: { type: 'string' } }
                    }, required: ['summary', 'drawingType', 'rotationDegrees', 'legend', 'bomComparisons', 'symbolCandidates', 'scaleCandidates', 'warnings']
                } } }
            })
            if (!response.output_text) throw new Error('OpenAI returned no floorplan diagnostic output.')
            const result = JSON.parse(response.output_text) as FloorplanDiagnosticResult
            const focusedLocations = await focusedLocationsPromise
            const contextualCandidates = focusedLocations.length > 0
                ? result.symbolCandidates.map((candidate) => ({
                    ...candidate,
                    confidence: Math.min(0.69, candidate.confidence),
                    evidence: `Full-sheet contextual candidate; requires focused confirmation. ${candidate.evidence}`
                }))
                : result.symbolCandidates
            result.symbolCandidates = this.mergeDiagnosticSymbolCandidates(contextualCandidates, focusedLocations)
            if (focusedLocations.length > 0) {
                result.summary = `${result.summary} A focused overlapping-tile scan supplied ${focusedLocations.length} pixel-localized symbol candidates.`
            }
            return result
        } catch (error) {
            throw this.toProviderError(error)
        } finally {
            if (uploadedFileId) {
                try { await client.files.delete(uploadedFileId) } catch (error) { console.error('Floorplan diagnostic file cleanup failed.', error) }
            }
        }
    }

    private async locateDiagnosticSymbolsInTiles(client: OpenAI, input: AnalyzeFloorplanDiagnosticInput): Promise<FloorplanDiagnosticResult['symbolCandidates']> {
        const image = sharp(input.buffer, { failOn: 'none' })
        const metadata = await image.metadata()
        const width = Number(metadata.width || 0)
        const height = Number(metadata.height || 0)
        if (width < 400 || height < 400) return []

        const columns = 3
        const rows = 3
        const overlap = 0.12
        const tiles: Array<{ index: number, left: number, top: number, width: number, height: number, buffer: Buffer }> = []
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const nominalLeft = column / columns
                const nominalRight = (column + 1) / columns
                const nominalTop = row / rows
                const nominalBottom = (row + 1) / rows
                const leftRatio = Math.max(0, nominalLeft - (column > 0 ? overlap / columns : 0))
                const rightRatio = Math.min(1, nominalRight + (column < columns - 1 ? overlap / columns : 0))
                const topRatio = Math.max(0, nominalTop - (row > 0 ? overlap / rows : 0))
                const bottomRatio = Math.min(1, nominalBottom + (row < rows - 1 ? overlap / rows : 0))
                const left = Math.floor(leftRatio * width)
                const top = Math.floor(topRatio * height)
                const tileWidth = Math.max(1, Math.ceil(rightRatio * width) - left)
                const tileHeight = Math.max(1, Math.ceil(bottomRatio * height) - top)
                tiles.push({
                    index: tiles.length,
                    left,
                    top,
                    width: tileWidth,
                    height: tileHeight,
                    buffer: await sharp(input.buffer, { failOn: 'none' }).extract({ left, top, width: tileWidth, height: tileHeight }).png().toBuffer()
                })
            }
        }

        const content: any[] = [{
            type: 'input_text',
            text: [
                'Locate every actual fire-alarm device symbol in each numbered crop.',
                'Crops overlap. Report coordinates local to the stated crop from 0 to 1, at the exact center of the symbol graphic.',
                'Exclude legends, schedules, title blocks, example symbols, wire keys, room labels, circuit text, candela text, and device-address text.',
                'Use the supplied BOM identities. Do not use a nearby glyph as a substitute for a requested device.',
                'Prefix collisions require exact reading: F is not FACP and P is not RPS. For text-designated equipment labels FACP, LCD, and RPS, observedLabel must contain the complete visibly printed label. For graphical appliance symbols such as STR or HWP, report the actual visible glyph or shape description. Never expand a one-character glyph into a longer equipment label.',
                `BOM: ${JSON.stringify(input.bomDevices)}`
            ].join('\n')
        }]
        for (const tile of tiles) {
            content.push({ type: 'input_text', text: `CROP ${tile.index}; full-image pixel bounds left=${tile.left}, top=${tile.top}, width=${tile.width}, height=${tile.height}.` })
            content.push({ type: 'input_image', image_url: `data:image/png;base64,${tile.buffer.toString('base64')}`, detail: 'high' })
        }
        const responseFormat: any = { type: 'json_schema', name: 'floorplan_tile_locations', strict: true, schema: {
                type: 'object', additionalProperties: false,
                properties: { placements: { type: 'array', items: { type: 'object', additionalProperties: false, properties: {
                    tileIndex: { type: 'integer' }, deviceName: { type: 'string' }, partNumber: { type: 'string' }, symbolLabel: { type: 'string' }, observedLabel: { type: 'string' },
                    xRatio: { type: 'number' }, yRatio: { type: 'number' }, confidence: { type: 'number' }, evidence: { type: 'string' }
                }, required: ['tileIndex', 'deviceName', 'partNumber', 'symbolLabel', 'observedLabel', 'xRatio', 'yRatio', 'confidence', 'evidence'] } } },
                required: ['placements']
            } }
        const runPass = async (passContent: any[], passName: string): Promise<FloorplanDiagnosticResult['symbolCandidates']> => {
            const response = await client.responses.create({
                model: this.model,
                ...getOpenAiReasoningOptions(),
                store: false,
                instructions: 'Perform exhaustive symbol localization. Return only schema-constrained JSON. Coordinates are local to each crop.',
                input: [{ role: 'user', content: passContent }],
                max_output_tokens: 16000,
                text: { format: responseFormat }
            })
            if (!response.output_text) return []
            const parsed = JSON.parse(response.output_text) as { placements?: Array<any> }
            return (parsed.placements || []).flatMap((placement) => {
                const tile = tiles[Number(placement.tileIndex)]
                if (!tile) return []
                const normalizeLabel = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
                const expectedLabel = normalizeLabel(placement.symbolLabel)
                const observedLabel = normalizeLabel(placement.observedLabel)
                if (['FACP', 'LCD', 'RPS'].includes(expectedLabel) && observedLabel !== expectedLabel) return []
                return [{
                    deviceName: String(placement.deviceName || ''),
                    partNumber: String(placement.partNumber || ''),
                    symbolLabel: String(placement.symbolLabel || ''),
                    xRatio: Math.max(0, Math.min(1, (tile.left + (Number(placement.xRatio || 0) * tile.width)) / width)),
                    yRatio: Math.max(0, Math.min(1, (tile.top + (Number(placement.yRatio || 0) * tile.height)) / height)),
                    confidence: Math.max(0, Math.min(1, Number(placement.confidence || 0))),
                    evidence: `${passName} crop ${tile.index}; observed ${observedLabel || 'unlabeled symbol'}: ${String(placement.evidence || '')}`
                }]
            })
        }

        const firstPass = this.mergeDiagnosticSymbolCandidates([], await runPass(content, 'Focused'))
        const normalizeIdentity = (value: unknown) => String(value || '').toUpperCase().replace(/[^A-Z0-9]+/g, '')
        const deficits = input.bomDevices.flatMap((device) => {
            const identity = normalizeIdentity(device.partNumber) || normalizeIdentity(device.symbolLabel)
            const found = firstPass.filter((candidate) => (normalizeIdentity(candidate.partNumber) || normalizeIdentity(candidate.symbolLabel)) === identity).length
            const missing = Math.max(0, Number(device.quantity || 0) - found)
            return missing > 0 ? [{ ...device, found, missing }] : []
        })
        if (deficits.length === 0) return firstPass

        const recoveryContent: any[] = [{
            type: 'input_text',
            text: [
                'RECOVERY PASS: independently look again for symbols missed by the first scan.',
                `DEFICITS: ${JSON.stringify(deficits)}`,
                `ALREADY_FOUND_FULL_IMAGE_COORDINATES: ${JSON.stringify(firstPass.map((item) => ({ partNumber: item.partNumber, symbolLabel: item.symbolLabel, xRatio: item.xRatio, yRatio: item.yRatio })))}`,
                'Do not repeat an already-found coordinate. Search blank-looking corridors, large open rooms, perimeter runs, and crop edges carefully.',
                'Distinguish notification appliances by their actual legend glyph: a plain strobe is STR; a horn/strobe is H. Nearby candela and address text is not the symbol.',
                'Return only additional real devices. Expected quantity is a search target, never permission to invent a mark.',
                `BOM: ${JSON.stringify(input.bomDevices)}`
            ].join('\n')
        }, ...content.slice(1)]
        const recoveryPass = await runPass(recoveryContent, 'Recovery')
        return this.mergeDiagnosticSymbolCandidates(firstPass, recoveryPass)
    }

    private mergeDiagnosticSymbolCandidates(primary: FloorplanDiagnosticResult['symbolCandidates'], focused: FloorplanDiagnosticResult['symbolCandidates']): FloorplanDiagnosticResult['symbolCandidates'] {
        const normalize = (value: unknown) => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '')
        const accepted: FloorplanDiagnosticResult['symbolCandidates'] = []
        for (const candidate of [...focused, ...primary].sort((left, right) => right.confidence - left.confidence)) {
            const identity = normalize(candidate.partNumber) || normalize(candidate.symbolLabel) || normalize(candidate.deviceName)
            const duplicate = accepted.some((existing) => {
                const existingIdentity = normalize(existing.partNumber) || normalize(existing.symbolLabel) || normalize(existing.deviceName)
                return identity === existingIdentity && Math.hypot(candidate.xRatio - existing.xRatio, candidate.yRatio - existing.yRatio) < 0.012
            })
            if (!duplicate) accepted.push(candidate)
        }
        return accepted.sort((left, right) => left.yRatio - right.yRatio || left.xRatio - right.xRatio)
    }

    async locateFloorplanSymbols(input: LocateFloorplanSymbolsInput): Promise<DocumentAnalysisFloorplanSymbolPlacement[]> {
        this.validateConfiguration()
        if (!input.buffer.length || String(input.mimeType || '').toLowerCase() !== 'application/pdf') {
            throw new DocumentAnalysisInputError('Focused floorplan location analysis requires a readable PDF floorplan.', 400)
        }
        if (input.bomCandidates.length === 0) {
            throw new DocumentAnalysisInputError('At least one document-derived BOM candidate is required before locating floorplan symbols.', 409)
        }

        const tiled = await this.createFloorplanAnalysisTiles(input.buffer)
        const client = new OpenAI({
            apiKey: this.apiKey,
            timeout: getOpenAiRequestTimeoutMs()
        })
        try {
            const tileResults: DocumentAnalysisFloorplanSymbolPlacement[][] = new Array(tiled.tiles.length)
            const tileErrors: unknown[] = []
            let nextTileIndex = 0
            const worker = async (): Promise<void> => {
                while (nextTileIndex < tiled.tiles.length) {
                    const tileIndex = nextTileIndex
                    nextTileIndex += 1
                    try {
                        tileResults[tileIndex] = await this.locateFloorplanSymbolsInTile(client, input, tiled.tiles[tileIndex], tiled.tiles.length)
                    } catch (error) {
                        tileResults[tileIndex] = []
                        tileErrors.push(error)
                        console.error('OpenAI focused floorplan tile analysis failed.', {
                            tilePage: tiled.tiles[tileIndex].pageNumber,
                            message: error instanceof Error ? error.message : String(error || '')
                        })
                    }
                }
            }
            await Promise.all(Array.from({ length: Math.min(3, tiled.tiles.length) }, () => worker()))
            if (tileErrors.length > 0) {
                throw new Error(`Focused floorplan analysis did not complete ${tileErrors.length} of ${tiled.tiles.length} enlarged regions. The prior symbol set was preserved.`)
            }
            const merged = this.deduplicateFloorplanPlacements(tileResults.flat())
            console.info('[document-inspection] Focused floorplan region scan completed.', {
                floorplanName: input.floorplanName,
                regionCounts: tileResults.map((placements, index) => ({ region: index + 1, placements: placements.length })),
                mergedPlacements: merged.length,
                placementsByProposal: [...new Set(merged.map((placement) => placement.bomProposalId))].map((proposalId) => ({
                    proposalId,
                    placements: merged.filter((placement) => placement.bomProposalId === proposalId).length
                }))
            })
            return merged
        } catch (error) {
            throw this.toProviderError(error)
        }
    }

    private async locateFloorplanSymbolsInTile(
        client: OpenAI,
        input: LocateFloorplanSymbolsInput,
        tile: FloorplanAnalysisTile,
        tileCount: number
    ): Promise<DocumentAnalysisFloorplanSymbolPlacement[]> {
        const response = await client.responses.create({
                model: this.model,
                ...getOpenAiReasoningOptions(),
                store: false,
                instructions: [
                    'You are exhaustively locating fire alarm, sprinkler, or electronic security device symbols in one enlarged crop of a construction floorplan.',
                    'Inspect every supported candidate one at a time and return one placement for every actual matching device graphic visible in this crop.',
                    'Small repeated green symbols connected by green circuit lines are real device marks and must be counted. Red and other colored device graphics are also eligible.',
                    'Use printed symbol shape, abbreviation, nearby device tag, and candidate description together. Do not require a symbol to have the same color as its Firewire bubble.',
                    'Expected project quantity is a recall aid for the entire drawing, not a required count for this crop. Never invent marks to reach it.',
                    'Exclude legend examples, schedules, title blocks, details, notes, room labels, circuit text, and wire junctions that are not device symbols.',
                    'The supplied PNG is a pixel crop of the same rotation-aware raster shown by the Firewire floorplan designer.',
                    'xRatio and yRatio must be the center of the colored device graphic in this crop, normalized from 0 to 1 from top-left. Do not compensate for PDF page rotation, printed dimensions, margins, or DPI. Do not center on adjacent text.',
                    'source.page must be "1" because the supplied image is one crop.',
                    'Use only a supplied proposalId, copy its identity fields, and use empty placementId. Return an empty array only after checking every candidate across the entire crop.',
                    `This is crop ${tile.pageNumber} of ${tileCount} from original PDF page ${input.sourcePageNumber}. Use ${JSON.stringify(input.filename)} in source.filename.`
                ].join('\n'),
                input: [{
                    role: 'user',
                    content: [
                        { type: 'input_image', image_url: `data:image/png;base64,${tile.buffer.toString('base64')}`, detail: 'high' },
                        {
                            type: 'input_text',
                            text: [
                                `Exhaustively locate supported symbols in this crop of ${JSON.stringify(input.floorplanName)}.`,
                                'SUPPORTED_BOM_CANDIDATES',
                                JSON.stringify(input.bomCandidates),
                                'END_SUPPORTED_BOM_CANDIDATES'
                            ].join('\n')
                        }
                    ]
                }],
                max_output_tokens: 12000,
                metadata: {
                    firewire_project_id: input.projectId,
                    firewire_document_id: input.documentId,
                    firewire_version_id: input.versionId,
                    firewire_tile_page: String(tile.pageNumber)
                },
                text: {
                    format: {
                        type: 'json_schema',
                        name: 'firewire_floorplan_symbol_locations',
                        description: 'Reviewable device-symbol locations in one enlarged floorplan crop.',
                        strict: true,
                        schema: floorplanSymbolLocationJsonSchema
                    }
                }
        }, { signal: input.signal })
        if (response.status !== 'completed' || !response.output_text) {
            throw new Error(`OpenAI did not complete floorplan crop ${tile.pageNumber}.`)
        }
        const parsed = JSON.parse(response.output_text) as { placements: DocumentAnalysisFloorplanSymbolPlacement[] }
        if (!this.validateFloorplanLocations(parsed)) {
            const details = this.validateFloorplanLocations.errors
                ?.map((error) => `${error.instancePath || '/'} ${error.message || 'is invalid'}`)
                .join('; ')
            throw new Error(`OpenAI floorplan crop output failed schema validation: ${details || 'unknown validation error'}`)
        }
        const candidates = new Map(input.bomCandidates.map((candidate) => [candidate.proposalId, candidate]))
        return (parsed.placements || []).filter((placement) =>
            candidates.has(String(placement.bomProposalId || ''))
            && Number(placement.confidence || 0) >= 0.45)
            .map((placement, index) => {
                const candidate = candidates.get(placement.bomProposalId)!
                return {
                    ...placement,
                    placementId: `tile-${tile.pageNumber}-placement-${index + 1}`,
                    deviceType: candidate.deviceType,
                    symbolLabel: candidate.symbolLabel,
                    manufacturer: candidate.manufacturer,
                    modelNumber: candidate.modelNumber,
                    partNumber: candidate.partNumber,
                    xRatio: Math.max(0, Math.min(1, tile.xStartRatio + (Number(placement.xRatio || 0) * tile.widthRatio))),
                    yRatio: Math.max(0, Math.min(1, tile.yStartRatio + (Number(placement.yRatio || 0) * tile.heightRatio))),
                    confidence: Math.max(0, Math.min(1, Number(placement.confidence || 0)))
                }
            })
    }

    private async createFloorplanAnalysisTiles(buffer: Buffer): Promise<{ tiles: FloorplanAnalysisTile[] }> {
        const sourcePdf = await PDFDocument.load(buffer)
        if (sourcePdf.getPageCount() !== 1) {
            throw new DocumentAnalysisInputError('Focused floorplan location analysis requires a one-page PDF floorplan.', 409)
        }
        // PDF page boxes use unrotated bottom-left coordinates. The designer and AI both
        // work in a rendered top-left coordinate system. Rasterize first so CropBox and
        // /Rotate are resolved exactly once; tiling the raw page box displaced every
        // placement on rotated landscape sheets.
        const canonicalRaster = await this.renderPdfPageToPng(buffer, 1, 4096)
        const metadata = await sharp(canonicalRaster).metadata()
        const width = Math.max(1, Number(metadata.width || 0))
        const height = Math.max(1, Number(metadata.height || 0))
        const columns = 4
        const rows = 3
        const overlapXRatio = 0.02
        const overlapYRatio = 0.025
        const tiles: FloorplanAnalysisTile[] = []
        let pageNumber = 0
        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const xStartRatio = Math.max(0, (column / columns) - overlapXRatio)
                const xEndRatio = Math.min(1, ((column + 1) / columns) + overlapXRatio)
                const yStartRatio = Math.max(0, (row / rows) - overlapYRatio)
                const yEndRatio = Math.min(1, ((row + 1) / rows) + overlapYRatio)
                const left = Math.max(0, Math.min(width - 1, Math.floor(width * xStartRatio)))
                const top = Math.max(0, Math.min(height - 1, Math.floor(height * yStartRatio)))
                const right = Math.max(left + 1, Math.min(width, Math.ceil(width * xEndRatio)))
                const bottom = Math.max(top + 1, Math.min(height, Math.ceil(height * yEndRatio)))
                pageNumber += 1
                tiles.push({
                    pageNumber,
                    buffer: await sharp(canonicalRaster).extract({ left, top, width: right - left, height: bottom - top }).png().toBuffer(),
                    xStartRatio: left / width,
                    yStartRatio: top / height,
                    widthRatio: (right - left) / width,
                    heightRatio: (bottom - top) / height
                })
            }
        }
        console.info('[document-inspection] Canonical floorplan raster tiled.', {
            width,
            height,
            tileCount: tiles.length
        })
        return { tiles }
    }

    private deduplicateFloorplanPlacements(
        placements: DocumentAnalysisFloorplanSymbolPlacement[]
    ): DocumentAnalysisFloorplanSymbolPlacement[] {
        const accepted: DocumentAnalysisFloorplanSymbolPlacement[] = []
        for (const placement of [...placements].sort((left, right) => right.confidence - left.confidence)) {
            const duplicate = accepted.some((candidate) => {
                if (candidate.bomProposalId !== placement.bomProposalId) return false
                const dx = candidate.xRatio - placement.xRatio
                const dy = candidate.yRatio - placement.yRatio
                return Math.sqrt((dx * dx) + (dy * dy)) <= 0.008
            })
            if (!duplicate) accepted.push(placement)
        }
        return accepted.sort((left, right) => left.yRatio - right.yRatio || left.xRatio - right.xRatio)
            .map((placement, index) => ({ ...placement, placementId: `focused-placement-${index + 1}` }))
    }

    async deleteTemporaryFiles(fileIds: string[]): Promise<OpenAiFileCleanupResult> {
        const uniqueFileIds = [...new Set(fileIds.map((fileId) => String(fileId || '').trim()).filter(Boolean))]
        if (uniqueFileIds.length === 0) {
            return { deletedFileIds: [], missingFileIds: [] }
        }
        if (!this.apiKey) {
            throw new DocumentAnalysisConfigurationError(
                'OpenAI is not configured, so retained temporary document files cannot be removed before deleting the project.'
            )
        }

        const client = new OpenAI({
            apiKey: this.apiKey,
            timeout: getOpenAiRequestTimeoutMs()
        })
        const result: OpenAiFileCleanupResult = { deletedFileIds: [], missingFileIds: [] }
        for (const fileId of uniqueFileIds) {
            try {
                await client.files.delete(fileId)
                result.deletedFileIds.push(fileId)
            } catch (error) {
                if (error instanceof APIError && error.status === 404) {
                    result.missingFileIds.push(fileId)
                    continue
                }
                throw this.toProviderError(error)
            }
        }
        return result
    }

    async inspectDocument(input: InspectDocumentInput): Promise<InspectDocumentOutput> {
        this.validateConfiguration()
        this.validateInput(input)

        const client = new OpenAI({
            apiKey: this.apiKey,
            timeout: getOpenAiRequestTimeoutMs()
        })
        let openAiFileId = ''
        let openAiFileDeletedAt = ''
        let inspectionResult: DocumentInspectionResult | null = null
        let openAiResponseId = ''
        let openAiRequestId = ''
        let openAiResponseStatus = ''

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
            await this.reportOpenAiFileUploaded(input, openAiFileId)
            await this.reportProgress(input, 'uploaded', 'Document uploaded. Starting structured analysis.', 50)

            await this.reportProgress(input, 'analyzing', 'OpenAI is reading the document and extracting grounded findings.', 60)
            const configuredMaxOutputTokens = Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000)
            const maxOutputTokens = Number.isFinite(configuredMaxOutputTokens)
                ? Math.max(12000, Math.floor(configuredMaxOutputTokens))
                : 30000
            let response = await client.responses.create({
                model: this.model,
                ...getOpenAiReasoningOptions(),
                background: true,
                store: true,
                instructions: this.getSystemInstructions(input.filename),
                input: [{
                    role: 'user',
                    content: [
                        { type: 'input_file', file_id: uploadedFile.id, detail: 'high' },
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
                max_output_tokens: maxOutputTokens,
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
            }, { signal: input.signal })
            openAiResponseId = response.id
            openAiRequestId = String((response as any)._request_id || '')
            openAiResponseStatus = String(response.status || '')
            await this.reportOpenAiResponseCreated(input, openAiResponseId, openAiRequestId)
            await this.reportProgress(
                input,
                'analyzing',
                `OpenAI accepted the background analysis (${openAiResponseStatus || 'queued'}). Waiting for grounded findings.`,
                60
            )

            response = await this.withAnalysisHeartbeat(input, async () => {
                let current = response
                while (current.status === 'queued' || current.status === 'in_progress') {
                    await this.waitForBackgroundPoll(input.signal)
                    current = await client.responses.retrieve(current.id, {}, { signal: input.signal })
                    openAiResponseStatus = String(current.status || '')
                }
                return current
            })
            openAiResponseStatus = String(response.status || '')
            if (response.status !== 'completed') {
                console.error('[document-inspection] OpenAI background analysis reached a non-completed terminal state.', {
                    projectId: input.projectId,
                    documentId: input.documentId,
                    versionId: input.versionId,
                    responseId: response.id,
                    status: response.status,
                    errorCode: response.error?.code || '',
                    errorMessage: response.error?.message || '',
                    incompleteReason: response.incomplete_details?.reason || ''
                })
                throw new DocumentAnalysisProviderError(
                    `OpenAI ended the background analysis with status ${response.status || 'unknown'}. Try the inspection again.`,
                    502,
                    'OPENAI_BACKGROUND_RESPONSE_FAILED',
                    true
                )
            }

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

            const normalizedResult = this.normalizeProjectActions(parsed, input.projectContext)
            await this.reportProgress(input, 'locating-legend-symbols', 'Structured findings validated. Locating exact legend glyph artwork.', 90)
            inspectionResult = await this.enrichLegendSymbols(client, normalizedResult, input)
            await this.reportProgress(input, 'finalizing', 'Structured findings validated. Finalizing the inspection.', 95)
        } catch (error) {
            if (openAiResponseId && (openAiResponseStatus === 'queued' || openAiResponseStatus === 'in_progress')) {
                try {
                    await client.responses.cancel(openAiResponseId)
                } catch (cancelError) {
                    console.error('OpenAI background response cancellation failed.', {
                        responseId: openAiResponseId,
                        message: cancelError instanceof Error ? cancelError.message : String(cancelError || '')
                    })
                }
            }
            throw this.toProviderError(error)
        } finally {
            if (openAiResponseId) {
                try {
                    await client.responses.delete(openAiResponseId)
                } catch (cleanupError) {
                    console.error('OpenAI background response cleanup failed.', {
                        responseId: openAiResponseId,
                        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError || '')
                    })
                }
            }
            if (openAiFileId) {
                try {
                    await client.files.delete(openAiFileId)
                    openAiFileDeletedAt = new Date().toISOString()
                    await this.reportOpenAiFileDeleted(input, openAiFileId, openAiFileDeletedAt)
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

    private async reportOpenAiFileUploaded(input: InspectDocumentInput, fileId: string): Promise<void> {
        if (!input.onOpenAiFileUploaded) {
            return
        }
        try {
            await input.onOpenAiFileUploaded(fileId)
        } catch (error) {
            console.error('OpenAI temporary document upload tracking failed.', {
                fileId,
                message: error instanceof Error ? error.message : String(error || '')
            })
        }
    }

    private async reportOpenAiFileDeleted(input: InspectDocumentInput, fileId: string, deletedAt: string): Promise<void> {
        if (!input.onOpenAiFileDeleted) {
            return
        }
        try {
            await input.onOpenAiFileDeleted(fileId, deletedAt)
        } catch (error) {
            console.error('OpenAI temporary document deletion tracking failed.', {
                fileId,
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
            if (this.isInvalidReportScopeProposal(proposal, result.proposedBomActions || [])) {
                return actions
            }
            if (!proposedValue || this.projectValuesEqual(proposal.targetField, proposal.valueType, currentValue, proposedValue)) {
                return actions
            }
            actions.push({ ...proposal, currentValue, proposedValue })
            return actions
        }, [])
        const proposedBomActions = this.normalizeBomProposals(result.proposedBomActions || [])
        return {
            ...result,
            proposedActions,
            proposedBomActions,
            proposedFloorplanActions: this.normalizeFloorplanProposals(
                result.proposedFloorplanActions || [],
                proposedBomActions
            )
        }
    }

    private async reportOpenAiResponseCreated(
        input: InspectDocumentInput,
        responseId: string,
        requestId: string
    ): Promise<void> {
        if (!input.onOpenAiResponseCreated) {
            return
        }
        try {
            await input.onOpenAiResponseCreated(responseId, requestId)
        } catch (error) {
            console.error('OpenAI background response tracking failed.', {
                responseId,
                message: error instanceof Error ? error.message : String(error || '')
            })
        }
    }

    private async waitForBackgroundPoll(signal?: AbortSignal): Promise<void> {
        if (signal?.aborted) {
            throw signal.reason instanceof Error ? signal.reason : new Error('Document inspection was aborted.')
        }
        await new Promise<void>((resolve) => setTimeout(resolve, 5000))
        if (signal?.aborted) {
            throw signal.reason instanceof Error ? signal.reason : new Error('Document inspection was aborted.')
        }
    }

    private async enrichLegendSymbols(
        client: OpenAI,
        result: DocumentInspectionResult,
        input: InspectDocumentInput
    ): Promise<DocumentInspectionResult> {
        const isPdf = /\.pdf$/i.test(input.filename) || String(input.mimeType || '').toLowerCase() === 'application/pdf'
        const candidates = (result.proposedBomActions || []).map((proposal) => ({
            proposalId: proposal.proposalId,
            deviceType: proposal.deviceType,
            symbolLabel: proposal.symbolLabel,
            manufacturer: proposal.manufacturer,
            modelNumber: proposal.modelNumber,
            partNumber: proposal.partNumber,
            description: proposal.description,
            sourcePages: [proposal.scheduleSource?.page || '', proposal.drawingSource?.page || ''].filter(Boolean)
        }))
        if (!isPdf || candidates.length === 0) {
            return result
        }

        const citedPages = [...new Set(candidates
            .flatMap((candidate) => candidate.sourcePages.flatMap((page) => String(page || '').match(/\d+/g) || []))
            .map((value) => Math.floor(Number(value)))
            .filter((value) => value > 0))]
        const fallbackPages = (result.proposedFloorplanActions || [])
            .map((proposal) => Math.floor(Number(proposal.pageNumber || 0)))
            .filter((value) => value > 0)
        let legendRegions: Array<{
            cropId: string
            pageNumber: number
            xStartRatio: number
            yStartRatio: number
            widthRatio: number
            heightRatio: number
        }>
        try {
            legendRegions = await this.createLegendLocalizationRegions(
                input.buffer,
                [...new Set([1, ...citedPages, ...fallbackPages])].slice(0, 12)
            )
        } catch (error) {
            console.error('[document-inspection] Legend page extraction failed; preserving whole-document findings.', {
                projectId: input.projectId,
                documentId: input.documentId,
                message: error instanceof Error ? error.message : String(error || '')
            })
            return result
        }
        if (legendRegions.length === 0) {
            return result
        }

        const sourceProperties = {
            filename: { type: 'string' },
            page: { type: 'string' },
            section: { type: 'string' },
            location: { type: 'string' }
        }
        try {
            const pageImages: Array<{
                cropId: string
                pageNumber: number
                imageBuffer: Buffer
                xStartRatio: number
                yStartRatio: number
                widthRatio: number
                heightRatio: number
            }> = []
            const renderedPages = new Map<number, Buffer>()
            for (const region of legendRegions) {
                let renderedPage = renderedPages.get(region.pageNumber)
                if (!renderedPage) {
                    renderedPage = await this.renderPdfPageToPng(input.buffer, region.pageNumber, 5200)
                    renderedPages.set(region.pageNumber, renderedPage)
                }
                pageImages.push({
                    ...region,
                    imageBuffer: await this.cropImageRegion(renderedPage, region)
                })
            }
            const response = await client.responses.create({
                model: this.model,
                ...getOpenAiReasoningOptions(),
                store: false,
                instructions: [
                    'Locate the exact printed legend glyph artwork for each supplied Firewire BOM proposal in this PDF.',
                    `Use ${JSON.stringify(input.filename)} in every source.filename field.`,
                    'Inspect every symbol, device, equipment, annunciation, and abbreviation legend row by row across every page.',
                    'A general symbol/device legend may define glyphs used by floorplans on other pages. Match candidates across the complete document; do not require a candidate source page to equal the legend page unless the legend explicitly limits itself to a sheet, level, sector, or area.',
                    'Match each candidate to the printed legend row primarily by device type, row description, manufacturer, model, and part number. Do not substitute a similar neighboring legend row.',
                    'The supplied symbolLabel came from a broad document pass and may be wrong. Treat it only as a hint. A visibly printed glyph in the correctly described legend row is authoritative even when its letters differ from symbolLabel.',
                    'The device icon is the complete artwork shown in the first SYMBOL column for the matched row. Boxed text is valid artwork: for example, a red rectangle enclosing FACP is the Fire Alarm Control Panel glyph, and a red square enclosing F is the Manual Pull Station glyph.',
                    'For a found glyph, return a tight rectangle around the complete example artwork, including its enclosing rectangle, circle, polygon, lines, and any letters printed inside it. Exclude the legend table cell border, row description, quantities, model/part numbers, and neighboring rows.',
                    'observedSymbolLabel is the exact short text visibly printed inside or immediately defining that glyph, such as F, H, or FS. Use an empty string for a purely graphical glyph.',
                    'Each supplied image is a high-resolution raster of a cropped legend region. Coordinates use the complete supplied image and are normalized 0 to 1 from its top-left: xRatio is left, yRatio is top, widthRatio is width, and heightRatio is height.',
                    'Set found true whenever the matched legend row has visible content in its first SYMBOL column, including boxed abbreviations. Set found false only when the candidate row is absent or its symbol cell is genuinely empty. For a false result, use the most relevant inspected cropId and return pageNumber and all coordinates as zero.',
                    'Use only supplied proposalId values and return exactly one result for every supplied candidate. Return only schema-constrained JSON.'
                ].join('\n'),
                input: [{
                    role: 'user',
                    content: [
                        ...pageImages.flatMap((page) => [
                            { type: 'input_text', text: `CROP ${page.cropId}: this high-resolution image is an enlarged legend region extracted from original PDF page ${page.pageNumber}. Return cropId ${page.cropId}. Coordinates must be local to the complete supplied image from 0 to 1; Firewire will transform them back to the original page.` },
                            { type: 'input_image', image_url: `data:image/png;base64,${page.imageBuffer.toString('base64')}`, detail: 'high' }
                        ]),
                        { type: 'input_text', text: `LEGEND_GLYPH_CANDIDATES\n${JSON.stringify(candidates)}\nEND_LEGEND_GLYPH_CANDIDATES` }
                    ] as any
                }],
                max_output_tokens: Math.max(4000, candidates.length * 350),
                metadata: {
                    firewire_project_id: input.projectId,
                    firewire_document_id: input.documentId,
                    firewire_version_id: input.versionId,
                    firewire_analysis_stage: 'legend-glyph-localization'
                },
                text: { format: { type: 'json_schema', name: 'firewire_legend_glyph_locations', strict: true, schema: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                        symbols: {
                            type: 'array',
                            items: {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    proposalId: { type: 'string' },
                                    cropId: { type: 'string' },
                                    found: { type: 'boolean' },
                                    observedSymbolLabel: { type: 'string' },
                                    pageNumber: { type: 'integer', minimum: 0 },
                                    xRatio: { type: 'number', minimum: 0, maximum: 1 },
                                    yRatio: { type: 'number', minimum: 0, maximum: 1 },
                                    widthRatio: { type: 'number', minimum: 0, maximum: 1 },
                                    heightRatio: { type: 'number', minimum: 0, maximum: 1 },
                                    confidence: { type: 'number', minimum: 0, maximum: 1 },
                                    source: {
                                        type: 'object',
                                        additionalProperties: false,
                                        properties: sourceProperties,
                                        required: ['filename', 'page', 'section', 'location']
                                    }
                                },
                                required: [
                                    'proposalId', 'cropId', 'found', 'observedSymbolLabel', 'pageNumber', 'xRatio', 'yRatio',
                                    'widthRatio', 'heightRatio', 'confidence', 'source'
                                ]
                            }
                        }
                    },
                    required: ['symbols']
                } } }
            }, { signal: input.signal })
            if (!response.output_text) {
                throw new Error('OpenAI returned no legend glyph localization output.')
            }
            const parsed = JSON.parse(response.output_text) as {
                symbols?: Array<{ proposalId: string, cropId: string, observedSymbolLabel: string } & DocumentAnalysisBomProposal['legendSymbol']>
            }
            const allowedIds = new Set(candidates.map((candidate) => candidate.proposalId))
            const cropsById = new Map(pageImages.map((page) => [page.cropId, page]))
            const localized = new Map((parsed.symbols || [])
                .filter((symbol) => allowedIds.has(String(symbol.proposalId || '')) && cropsById.has(String(symbol.cropId || '')))
                .map((symbol) => {
                    const crop = cropsById.get(String(symbol.cropId || ''))!
                    return [symbol.proposalId, {
                        observedSymbolLabel: String(symbol.observedSymbolLabel || '').replace(/\s+/g, '').slice(0, 12),
                        crop,
                        localBounds: {
                            xStartRatio: Number(symbol.xRatio || 0),
                            yStartRatio: Number(symbol.yRatio || 0),
                            widthRatio: Number(symbol.widthRatio || 0),
                            heightRatio: Number(symbol.heightRatio || 0)
                        },
                        legendSymbol: this.normalizeLegendSymbol({
                        found: symbol.found,
                        pageNumber: crop.pageNumber,
                        xRatio: crop.xStartRatio + (Number(symbol.xRatio || 0) * crop.widthRatio),
                        yRatio: crop.yStartRatio + (Number(symbol.yRatio || 0) * crop.heightRatio),
                        widthRatio: Number(symbol.widthRatio || 0) * crop.widthRatio,
                        heightRatio: Number(symbol.heightRatio || 0) * crop.heightRatio,
                        confidence: symbol.confidence,
                        source: symbol.source
                    })
                    }]
                }))
            const localizedBomActions = result.proposedBomActions.map((proposal) => {
                const focused = localized.get(proposal.proposalId)
                return focused?.legendSymbol.found
                    ? {
                        ...proposal,
                        symbolLabel: focused.observedSymbolLabel || proposal.symbolLabel,
                        legendSymbol: focused.legendSymbol
                    }
                    : proposal
            })
            const proposedBomActions: DocumentAnalysisBomProposal[] = []
            for (const proposal of localizedBomActions) {
                if (!proposal.legendSymbol?.found) {
                    proposedBomActions.push(proposal)
                    continue
                }
                try {
                    const focused = localized.get(proposal.proposalId)
                    if (!focused?.legendSymbol.found) {
                        throw new Error('The focused legend crop was unavailable for preview creation.')
                    }
                    const local = focused.localBounds
                    const paddingLeft = Math.max(0.01, local.widthRatio * 0.4)
                    const paddingRight = Math.max(0.006, local.widthRatio * 0.2)
                    const paddingY = Math.max(0.006, local.heightRatio * 0.2)
                    const previewRegion = {
                        xStartRatio: Math.max(0, local.xStartRatio - paddingLeft),
                        yStartRatio: Math.max(0, local.yStartRatio - paddingY),
                        widthRatio: Math.min(1, local.xStartRatio + local.widthRatio + paddingRight)
                            - Math.max(0, local.xStartRatio - paddingLeft),
                        heightRatio: Math.min(1, local.yStartRatio + local.heightRatio + paddingY)
                            - Math.max(0, local.yStartRatio - paddingY)
                    }
                    const previewCrop = await this.cropImageRegion(focused.crop.imageBuffer, previewRegion)
                    const cleanedPreviewCrop = await this.removeDisconnectedLegendGridLines(previewCrop, {
                        xStartRatio: (local.xStartRatio - previewRegion.xStartRatio) / previewRegion.widthRatio,
                        yStartRatio: (local.yStartRatio - previewRegion.yStartRatio) / previewRegion.heightRatio,
                        widthRatio: local.widthRatio / previewRegion.widthRatio,
                        heightRatio: local.heightRatio / previewRegion.heightRatio
                    })
                    const previewDataUrl = await this.createMaskedIconDataUrl(cleanedPreviewCrop)
                    proposedBomActions.push({
                        ...proposal,
                        legendSymbol: { ...proposal.legendSymbol, previewDataUrl, previewError: '' }
                    })
                } catch (error) {
                    const previewError = error instanceof Error ? error.message : String(error || 'Unable to create glyph preview.')
                    proposedBomActions.push({
                        ...proposal,
                        legendSymbol: { ...proposal.legendSymbol, previewDataUrl: '', previewError }
                    })
                    console.error('[document-inspection] Legend glyph preview creation failed.', {
                        projectId: input.projectId,
                        documentId: input.documentId,
                        proposalId: proposal.proposalId,
                        message: previewError
                    })
                }
            }
            console.info('[document-inspection] Legend glyph localization completed.', {
                projectId: input.projectId,
                documentId: input.documentId,
                responseId: response.id,
                requestId: String((response as any)._request_id || ''),
                candidateCount: candidates.length,
                legendCrops: pageImages.map((page) => ({
                    cropId: page.cropId,
                    pageNumber: page.pageNumber,
                    imageBytes: page.imageBuffer.length,
                    xStartRatio: page.xStartRatio,
                    yStartRatio: page.yStartRatio,
                    widthRatio: page.widthRatio,
                    heightRatio: page.heightRatio
                })),
                modelGlyphResults: (parsed.symbols || []).map((symbol) => ({
                    proposalId: symbol.proposalId,
                    cropId: symbol.cropId,
                    found: !!symbol.found,
                    observedSymbolLabel: symbol.observedSymbolLabel,
                    xRatio: symbol.xRatio,
                    yRatio: symbol.yRatio,
                    widthRatio: symbol.widthRatio,
                    heightRatio: symbol.heightRatio,
                    confidence: symbol.confidence
                })),
                glyphCount: proposedBomActions.filter((proposal) => proposal.legendSymbol?.found).length,
                previewCount: proposedBomActions.filter((proposal) => !!proposal.legendSymbol?.previewDataUrl).length
            })
            return { ...result, proposedBomActions }
        } catch (error) {
            if (input.signal?.aborted) throw error
            console.error('[document-inspection] Focused legend glyph localization failed; preserving whole-document findings.', {
                projectId: input.projectId,
                documentId: input.documentId,
                message: error instanceof Error ? error.message : String(error || '')
            })
            return result
        }
    }

    private async renderPdfPageToPng(buffer: Buffer, pageNumber: number, targetLongEdge: number): Promise<Buffer> {
        const { PDFiumLibrary } = await import('@hyzyla/pdfium')
        const library = await PDFiumLibrary.init()
        const document = await library.loadDocument(new Uint8Array(buffer))
        try {
            if (pageNumber < 1 || pageNumber > document.getPageCount()) {
                throw new DocumentAnalysisInputError(`PDF page ${pageNumber} is unavailable for rendering.`, 409)
            }
            const page = document.getPage(pageNumber - 1)
            const originalSize = page.getOriginalSize()
            const scale = Math.max(1, Math.min(12, targetLongEdge / Math.max(originalSize.originalWidth, originalSize.originalHeight)))
            const image = await page.render({
                scale,
                render: async(options) => sharp(options.data, {
                    raw: { width: options.width, height: options.height, channels: 4 }
                }).png().toBuffer()
            })
            return Buffer.from(image.data)
        } finally {
            document.destroy()
            library.destroy()
        }
    }

    private async cropImageRegion(
        imageBuffer: Buffer,
        region: { xStartRatio: number, yStartRatio: number, widthRatio: number, heightRatio: number }
    ): Promise<Buffer> {
        const metadata = await sharp(imageBuffer).metadata()
        const imageWidth = Math.max(1, Number(metadata.width || 0))
        const imageHeight = Math.max(1, Number(metadata.height || 0))
        const left = Math.max(0, Math.min(imageWidth - 1, Math.floor(region.xStartRatio * imageWidth)))
        const top = Math.max(0, Math.min(imageHeight - 1, Math.floor(region.yStartRatio * imageHeight)))
        const right = Math.max(left + 1, Math.min(imageWidth, Math.ceil((region.xStartRatio + region.widthRatio) * imageWidth)))
        const bottom = Math.max(top + 1, Math.min(imageHeight, Math.ceil((region.yStartRatio + region.heightRatio) * imageHeight)))
        return sharp(imageBuffer)
            .extract({ left, top, width: right - left, height: bottom - top })
            .png()
            .toBuffer()
    }

    private async removeDisconnectedLegendGridLines(
        imageBuffer: Buffer,
        protectedRegion: { xStartRatio: number, yStartRatio: number, widthRatio: number, heightRatio: number }
    ): Promise<Buffer> {
        const { data, info } = await sharp(imageBuffer)
            .flatten({ background: '#ffffff' })
            .removeAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true })
        const width = info.width
        const height = info.height
        if (width < 2 || height < 2) return imageBuffer

        // One raster pixel absorbs coordinate rounding. Larger safety expansion can pull a
        // nearby table rule into the protected area, especially above compact CD labels.
        const safetyX = 1 / width
        const safetyY = 1 / height
        const protectedLeft = Math.max(0, Math.floor((protectedRegion.xStartRatio - safetyX) * width))
        const protectedTop = Math.max(0, Math.floor((protectedRegion.yStartRatio - safetyY) * height))
        const protectedRight = Math.min(width, Math.ceil((protectedRegion.xStartRatio + protectedRegion.widthRatio + safetyX) * width))
        const protectedBottom = Math.min(height, Math.ceil((protectedRegion.yStartRatio + protectedRegion.heightRatio + safetyY) * height))
        const pixelCount = width * height
        const ink = new Uint8Array(pixelCount)
        const visited = new Uint8Array(pixelCount)
        for (let pixel = 0; pixel < pixelCount; pixel += 1) {
            const offset = pixel * 3
            ink[pixel] = Math.min(data[offset], data[offset + 1], data[offset + 2]) < 245 ? 1 : 0
        }

        let retainedInkPixels = 0
        const neighbors = [[-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1]] as const
        for (let start = 0; start < pixelCount; start += 1) {
            if (!ink[start] || visited[start]) continue
            const component: number[] = []
            const queue = [start]
            visited[start] = 1
            let intersectsProtectedRegion = false
            for (let cursor = 0; cursor < queue.length; cursor += 1) {
                const pixel = queue[cursor]
                component.push(pixel)
                const x = pixel % width
                const y = Math.floor(pixel / width)
                if (x >= protectedLeft && x < protectedRight && y >= protectedTop && y < protectedBottom) {
                    intersectsProtectedRegion = true
                }
                for (const [dx, dy] of neighbors) {
                    const nextX = x + dx
                    const nextY = y + dy
                    if (nextX < 0 || nextX >= width || nextY < 0 || nextY >= height) continue
                    const next = (nextY * width) + nextX
                    if (!ink[next] || visited[next]) continue
                    visited[next] = 1
                    queue.push(next)
                }
            }
            if (intersectsProtectedRegion) {
                retainedInkPixels += component.length
                continue
            }
            for (const pixel of component) {
                const offset = pixel * 3
                data[offset] = 255
                data[offset + 1] = 255
                data[offset + 2] = 255
            }
        }

        // A malformed provider rectangle must not turn a valid preview blank. Preserve the
        // original crop when no meaningful glyph component intersected the protected area.
        if (retainedInkPixels < 12) return imageBuffer
        return sharp(data, { raw: { width, height, channels: 3 } }).png().toBuffer()
    }

    private async createLegendLocalizationRegions(
        buffer: Buffer,
        requestedPageNumbers: number[]
    ): Promise<Array<{
        cropId: string
        pageNumber: number
        xStartRatio: number
        yStartRatio: number
        widthRatio: number
        heightRatio: number
    }>> {
        const sourcePdf = await PDFDocument.load(buffer)
        const preferredPageNumbers = [...new Set(requestedPageNumbers)]
            .filter((pageNumber) => pageNumber >= 1 && pageNumber <= sourcePdf.getPageCount())
        const preferredPageSet = new Set(preferredPageNumbers)
        // Legend citations from the broad pass are advisory: schedule-heavy sheets can be
        // mis-cited. Text-scan every page, but retain whole-page fallbacks only for the
        // preferred pages when the document has no explicit legend heading at all.
        const pageNumbers = [...new Set([
            ...preferredPageNumbers,
            ...Array.from({ length: sourcePdf.getPageCount() }, (_, index) => index + 1)
        ])]
        Object.assign(globalThis, {
            DOMMatrix: (globalThis as any).DOMMatrix || DOMMatrix,
            ImageData: (globalThis as any).ImageData || ImageData,
            Path2D: (globalThis as any).Path2D || Path2D
        })
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true, useSystemFonts: true } as any)
        const textPdf = await loadingTask.promise
        const pages: Array<{
            cropId: string
            pageNumber: number
            xStartRatio: number
            yStartRatio: number
            widthRatio: number
            heightRatio: number
        }> = []
        const fullPageFallbacks: typeof pages = []
        try {
            for (const pageNumber of pageNumbers) {
                const textPage = await textPdf.getPage(pageNumber)
                const viewport = textPage.getViewport({ scale: 1 })
                const textContent = await textPage.getTextContent()
                const textItems = (textContent.items || []).flatMap((item: any) => {
                const text = String(item?.str || '').replace(/\s+/g, ' ').trim()
                if (!text || !Array.isArray(item?.transform)) return []
                const transformed = (pdfjs as any).Util.transform(viewport.transform, item.transform)
                const height = Math.max(1, Math.abs(Number(item.height || transformed[3] || 0)))
                return [{
                    text,
                    normalized: text.toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(),
                    x: Number(transformed[4] || 0),
                    y: Number(transformed[5] || 0) - height,
                    width: Math.max(1, Number(item.width || 0)),
                    height
                }]
                })
                const headings = textItems.flatMap((item) => {
                if (!/\b(symbols|legend)\b/.test(item.normalized)) return []
                // A drawing-wide device legend is often titled only "SYMBOL LEGEND".
                // Accept that exact semantic heading without requiring the discipline on
                // the same line, while excluding wire/riser/hatch keys that cannot supply
                // reusable device glyphs.
                if (/\b(wire|wiring|circuit|riser|hatch|line|cable|conduit|color)\b/.test(item.normalized)) return []
                if (/\b(symbol legend|legend of symbols|symbol schedule|device legend|equipment legend)\b/.test(item.normalized)) {
                    return [item]
                }
                if (/\b(fire|alarm|device|equipment|sprinkler|security)\b/.test(item.normalized)) {
                    return [item]
                }
                const sameLine = textItems.filter((candidate) =>
                    Math.abs((candidate.y + (candidate.height / 2)) - (item.y + (item.height / 2)))
                        <= Math.max(item.height, candidate.height) * 1.25
                    && candidate.x <= item.x + item.width + (viewport.width * 0.25)
                    && candidate.x + candidate.width >= item.x - (viewport.width * 0.25))
                const normalizedLine = sameLine.map((candidate) => candidate.normalized).join(' ')
                if (!/\b(fire|alarm|device|equipment|sprinkler|security)\b/.test(normalizedLine)) return []
                const left = Math.min(...sameLine.map((candidate) => candidate.x))
                const right = Math.max(...sameLine.map((candidate) => candidate.x + candidate.width))
                const top = Math.min(...sameLine.map((candidate) => candidate.y))
                const bottom = Math.max(...sameLine.map((candidate) => candidate.y + candidate.height))
                return [{ ...item, x: left, y: top, width: right - left, height: bottom - top }]
                })
                const regions = headings.length > 0
                    ? headings.slice(0, 4).flatMap((heading) => this.splitDenseLegendRegion(
                        this.getLegendTableRegion(heading, textItems, viewport.width, viewport.height),
                        viewport.height
                    ))
                    : [{ x: 0, y: 0, width: viewport.width, height: viewport.height }]
                for (let regionIndex = 0; regionIndex < regions.length; regionIndex += 1) {
                    const region = regions[regionIndex]
                    const leftRatio = Math.max(0, region.x / viewport.width)
                    const topRatio = Math.max(0, region.y / viewport.height)
                    const rightRatio = Math.min(1, (region.x + region.width) / viewport.width)
                    const bottomRatio = Math.min(1, (region.y + region.height) / viewport.height)
                    const destination = headings.length > 0
                        ? pages
                        : (preferredPageSet.has(pageNumber) ? fullPageFallbacks : null)
                    destination?.push({
                        cropId: `page-${pageNumber}-legend-${regionIndex + 1}`,
                        pageNumber,
                        xStartRatio: leftRatio,
                        yStartRatio: topRatio,
                        widthRatio: rightRatio - leftRatio,
                        heightRatio: bottomRatio - topRatio
                    })
                }
            }
        } finally {
            await textPdf.destroy()
        }
        // When at least one explicit legend heading was found, omit unrelated full-sheet
        // fallbacks so the vision pass cannot be diluted by tiny symbols elsewhere.
        return pages.length > 0 ? pages : fullPageFallbacks
    }

    private getLegendTableRegion(
        heading: { x: number, y: number, width: number, height: number },
        items: Array<{ x: number, y: number, width: number, height: number, normalized?: string }>,
        pageWidth: number,
        pageHeight: number
    ): { x: number, y: number, width: number, height: number } {
        // Legend titles are commonly centered over a table substantially wider than the
        // heading text. The wider seed is required to retain the complete first SYMBOL
        // column; a title-width crop can cut the left side from boxed labels such as LCD.
        const columnHeaders = items
            .filter((item) => item.y >= heading.y - (heading.height * 0.5))
            .filter((item) => item.y <= heading.y + Math.max(pageHeight * 0.09, heading.height * 8))
            .filter((item) => {
                const headingCenter = heading.x + (heading.width / 2)
                return item.x + item.width >= headingCenter - (pageWidth * 0.24)
                    && item.x <= headingCenter + (pageWidth * 0.24)
            })
            .filter((item) => /\b(symbol|part|number|description|model|manufacturer|back box|mounting|height|quantity|qty)\b/.test(item.normalized || ''))
        const hasSymbolColumnHeader = columnHeaders.some((item) => /\bsymbol\b/.test(item.normalized || ''))
        const useColumnHeaderBounds = hasSymbolColumnHeader && columnHeaders.length >= 3
        const initialLeft = useColumnHeaderBounds
            ? Math.max(0, Math.min(...columnHeaders.map((item) => item.x)) - (pageWidth * 0.01))
            : Math.max(0, heading.x - Math.max(heading.width * 0.45, pageWidth * 0.04))
        const initialRight = useColumnHeaderBounds
            ? Math.min(pageWidth, Math.max(...columnHeaders.map((item) => item.x + item.width)) + (pageWidth * 0.01))
            : Math.min(pageWidth, heading.x + heading.width + Math.max(heading.width * 0.45, pageWidth * 0.04))
        const candidateItems = items
            .filter((item) => item.y >= heading.y - (heading.height * 1.5))
            .filter((item) => item.y <= Math.min(pageHeight, heading.y + (pageHeight * 0.55)))
            .filter((item) => item.x + item.width >= initialLeft && item.x <= initialRight)
            .sort((a, b) => a.y - b.y)
        const linePositions = [...new Set(candidateItems.map((item) => Math.round(item.y)))].sort((a, b) => a - b)
        let tableBottom = Math.min(pageHeight, heading.y + (pageHeight * 0.48))
        let previousY = heading.y
        for (const y of linePositions.filter((value) => value >= heading.y)) {
            const gap = y - previousY
            if (previousY > heading.y + (pageHeight * 0.08) && gap > Math.max(pageHeight * 0.055, heading.height * 5)) {
                tableBottom = previousY + (heading.height * 3)
                break
            }
            previousY = y
        }
        const tableItems = candidateItems.filter((item) => item.y <= tableBottom)
        const minX = useColumnHeaderBounds
            ? initialLeft
            : Math.max(0, Math.min(initialLeft, ...tableItems.map((item) => item.x)) - (pageWidth * 0.012))
        const maxX = useColumnHeaderBounds
            ? initialRight
            : Math.min(pageWidth, Math.max(initialRight, ...tableItems.map((item) => item.x + item.width)) + (pageWidth * 0.012))
        const top = Math.max(0, heading.y - Math.max(heading.height * 1.5, pageHeight * 0.01))
        const bottom = Math.min(pageHeight, tableBottom + Math.max(heading.height * 2, pageHeight * 0.015))
        return { x: minX, y: top, width: Math.max(1, maxX - minX), height: Math.max(1, bottom - top) }
    }

    private splitDenseLegendRegion(
        region: { x: number, y: number, width: number, height: number },
        pageHeight: number
    ): Array<{ x: number, y: number, width: number, height: number }> {
        const maximumBandHeight = pageHeight * 0.24
        if (region.height <= maximumBandHeight * 1.2) return [region]

        const overlap = pageHeight * 0.018
        const step = maximumBandHeight - overlap
        const bottom = region.y + region.height
        const bands: Array<{ x: number, y: number, width: number, height: number }> = []
        for (let top = region.y; top < bottom; top += step) {
            const height = Math.min(maximumBandHeight, bottom - top)
            bands.push({ x: region.x, y: top, width: region.width, height })
            if (top + height >= bottom) break
        }
        return bands
    }

    private isInvalidReportScopeProposal(
        proposal: DocumentAnalysisProjectDetailProposal,
        bomProposals: DocumentAnalysisBomProposal[]
    ): boolean {
        if (proposal.targetField !== 'reportSettings.inclusions' && proposal.targetField !== 'reportSettings.exclusions') {
            return false
        }
        const sourceArea = [proposal.source?.section, proposal.source?.location].join(' ').toLocaleLowerCase()
        if (/\b(symbol|device|equipment)\s+(legend|schedule)|\bbom\b|bill of materials/.test(sourceArea)) {
            return true
        }
        const lines = String(proposal.proposedValue || '').split(/\r?\n|\s*;\s*/)
            .map((line) => this.normalizeMatchText(line.replace(/^[^a-zA-Z0-9]+/, '')))
            .filter(Boolean)
        if (lines.length < 2) return false
        const deviceTerms = bomProposals.flatMap((item) => [
            item.deviceType, item.description, item.partNumber, item.modelNumber
        ]).map((value) => this.normalizeMatchText(value)).filter(Boolean)
        const deviceLineCount = lines.filter((line) => deviceTerms.some((term) =>
            term.length >= 4 && (line.includes(term) || term.includes(line)))).length
        return deviceLineCount >= 2 && deviceLineCount / lines.length >= 0.5
    }

    private normalizeFloorplanProposals(
        proposals: DocumentAnalysisFloorplanProposal[],
        rawBomProposals: DocumentAnalysisBomProposal[]
    ): DocumentAnalysisFloorplanProposal[] {
        const normalized: DocumentAnalysisFloorplanProposal[] = []
        const seenPages = new Set<number>()
        for (const proposal of proposals) {
            const pageNumber = Math.max(1, Math.floor(Number(proposal.pageNumber || 0)))
            const name = String(proposal.name || '').replace(/\s+/g, ' ').trim().slice(0, 180)
            if (!name || seenPages.has(pageNumber)) continue
            seenPages.add(pageNumber)
            const proposalId = `floorplan-proposal-${normalized.length + 1}`
            const symbolPlacements = (proposal.symbolPlacements || []).map((placement, index) => {
                const matchedBom = rawBomProposals.find((candidate) => {
                    const candidateIds = [candidate.partNumber, candidate.modelNumber, candidate.symbolLabel, candidate.deviceType]
                        .map((value) => this.normalizeMatchText(value)).filter(Boolean)
                    const placementIds = [placement.partNumber, placement.modelNumber, placement.symbolLabel, placement.deviceType]
                        .map((value) => this.normalizeMatchText(value)).filter(Boolean)
                    return placementIds.some((value) => candidateIds.includes(value))
                })
                return {
                    ...placement,
                    placementId: `${proposalId}-placement-${index + 1}`,
                    bomProposalId: matchedBom?.proposalId || '',
                    xRatio: Math.max(0, Math.min(1, Number(placement.xRatio || 0))),
                    yRatio: Math.max(0, Math.min(1, Number(placement.yRatio || 0))),
                    confidence: Math.max(0, Math.min(1, Number(placement.confidence || 0)))
                }
            }).filter((placement) => !!placement.bomProposalId && placement.confidence >= 0.65)
            normalized.push({
                ...proposal,
                proposalId,
                name,
                pageNumber,
                symbolPlacements
            })
        }
        return normalized
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
            } else if (proposal.floorplanSymbolFound) {
                // A legend is authoritative evidence that the device belongs to the drawing set,
                // even when the first pass cannot reliably count its plan instances. Keep the
                // candidate available for catalog/BOM review with a clearly provisional unit.
                quantityStatus = 'LEGEND_ONLY'
                reconciledQuantity = 1
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
            const floorplanPlacementTarget = proposal.floorplanSymbolFound
                && quantityStatus !== 'LEGEND_ONLY'
                && reconciledQuantity > 0
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
                quantityRationale: quantityStatus === 'LEGEND_ONLY'
                    ? `Legend-derived device candidate. A provisional BOM quantity of 1 is suggested because no reliable schedule or plan count was found. ${String(proposal.quantityRationale || '').trim()}`.trim()
                    : proposal.quantityRationale,
                legendSymbol: this.normalizeLegendSymbol(proposal.legendSymbol),
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

    private normalizeLegendSymbol(symbol: DocumentAnalysisBomProposal['legendSymbol']): DocumentAnalysisBomProposal['legendSymbol'] {
        const xRatio = Math.max(0, Math.min(1, Number(symbol?.xRatio || 0)))
        const yRatio = Math.max(0, Math.min(1, Number(symbol?.yRatio || 0)))
        const widthRatio = Math.max(0, Math.min(1 - xRatio, Number(symbol?.widthRatio || 0)))
        const heightRatio = Math.max(0, Math.min(1 - yRatio, Number(symbol?.heightRatio || 0)))
        const found = !!symbol?.found
            && Math.floor(Number(symbol.pageNumber || 0)) > 0
            && widthRatio > 0
            && heightRatio > 0
        return {
            ...symbol,
            found,
            pageNumber: found ? Math.floor(Number(symbol.pageNumber)) : 0,
            xRatio,
            yRatio,
            widthRatio,
            heightRatio,
            confidence: Math.max(0, Math.min(1, Number(symbol?.confidence || 0))),
            source: symbol?.source || { filename: '', page: '', section: '', location: '' }
        }
    }

    private normalizeMatchText(value: unknown): string {
        return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    }

    private getProjectContextValue(context: DocumentAnalysisProjectContext, targetField: DocumentAnalysisProjectField): string {
        if (targetField.startsWith('customerInfo.')) {
            const customerField = targetField.slice('customerInfo.'.length) as keyof DocumentAnalysisProjectContext['customerInfo']
            return String(context.customerInfo[customerField] || '')
        }
        if (targetField.startsWith('reportSettings.')) {
            const reportField = targetField.slice('reportSettings.'.length) as keyof DocumentAnalysisProjectContext['reportSettings']
            return String(context.reportSettings[reportField] || '')
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
        if (error instanceof APIConnectionTimeoutError) {
            return new DocumentAnalysisProviderError(
                'OpenAI did not complete this inspection stage within the configured request time. Increase OPENAI_TIMEOUT_MS for slower models, then try again.',
                504,
                'OPENAI_REQUEST_TIMED_OUT',
                true
            )
        }
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
            'Treat project address as the construction/site location. Treat customerInfo as the paying client, owner, general contractor, or contracting business. Never copy the site name or site address into customerInfo unless the document explicitly identifies it as customer or billing information.',
            'Look for customer and billing evidence in cover sheets, title blocks, proposals, contracts, purchase orders, distribution/contact blocks, and owner/architect/contractor information. Propose billingName, businessPointOfContactName, billingAddress, billingEmail, billingPhone, and contractOrPoNumber independently whenever explicitly supported.',
            'Extract explicit contractual scope inclusions and exclusions into scope.inclusions and scope.exclusions. These are promised work, services, responsibilities, deliverables, boundaries, and expressly excluded work—not an equipment takeoff.',
            'Never copy individual devices, parts, model numbers, quantities, equipment schedules, symbol legends, or BOM candidates into reportSettings.inclusions or reportSettings.exclusions. Those belong only in proposedBomActions. A document statement such as provide and install a complete fire alarm system may be one scope inclusion, but its panel, annunciator, detector, module, and notification-appliance list must remain BOM data.',
            'Only propose reportSettings.inclusions and reportSettings.exclusions from explicit scope, contract, proposal, specification, responsibility, or exclusion language when supported items differ from the supplied project context. Use one complete contractual scope statement per line in proposedValue, preserve qualifiers, and do not turn assumptions into inclusions or exclusions.',
            'Do not infer exclusions from omissions. Only extract an exclusion when the document expressly states excluded, by others, owner-furnished, not in contract, NIC, or equivalent responsibility language.',
            'Do not propose salesman, project status, difficulty, coordinates, code applicability, or any field that is not in the schema.',
            'A project-detail proposal must preserve evidenceType, confidence, rationale, and source provenance. Prefer DOCUMENT_FACT; make interpretations visibly AI_INTERPRETATION.',
            'proposedBomActions extracts device candidates and quantities for later human review. Do not claim a BOM row was created.',
            'Create a BOM proposal when the document provides a positive schedule quantity, a positive drawing symbol count, or a distinct device entry in a symbol/device legend. Do not omit a legend device merely because its plan quantity cannot yet be counted.',
            'Inspect every symbol, device, equipment, and annunciation legend exhaustively, row by row. Capture the printed symbol label, description, manufacturer, model, part number, and source location separately. Ignore wire-only line types, room labels, drafting marks, and non-device abbreviations.',
            'Treat a general symbol/device legend as a document-wide reference for every proposed floorplan unless the document explicitly limits that legend to a particular sheet, level, sector, or area.',
            'For each BOM proposal, populate legendSymbol from the actual example glyph printed in the legend. Coordinates are a tight bounding rectangle around only the glyph artwork, normalized from 0 to 1 across the full PDF page from top-left. Do not include the row description, quantity, part number, or neighboring legend marks. Set found false, pageNumber 0, all coordinates 0, and an empty source when no distinct legend glyph is visible.',
            'For a legend-only device with no reliable schedule or drawing count, set both quantity Found flags false and quantities 0, set quantityStatus UNKNOWN and reconciledQuantity 0, set floorplanSymbolFound true, and explain that it is legend-derived. The server will retain it as a reviewable provisional BOM candidate.',
            'Return at most one BOM proposal per unique device/equipment identity. Use whole-document totals when the same device appears on multiple plan pages.',
            'Keep scheduleQuantity and drawingQuantity as separate evidence. Set the corresponding Found boolean false and quantity 0 when that evidence was not located.',
            'drawingQuantity counts actual device-symbol placements in plan areas. Exclude symbols shown only in legends, schedules, details, examples, or title blocks.',
            'If schedule and drawing quantities disagree, use CONFLICT and reconciledQuantity 0. Never silently choose one count.',
            'If both quantities agree, use MATCHED. If only one exists, use SCHEDULE_ONLY or DRAWING_ONLY. The server will validate this reconciliation again.',
            'floorplanSymbolFound means the document contains a floorplan symbol or legend mark for this device. A legend-only mark supports device discovery but not a placement coordinate. floorplanPlacementTarget may equal reconciledQuantity only when actual plan symbols were counted and there is no quantity conflict.',
            'Use empty proposalId and a NOT_EVALUATED catalogMatch with entityType NONE and blank match fields; Firewire will assign proposal identity and perform catalog matching after extraction.',
            'proposedFloorplanActions identifies every distinct plan sheet/page that can become a Firewire floorplan. Return one proposal per plan page, because a document may contain multiple floorplans.',
            'Only propose a floorplan for a PDF page that visibly contains a usable plan drawing. Use the printed sheet title or drawing number as name, pageNumber as the one-based PDF page number, and preserve source provenance.',
            'For every actual device symbol visible inside that plan area, add one symbolPlacements item at the center of the symbol. xRatio and yRatio are normalized from 0 to 1 across the full PDF page, from top-left.',
            'Exclude legend examples, schedules, details, title-block symbols, and uncertain marks from symbolPlacements. Do not approximate a location that cannot be seen.',
            'Use empty placementId and bomProposalId; Firewire assigns stable IDs and links placements to normalized BOM proposals after extraction.',
            'Keep manufacturer, modelNumber, and partNumber separate. partNumber must contain only the equipment identifier as printed, for example N-ANN-80, and must not be prefixed with manufacturer, category, or description text.',
            'Do not merge different device types merely because they have the same quantity. Preserve symbol label, manufacturer, model, part number, description, and separate schedule/drawing provenance.',
            'Risks are professional review aids, not legal, engineering, contractual, or AHJ determinations.'
        ].join('\n')
    }
}
