import Ajv, { ValidateFunction } from 'ajv'
import OpenAI, { APIError, toFile } from 'openai'
import { PDFDocument } from 'pdf-lib'
import sharp from 'sharp'

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

    async analyzeFloorplanDiagnostic(input: AnalyzeFloorplanDiagnosticInput): Promise<FloorplanDiagnosticResult> {
        this.validateConfiguration()
        if (!input.buffer.length) throw new DocumentAnalysisInputError('The floorplan has no readable content.', 400)
        const client = new OpenAI({ apiKey: this.apiKey, timeout: Number(process.env.OPENAI_TIMEOUT_MS || 180000) })
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
            timeout: Number(process.env.OPENAI_TIMEOUT_MS || 180000)
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
        let fileId = ''
        try {
            const uploadedFile = await client.files.create({
                file: await toFile(tile.buffer, `tile-${tile.pageNumber}-${input.filename}`, { type: 'application/pdf' }),
                purpose: 'user_data',
                expires_after: { anchor: 'created_at', seconds: 24 * 60 * 60 }
            }, { signal: input.signal })
            fileId = uploadedFile.id
            const response = await client.responses.create({
                model: this.model,
                store: false,
                instructions: [
                    'You are exhaustively locating fire alarm, sprinkler, or electronic security device symbols in one enlarged crop of a construction floorplan.',
                    'Inspect every supported candidate one at a time and return one placement for every actual matching device graphic visible in this crop.',
                    'Small repeated green symbols connected by green circuit lines are real device marks and must be counted. Red and other colored device graphics are also eligible.',
                    'Use printed symbol shape, abbreviation, nearby device tag, and candidate description together. Do not require a symbol to have the same color as its Firewire bubble.',
                    'Expected project quantity is a recall aid for the entire drawing, not a required count for this crop. Never invent marks to reach it.',
                    'Exclude legend examples, schedules, title blocks, details, notes, room labels, circuit text, and wire junctions that are not device symbols.',
                    'xRatio and yRatio must be the center of the colored device graphic in this one-page crop, normalized from 0 to 1 from top-left. Do not center on adjacent text.',
                    'source.page must be "1" because the supplied PDF has exactly one crop page.',
                    'Use only a supplied proposalId, copy its identity fields, and use empty placementId. Return an empty array only after checking every candidate across the entire crop.',
                    `This is crop ${tile.pageNumber} of ${tileCount} from original PDF page ${input.sourcePageNumber}. Use ${JSON.stringify(input.filename)} in source.filename.`
                ].join('\n'),
                input: [{
                    role: 'user',
                    content: [
                        { type: 'input_file', file_id: fileId, detail: 'high' },
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
        } finally {
            if (fileId) {
                try {
                    await client.files.delete(fileId)
                } catch (cleanupError) {
                    console.error('OpenAI focused floorplan tile temporary file cleanup failed.', {
                        fileId,
                        tilePage: tile.pageNumber,
                        message: cleanupError instanceof Error ? cleanupError.message : String(cleanupError || '')
                    })
                }
            }
        }
    }

    private async createFloorplanAnalysisTiles(buffer: Buffer): Promise<{ tiles: FloorplanAnalysisTile[] }> {
        const sourcePdf = await PDFDocument.load(buffer)
        if (sourcePdf.getPageCount() !== 1) {
            throw new DocumentAnalysisInputError('Focused floorplan location analysis requires a one-page PDF floorplan.', 409)
        }
        const sourcePage = sourcePdf.getPage(0)
        const { x: cropX, y: cropY, width, height } = sourcePage.getCropBox()
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
                const tileWidth = width * (xEndRatio - xStartRatio)
                const tileHeight = height * (yEndRatio - yStartRatio)
                const pdfYBottom = height * (1 - yEndRatio)
                const outputPdf = await PDFDocument.create()
                const embedded = await outputPdf.embedPage(sourcePage, {
                    left: cropX + (width * xStartRatio),
                    bottom: cropY + pdfYBottom,
                    right: cropX + (width * xEndRatio),
                    top: cropY + pdfYBottom + tileHeight
                })
                const outputPage = outputPdf.addPage([tileWidth, tileHeight])
                outputPage.drawPage(embedded, { x: 0, y: 0, width: tileWidth, height: tileHeight })
                pageNumber += 1
                tiles.push({
                    pageNumber,
                    buffer: Buffer.from(await outputPdf.save()),
                    xStartRatio,
                    yStartRatio,
                    widthRatio: xEndRatio - xStartRatio,
                    heightRatio: yEndRatio - yStartRatio
                })
            }
        }
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
            timeout: Number(process.env.OPENAI_TIMEOUT_MS || 180000)
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
            await this.reportOpenAiFileUploaded(input, openAiFileId)
            await this.reportProgress(input, 'uploaded', 'Document uploaded. Starting structured analysis.', 50)

            await this.reportProgress(input, 'analyzing', 'OpenAI is reading the document and extracting grounded findings.', 60)
            const configuredMaxOutputTokens = Number(process.env.OPENAI_DOCUMENT_MAX_OUTPUT_TOKENS || 30000)
            const maxOutputTokens = Number.isFinite(configuredMaxOutputTokens)
                ? Math.max(12000, Math.floor(configuredMaxOutputTokens))
                : 30000
            const response = await this.withAnalysisHeartbeat(input, () => client.responses.create({
                model: this.model,
                store: false,
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
