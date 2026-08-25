import * as express from 'express'
import { randomUUID } from 'node:crypto'
import { PDFDocument } from 'pdf-lib'

import { SqlDb } from '../../fieldwire/repository/sqldb'
import {
    DOCUMENT_INSPECTION_SCHEMA_VERSION
} from '../ai/document-analysis.schema'
import {
    DocumentAnalysisActionApplication,
    DocumentAnalysisBomActionApplication,
    DocumentAnalysisBomProposal,
    DocumentAnalysisDeviceCreationApplication,
    DocumentAnalysisFloorplanApplication,
    DocumentAnalysisFloorplanPlacementApplication,
    DocumentAnalysisFloorplanProposal,
    DocumentAnalysisRecord,
    DocumentAnalysisProgress,
    DocumentAnalysisProjectDetailProposal,
    DocumentAnalysisProjectField,
    DocumentAnalysisWorkspace
} from '../ai/document-analysis.types'
import {
    DocumentAnalysisConfigurationError,
    DocumentAnalysisInputError,
    DocumentAnalysisProviderError,
    OpenAiDocumentAnalysisService
} from '../ai/openai-document-analysis.service'
import { FirewireProjectRecord, FirewireProjectRepository } from '../repository/firewireproject.repository'
import { AzureBlobDocumentStorage } from './azure-blob-document-storage'
import { FirewireData } from './firewire.data'

const DOCUMENT_ANALYSIS_AREA = 'project-document-analysis'
const DOCUMENT_LIBRARY_AREA = 'project-doc-library'

type DocumentLibraryVersion = {
    id?: string
    versionNumber?: number
    uploadedAt?: string
    uploadedBy?: string
    sourceFileName?: string
    mimeType?: string
    sizeBytes?: number
    blobName?: string
    blobContainerName?: string
    dataUrl?: string
    lastModified?: number
}

type DocumentLibraryFile = {
    id?: string
    folderId?: string
    documentKind?: string
    storageKey?: string
    extension?: string
    name?: string
    sourceFileName?: string
    createdAt?: string
    updatedAt?: string
    floorplanDesign?: any
    sourceAnalysisId?: string
    sourceDocumentId?: string
    sourceDocumentVersionId?: string
    versions?: DocumentLibraryVersion[]
}

export class FirewireDocumentAnalysisData {
    private static readonly runningInspections = new Set<string>()
    private static readonly runningInspectionControllers = new Map<string, AbortController>()
    private static readonly activeOpenAiFileIds = new Map<string, string>()
    private static readonly userCancelledInspections = new Set<string>()
    private static readonly deletingProjectIds = new Set<string>()
    private static readonly deletedProjectIds = new Set<string>()

    static async prepareProjectDeletion(app: express.Application, projectId: string): Promise<{
        deletedOpenAiFileCount: number
        missingOpenAiFileCount: number
    }> {
        const normalizedProjectId = String(projectId || '').trim()
        FirewireDocumentAnalysisData.deletingProjectIds.add(normalizedProjectId)

        for (const [inspectionKey, controller] of FirewireDocumentAnalysisData.runningInspectionControllers) {
            if (FirewireDocumentAnalysisData.inspectionKeyBelongsToProject(inspectionKey, normalizedProjectId)) {
                FirewireDocumentAnalysisData.userCancelledInspections.add(inspectionKey)
                controller.abort()
            }
        }

        const waitStartedAt = Date.now()
        while ([...FirewireDocumentAnalysisData.runningInspections]
            .some((inspectionKey) => FirewireDocumentAnalysisData.inspectionKeyBelongsToProject(inspectionKey, normalizedProjectId))) {
            if (Date.now() - waitStartedAt > 30000) {
                throw new DocumentAnalysisInputError(
                    'An active document inspection did not stop in time. Retry project deletion after the inspection finishes.',
                    409
                )
            }
            await new Promise((resolve) => setTimeout(resolve, 50))
        }

        const sqldb = new SqlDb(app)
        const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(sqldb, normalizedProjectId)
        const persistedOpenAiFileIds = workspace.analyses
            .filter((record) => record.openAiFileId && !record.openAiFileDeletedAt)
            .map((record) => record.openAiFileId)
        const activeOpenAiFileIds = [...FirewireDocumentAnalysisData.activeOpenAiFileIds]
            .filter(([inspectionKey]) => FirewireDocumentAnalysisData.inspectionKeyBelongsToProject(inspectionKey, normalizedProjectId))
            .map(([, fileId]) => fileId)
        const retainedOpenAiFileIds = [...new Set([...persistedOpenAiFileIds, ...activeOpenAiFileIds])]
        const cleanup = await new OpenAiDocumentAnalysisService().deleteTemporaryFiles(retainedOpenAiFileIds)
        for (const [inspectionKey, fileId] of FirewireDocumentAnalysisData.activeOpenAiFileIds) {
            if (FirewireDocumentAnalysisData.inspectionKeyBelongsToProject(inspectionKey, normalizedProjectId)
                && retainedOpenAiFileIds.includes(fileId)) {
                FirewireDocumentAnalysisData.activeOpenAiFileIds.delete(inspectionKey)
            }
        }
        return {
            deletedOpenAiFileCount: cleanup.deletedFileIds.length,
            missingOpenAiFileCount: cleanup.missingFileIds.length
        }
    }

    static completeProjectDeletion(projectId: string): void {
        const normalizedProjectId = String(projectId || '').trim()
        FirewireDocumentAnalysisData.deletingProjectIds.delete(normalizedProjectId)
        FirewireDocumentAnalysisData.deletedProjectIds.add(normalizedProjectId)
    }

    static cancelProjectDeletion(projectId: string): void {
        FirewireDocumentAnalysisData.deletingProjectIds.delete(String(projectId || '').trim())
    }

    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }

                    const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
                    let record = workspace.analyses.find((item) =>
                        item.workspaceKey === context.workspaceKey
                        && item.documentId === context.file.id
                        && item.versionId === context.version.id)
                    if (!record) {
                        return res.status(200).json({ data: null })
                    }

                    const inspectionKey = FirewireDocumentAnalysisData.getInspectionKey(
                        context.project.uuid,
                        context.workspaceKey,
                        context.file.id,
                        context.version.id
                    )
                    const requestedAtMs = new Date(record.requestedAt).getTime()
                    const maxRuntimeMs = Math.max(60_000, Number(process.env.DOCUMENT_INSPECTION_MAX_RUNTIME_MS || 300_000))
                    const runtimeExpired = record.status === 'running'
                        && Number.isFinite(requestedAtMs)
                        && Date.now() - requestedAtMs > maxRuntimeMs
                    if (record.status === 'running'
                        && (!FirewireDocumentAnalysisData.runningInspections.has(inspectionKey) || runtimeExpired)) {
                        if (runtimeExpired) {
                            FirewireDocumentAnalysisData.runningInspectionControllers.get(inspectionKey)?.abort()
                        }
                        record = {
                            ...record,
                            status: 'failed',
                            completedAt: new Date().toISOString(),
                            error: runtimeExpired
                                ? 'This inspection exceeded the allowed runtime and was stopped. Start a new inspection when ready.'
                                : 'This inspection was interrupted by a server restart or shutdown. Start a new inspection when ready.',
                            errorCode: runtimeExpired ? 'DOCUMENT_INSPECTION_TIMED_OUT' : 'DOCUMENT_INSPECTION_INTERRUPTED',
                            errorRetryable: true,
                            progress: FirewireDocumentAnalysisData.createProgress(
                                runtimeExpired ? 'timed-out' : 'interrupted',
                                runtimeExpired
                                    ? 'Inspection timed out. Start a new inspection when ready.'
                                    : 'Inspection interrupted. Start a new inspection when ready.',
                                100
                            )
                        }
                        await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, record, record.requestedBy)
                        console.warn('[document-inspection] Recovered non-terminal running inspection.', {
                            analysisId: record.id,
                            projectId: record.projectId,
                            documentId: record.documentId,
                            versionId: record.versionId,
                            reason: runtimeExpired ? 'runtime-expired' : 'server-restart'
                        })
                    }

                    if (record.status !== 'running') {
                        console.info('[document-inspection] Returning persisted inspection status.', {
                            analysisId: record.id,
                            projectId: record.projectId,
                            documentId: record.documentId,
                            versionId: record.versionId,
                            status: record.status,
                            requestedAt: record.requestedAt
                        })
                    }

                    const currentRecord = record.status === 'completed' && record.result
                        ? {
                            ...record,
                            result: {
                                ...record.result,
                                proposedBomActions: FirewireDocumentAnalysisData.annotateProjectBomMatches(
                                    record.result.proposedBomActions || [],
                                    context.project.worksheetData
                                ),
                                proposedFloorplanActions: FirewireDocumentAnalysisData.annotateFloorplanMatches(
                                    record.result.proposedFloorplanActions || [],
                                    await FirewireDocumentAnalysisData.loadDocumentLibraryPayload(context.sqldb, context.workspaceKey)
                                )
                            }
                        }
                        : record
                    return res.status(200).json({ data: FirewireDocumentAnalysisData.toClientRecord(currentRecord) })
                } catch (err: Error | any) {
                    const statusCode = err instanceof DocumentAnalysisInputError ? err.statusCode : 500
                    return res.status(statusCode).json({ message: err?.message || String(err || '') })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/cancel',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }
                    const analysisId = String(req.body?.analysisId || '').trim()
                    const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
                    const record = workspace.analyses.find((item) =>
                        (!analysisId || item.id === analysisId)
                        && item.workspaceKey === context.workspaceKey
                        && item.documentId === context.file.id
                        && item.versionId === context.version.id)
                    if (!record) {
                        return res.status(404).json({ message: 'The inspection was not found.' })
                    }
                    if (record.status !== 'running') {
                        return res.status(200).json({ data: FirewireDocumentAnalysisData.toClientRecord(record) })
                    }

                    const inspectionKey = FirewireDocumentAnalysisData.getInspectionKey(
                        context.project.uuid,
                        context.workspaceKey,
                        context.file.id,
                        context.version.id
                    )
                    FirewireDocumentAnalysisData.userCancelledInspections.add(inspectionKey)
                    FirewireDocumentAnalysisData.runningInspectionControllers.get(inspectionKey)?.abort()
                    const cancelledRecord: DocumentAnalysisRecord = {
                        ...record,
                        status: 'cancelled',
                        completedAt: new Date().toISOString(),
                        error: 'Inspection canceled by the user.',
                        errorCode: 'DOCUMENT_INSPECTION_CANCELLED',
                        errorRetryable: true,
                        progress: FirewireDocumentAnalysisData.createProgress(
                            'cancelled',
                            'Inspection canceled by the user.',
                            100
                        )
                    }
                    const cancelledBy = FirewireDocumentAnalysisData.resolveUserId(req)
                    await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, cancelledRecord, cancelledBy)
                    console.info('[document-inspection] Inspection cancelled.', {
                        analysisId: record.id,
                        projectId: record.projectId,
                        documentId: record.documentId,
                        versionId: record.versionId,
                        cancelledBy
                    })
                    return res.status(200).json({ data: FirewireDocumentAnalysisData.toClientRecord(cancelledRecord) })
                } catch (err: Error | any) {
                    return res.status(500).json({ message: FirewireDocumentAnalysisData.getSafeErrorMessage(err) })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/apply',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }

                    const analysisId = String(req.body?.analysisId || '').trim()
                    const requestedFields = Array.isArray(req.body?.targetFields)
                        ? [...new Set(req.body.targetFields.map((value: unknown) => String(value || '').trim()).filter(Boolean))]
                        : []
                    if (!analysisId || requestedFields.length === 0) {
                        return res.status(400).json({
                            message: 'analysisId and at least one targetField are required.'
                        })
                    }

                    const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
                    const record = workspace.analyses.find((item) =>
                        item.id === analysisId
                        && item.workspaceKey === context.workspaceKey
                        && item.documentId === context.file.id
                        && item.versionId === context.version.id)
                    if (!record || record.status !== 'completed' || !record.result) {
                        return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    }

                    const proposals = record.result.proposedActions || []
                    const selected = requestedFields.map((targetField) =>
                        proposals.find((proposal) => proposal.targetField === targetField))
                    if (selected.some((proposal) => !proposal)) {
                        return res.status(400).json({
                            message: 'One or more selected actions are not part of the stored inspection result.'
                        })
                    }

                    const projectContext = FirewireDocumentAnalysisData.createProjectContext(context.project)
                    const conflicts = (selected as DocumentAnalysisProjectDetailProposal[])
                        .filter((proposal) => !FirewireDocumentAnalysisData.valuesEqual(
                            proposal.valueType,
                            proposal.currentValue,
                            FirewireDocumentAnalysisData.getProjectContextValue(projectContext, proposal.targetField)
                        ))
                        .map((proposal) => ({
                            targetField: proposal.targetField,
                            fieldLabel: proposal.fieldLabel,
                            expectedValue: proposal.currentValue,
                            currentValue: FirewireDocumentAnalysisData.getProjectContextValue(projectContext, proposal.targetField)
                        }))
                    if (conflicts.length > 0) {
                        return res.status(409).json({
                            message: 'The project changed after this inspection. Re-inspect before applying the conflicting actions.',
                            code: 'DOCUMENT_ACTION_STALE',
                            conflicts
                        })
                    }

                    const projectInput = FirewireDocumentAnalysisData.createProjectUpdateInput(context.project)
                    const changes = (selected as DocumentAnalysisProjectDetailProposal[]).map((proposal) => {
                        const previousValue = FirewireDocumentAnalysisData.getProjectContextValue(projectContext, proposal.targetField)
                        FirewireDocumentAnalysisData.applyProjectProposal(projectInput, proposal)
                        return {
                            targetField: proposal.targetField,
                            fieldLabel: proposal.fieldLabel,
                            previousValue,
                            appliedValue: proposal.proposedValue
                        }
                    })

                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const fieldLabels = changes.map((change) => change.fieldLabel).join(', ')
                    const updatedProject = await new FirewireProjectRepository(req.app).updateFirewireProject(
                        context.project.uuid,
                        projectInput,
                        userId,
                        `Applied AI document proposals from ${context.sourceFilename}: ${fieldLabels}.`
                    )
                    if (!updatedProject) {
                        return res.status(404).json({ message: 'Project not found.' })
                    }

                    const updatedProjectContext = FirewireDocumentAnalysisData.createProjectContext(updatedProject)
                    const unappliedChanges = changes.filter((change) =>
                        FirewireDocumentAnalysisData.valuesEqual(
                            selected.find((proposal) => proposal?.targetField === change.targetField)?.valueType || 'TEXT',
                            change.previousValue,
                            FirewireDocumentAnalysisData.getProjectContextValue(updatedProjectContext, change.targetField)
                        ))
                    if (unappliedChanges.length > 0) {
                        console.error('[document-inspection] Project update returned without persisting approved fields.', {
                            analysisId: record.id,
                            projectId: context.project.uuid,
                            targetFields: unappliedChanges.map((change) => change.targetField)
                        })
                        return res.status(500).json({
                            message: `The project update completed without changing: ${unappliedChanges.map((change) => change.fieldLabel).join(', ')}. The action was not recorded as applied.`,
                            code: 'DOCUMENT_ACTION_NOT_PERSISTED'
                        })
                    }
                    for (const change of changes) {
                        change.appliedValue = FirewireDocumentAnalysisData.getProjectContextValue(
                            updatedProjectContext,
                            change.targetField
                        )
                    }

                    const application: DocumentAnalysisActionApplication = {
                        id: `application-${randomUUID()}`,
                        appliedAt: new Date().toISOString(),
                        appliedBy: userId,
                        targetFields: changes.map((change) => change.targetField),
                        changes
                    }
                    const updatedRecord: DocumentAnalysisRecord = {
                        ...record,
                        actionApplications: [application, ...(record.actionApplications || [])].slice(0, 100)
                    }
                    let applicationRecorded = true
                    try {
                        await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    } catch (storageError) {
                        applicationRecorded = false
                        console.error('[document-inspection] Project actions applied but analysis application history could not be persisted.', {
                            analysisId: record.id,
                            applicationId: application.id,
                            message: storageError instanceof Error ? storageError.message : String(storageError || '')
                        })
                    }

                    console.info('[document-inspection] Approved project actions applied.', {
                        analysisId: record.id,
                        applicationId: application.id,
                        projectId: context.project.uuid,
                        targetFields: application.targetFields,
                        appliedBy: userId,
                        applicationRecorded
                    })
                    return res.status(200).json({
                        data: {
                            analysisId: record.id,
                            application,
                            applicationRecorded,
                            project: updatedProject
                        }
                    })
                } catch (err: Error | any) {
                    const message = FirewireDocumentAnalysisData.getSafeErrorMessage(err)
                    const statusCode = err instanceof DocumentAnalysisInputError
                        ? err.statusCode
                        : FirewireDocumentAnalysisData.isProjectValidationError(err)
                            ? 400
                            : 500
                    return res.status(statusCode).json({ message })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/bom/apply',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }

                    const analysisId = String(req.body?.analysisId || '').trim()
                    const proposalIds: string[] = Array.isArray(req.body?.proposalIds)
                        ? [...new Set<string>(req.body.proposalIds.map((value: unknown) => String(value || '').trim()).filter(Boolean))]
                        : []
                    if (!analysisId || proposalIds.length === 0) {
                        return res.status(400).json({ message: 'analysisId and at least one proposalId are required.' })
                    }

                    const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
                    const record = workspace.analyses.find((item) =>
                        item.id === analysisId
                        && item.workspaceKey === context.workspaceKey
                        && item.documentId === context.file.id
                        && item.versionId === context.version.id)
                    if (!record || record.status !== 'completed' || !record.result) {
                        return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    }

                    const priorApplications = record.bomActionApplications || []
                    const alreadyAppliedIds = new Set(priorApplications.flatMap((application) => application.proposalIds || []))
                    const requestedAlreadyApplied = proposalIds.filter((proposalId) => alreadyAppliedIds.has(proposalId))
                    if (requestedAlreadyApplied.length === proposalIds.length) {
                        const priorApplication = priorApplications.find((application) =>
                            proposalIds.every((proposalId) => application.proposalIds.includes(proposalId)))
                            || priorApplications.find((application) => application.proposalIds.includes(proposalIds[0]))
                        return res.status(200).json({
                            data: {
                                analysisId: record.id,
                                application: priorApplication,
                                applicationRecorded: true,
                                alreadyApplied: true,
                                project: context.project
                            }
                        })
                    }
                    if (requestedAlreadyApplied.length > 0) {
                        return res.status(409).json({
                            message: 'Some selected BOM actions were already applied. Refresh the findings and select only unapplied actions.',
                            code: 'DOCUMENT_BOM_ACTION_PARTIALLY_APPLIED'
                        })
                    }

                    const proposals = record.result.proposedBomActions || []
                    const selected = proposalIds.map((proposalId) =>
                        proposals.find((proposal) => proposal.proposalId === proposalId))
                    if (selected.some((proposal) => !proposal)) {
                        return res.status(400).json({ message: 'One or more selected BOM actions are not part of the stored inspection result.' })
                    }
                    const evaluatedSelected = FirewireDocumentAnalysisData.annotateProjectBomMatches(
                        selected as DocumentAnalysisBomProposal[],
                        context.project.worksheetData
                    )
                    const projectBomBlocked = evaluatedSelected.filter((proposal) =>
                        proposal.projectBomMatch?.status === 'ALREADY_ON_BOM'
                        || proposal.projectBomMatch?.status === 'DUPLICATE_PROPOSAL')
                    if (projectBomBlocked.length > 0) {
                        return res.status(409).json({
                            message: 'One or more selected devices or parts already exist on the project BOM or duplicate another selected proposal. Refresh the findings before applying.',
                            code: 'DOCUMENT_BOM_ENTITY_ALREADY_EXISTS',
                            proposalIds: projectBomBlocked.map((proposal) => proposal.proposalId)
                        })
                    }
                    const ineligible = evaluatedSelected.filter((proposal) =>
                        proposal.quantityStatus === 'CONFLICT'
                        || proposal.reconciledQuantity <= 0
                        || proposal.catalogMatch.status !== 'MATCHED'
                        || !['DEVICE', 'PART'].includes(proposal.catalogMatch.entityType))
                    if (ineligible.length > 0) {
                        return res.status(409).json({
                            message: 'Only non-conflicting BOM actions with an exact Firewire device or master-part match can be applied.',
                            code: 'DOCUMENT_BOM_ACTION_REQUIRES_REVIEW',
                            proposalIds: ineligible.map((proposal) => proposal.proposalId)
                        })
                    }

                    const worksheetData = FirewireDocumentAnalysisData.cloneJson(context.project.worksheetData || {})
                    const bomSections = Array.isArray(worksheetData.bomSections) ? worksheetData.bomSections : []
                    const existingSourceIds = new Set(bomSections.flatMap((section: any) =>
                        (Array.isArray(section?.rows) ? section.rows : [])
                            .filter((row: any) => String(row?.sourceAnalysisId || '') === record.id)
                            .map((row: any) => String(row?.sourceProposalId || ''))))
                    if (proposalIds.some((proposalId) => existingSourceIds.has(proposalId))) {
                        return res.status(409).json({
                            message: 'One or more selected BOM actions already exist in the project worksheet. Refresh before trying again.',
                            code: 'DOCUMENT_BOM_ACTION_ALREADY_EXISTS'
                        })
                    }

                    const sectionKey = 'document-analysis'
                    let section = bomSections.find((candidate: any) => String(candidate?.sectionKey || '') === sectionKey)
                    if (!section) {
                        section = {
                            title: 'DOCUMENT ANALYSIS',
                            sectionKey,
                            vendorIds: [],
                            vendorNames: [],
                            rows: []
                        }
                        bomSections.push(section)
                    }
                    section.rows = Array.isArray(section.rows) ? section.rows : []

                    const appliedRows = [] as DocumentAnalysisBomActionApplication['rows']
                    for (const proposal of evaluatedSelected) {
                        const row = await FirewireDocumentAnalysisData.createBomRowFromProposal(
                            context.sqldb,
                            context.project,
                            record,
                            proposal
                        )
                        section.rows.push(row)
                        appliedRows.push({
                            proposalId: proposal.proposalId,
                            bomRowId: row.id,
                            entityType: proposal.catalogMatch.entityType as 'DEVICE' | 'PART',
                            deviceId: String(row.deviceId || ''),
                            partId: String(row.sourcePartId || ''),
                            quantity: Number(row.qty || 0),
                            floorplanQuantityTarget: Number(row.floorplanQuantityTarget || 0)
                        })
                    }
                    worksheetData.bomSections = bomSections

                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const projectInput = FirewireDocumentAnalysisData.createProjectUpdateInput(context.project)
                    projectInput.worksheetData = worksheetData
                    const updatedProject = await new FirewireProjectRepository(req.app).updateFirewireProject(
                        context.project.uuid,
                        projectInput,
                        userId,
                        `Added ${appliedRows.length} approved BOM row${appliedRows.length === 1 ? '' : 's'} from AI document analysis of ${context.sourceFilename}.`
                    )
                    if (!updatedProject) {
                        return res.status(404).json({ message: 'Project not found.' })
                    }
                    const persistedRows = (updatedProject.worksheetData?.bomSections || [])
                        .flatMap((candidate: any) => Array.isArray(candidate?.rows) ? candidate.rows : [])
                    const persistedIds = new Set(persistedRows.map((row: any) => String(row?.id || '')))
                    if (appliedRows.some((row) => !persistedIds.has(row.bomRowId))) {
                        return res.status(500).json({
                            message: 'The project update completed without persisting every approved BOM row. The action was not recorded as applied.',
                            code: 'DOCUMENT_BOM_ACTION_NOT_PERSISTED'
                        })
                    }

                    const application: DocumentAnalysisBomActionApplication = {
                        id: `bom-application-${randomUUID()}`,
                        appliedAt: new Date().toISOString(),
                        appliedBy: userId,
                        proposalIds,
                        sectionKey,
                        rows: appliedRows
                    }
                    const updatedRecord: DocumentAnalysisRecord = {
                        ...record,
                        bomActionApplications: [application, ...priorApplications].slice(0, 100)
                    }
                    let applicationRecorded = true
                    try {
                        await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    } catch (storageError) {
                        applicationRecorded = false
                        console.error('[document-inspection] BOM rows applied but analysis application history could not be persisted.', {
                            analysisId: record.id,
                            applicationId: application.id,
                            message: storageError instanceof Error ? storageError.message : String(storageError || '')
                        })
                    }
                    console.info('[document-inspection] Approved BOM actions applied.', {
                        analysisId: record.id,
                        applicationId: application.id,
                        projectId: context.project.uuid,
                        proposalIds,
                        bomRowIds: appliedRows.map((row) => row.bomRowId),
                        appliedBy: userId,
                        applicationRecorded
                    })
                    return res.status(200).json({
                        data: {
                            analysisId: record.id,
                            application,
                            applicationRecorded,
                            alreadyApplied: false,
                            project: updatedProject
                        }
                    })
                } catch (err: Error | any) {
                    const message = FirewireDocumentAnalysisData.getSafeErrorMessage(err)
                    const statusCode = err instanceof DocumentAnalysisInputError
                        ? err.statusCode
                        : FirewireDocumentAnalysisData.isProjectValidationError(err)
                            ? 400
                            : 500
                    return res.status(statusCode).json({ message })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/bom/proposals/:proposalId/create-device',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }
                    const analysisId = String(req.body?.analysisId || '').trim()
                    const proposalId = String(req.params.proposalId || '').trim()
                    if (!analysisId || !proposalId) {
                        return res.status(400).json({ message: 'analysisId and proposalId are required.' })
                    }

                    const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
                    const record = workspace.analyses.find((item) =>
                        item.id === analysisId
                        && item.workspaceKey === context.workspaceKey
                        && item.documentId === context.file.id
                        && item.versionId === context.version.id)
                    if (!record || record.status !== 'completed' || !record.result) {
                        return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    }
                    const proposal = (record.result.proposedBomActions || []).find((item) => item.proposalId === proposalId)
                    if (!proposal) {
                        return res.status(404).json({ message: 'The stored BOM proposal was not found.' })
                    }
                    const priorApplication = (record.deviceCreationApplications || []).find((item) => item.proposalId === proposalId)
                    if (priorApplication) {
                        const existingDevice = await context.sqldb.getDevice(priorApplication.deviceId)
                        if (existingDevice) {
                            return res.status(200).json({
                                data: {
                                    record: FirewireDocumentAnalysisData.toClientRecord(record),
                                    proposal,
                                    device: existingDevice,
                                    application: priorApplication
                                }
                            })
                        }
                    }
                    const alreadyAppliedToBom = (record.bomActionApplications || []).some((application) =>
                        application.proposalIds.includes(proposalId))
                    if (alreadyAppliedToBom) {
                        return res.status(409).json({
                            message: 'This proposal has already been applied to the BOM. Create or select a device from the BOM row instead.',
                            code: 'DOCUMENT_DEVICE_PROPOSAL_ALREADY_APPLIED'
                        })
                    }
                    if (proposal.quantityStatus === 'CONFLICT' || proposal.reconciledQuantity <= 0) {
                        return res.status(409).json({
                            message: 'Resolve the proposal quantity conflict before creating a floorplan device.',
                            code: 'DOCUMENT_DEVICE_QUANTITY_REQUIRES_REVIEW'
                        })
                    }
                    if (proposal.catalogMatch.entityType !== 'PART' || !proposal.catalogMatch.partId) {
                        return res.status(409).json({
                            message: 'A canonical master part must be selected before creating a device.',
                            code: 'DOCUMENT_DEVICE_PART_REQUIRED'
                        })
                    }
                    const [projectCheckedProposal] = FirewireDocumentAnalysisData.annotateProjectBomMatches(
                        [proposal],
                        context.project.worksheetData
                    )
                    if (projectCheckedProposal.projectBomMatch?.status === 'ALREADY_ON_BOM') {
                        return res.status(409).json({
                            message: 'This master part already exists on the project BOM and does not need a new BOM entry.',
                            code: 'DOCUMENT_BOM_ENTITY_ALREADY_EXISTS'
                        })
                    }

                    const partId = String(proposal.catalogMatch.partId).trim()
                    const parts = await context.sqldb.getParts()
                    const part = parts.find((candidate) => String(candidate.partId || '') === partId)
                    if (!part) {
                        return res.status(409).json({ message: 'The selected master part no longer exists. Re-inspect before creating a device.' })
                    }
                    const vendorId = String(part.vendorId || '').trim()
                    const vendor = vendorId ? await context.sqldb.getVendorById(vendorId) : null
                    if (!vendor) {
                        return res.status(409).json({ message: 'The selected master part does not have a valid Firewire vendor.' })
                    }

                    const name = FirewireDocumentAnalysisData.normalizeRequiredDeviceText(req.body?.name, 'Device name', 200)
                    const shortName = FirewireDocumentAnalysisData.normalizeRequiredDeviceText(req.body?.shortName, 'Short name', 50)
                    const categoryName = FirewireDocumentAnalysisData.normalizeDeviceText(req.body?.categoryName, 120)
                    const floorplanLabelText = FirewireDocumentAnalysisData.normalizeDeviceText(req.body?.floorplanLabelText, 4)
                    const includeOnFloorplan = req.body?.includeOnFloorplan !== false
                    const defaultLabor = Number(req.body?.defaultLabor ?? 112)
                    if (!Number.isFinite(defaultLabor) || defaultLabor < 0) {
                        return res.status(400).json({ message: 'Default labor must be a non-negative number.' })
                    }

                    let created = true
                    let device: any
                    try {
                        const creation = await FirewireData.createDeviceFromVendorPart(
                            context.sqldb,
                            vendor,
                            String(part.partNumber || part.PartNumber || '').trim(),
                            part,
                            {
                                name,
                                shortName,
                                categoryName,
                                includeOnFloorplan,
                                floorplanLabelText,
                                defaultLabor
                            }
                        )
                        device = creation.device
                    } catch (error: any) {
                        if (Number(error?.status || 0) === 409 && error?.data?.deviceId) {
                            created = false
                            device = error.data
                        } else {
                            throw error
                        }
                    }
                    if (!device?.deviceId) {
                        throw new Error('The device was created but could not be reloaded.')
                    }

                    let iconId = String(device.iconId || '').trim()
                    let iconLabel = String(device.iconLabel || '').trim()
                    if (proposal.legendSymbol?.found) {
                        if (!/\.pdf$/i.test(context.sourceFilename) && String(context.version.mimeType || '').toLowerCase() !== 'application/pdf') {
                            throw new DocumentAnalysisInputError('Legend glyph creation currently requires a PDF source document.', 409)
                        }
                        const previewDataUrl = String(proposal.legendSymbol.previewDataUrl || '').trim()
                        const getDataUrl = async() => previewDataUrl || await new OpenAiDocumentAnalysisService().createLegendSymbolIconDataUrl(
                            (await FirewireDocumentAnalysisData.loadVersionContent(context.workspaceKey, context.version)).buffer,
                            proposal.legendSymbol
                        )
                        if (!iconId) {
                            const dataUrl = await getDataUrl()
                            const iconGroupId = await context.sqldb.getOrCreateDeviceIconGroup('AI Inspection Legends')
                            iconLabel = FirewireDocumentAnalysisData.getLegendIconLabel(proposal, name)
                            iconId = await context.sqldb.createDeviceIcon({
                                iconGroupId,
                                label: iconLabel,
                                fileName: `inspection-legend-${proposalId}.png`,
                                mimeType: 'image/png',
                                dataUrl
                            })
                            await context.sqldb.assignDeviceIcon(String(device.deviceId), iconId, FirewireDocumentAnalysisData.resolveUserId(req))
                            device = await context.sqldb.getDevice(String(device.deviceId)) || device
                        } else if (previewDataUrl) {
                            // A new explicit resolution may repair artwork created by an older
                            // AI inspection, but it must never overwrite a manually selected icon.
                            const iconGroups = await context.sqldb.getDeviceIconGroups()
                            const aiIcon = iconGroups
                                .find((group: any) => String(group.name || '').trim().toLocaleLowerCase() === 'ai inspection legends')
                                ?.icons?.find((icon: any) => String(icon.iconId || '') === iconId)
                            if (aiIcon) {
                                iconLabel = FirewireDocumentAnalysisData.getLegendIconLabel(proposal, name)
                                await context.sqldb.updateDeviceIcon({
                                    iconId,
                                    label: iconLabel,
                                    fileName: `inspection-legend-${proposalId}.png`,
                                    mimeType: 'image/png',
                                    dataUrl: await getDataUrl()
                                })
                                device = await context.sqldb.getDevice(String(device.deviceId)) || device
                            }
                        }
                    }

                    const deviceMatchedProposal: DocumentAnalysisBomProposal = {
                        ...proposal,
                        catalogMatch: {
                            status: 'MATCHED',
                            entityType: 'DEVICE',
                            deviceId: String(device.deviceId),
                            deviceName: String(device.name || name),
                            partId,
                            partNumber: String(device.partNumber || part.partNumber || part.PartNumber || ''),
                            vendorName: String(device.vendorName || vendor.name || ''),
                            confidence: 1,
                            rationale: created
                                ? `User created this Firewire device from the displayed master part ${String(part.partNumber || part.PartNumber || '').trim()}.`
                                : `User confirmed the existing Firewire device for master part ${String(part.partNumber || part.PartNumber || '').trim()}.`
                        }
                    }
                    const [updatedProposal] = FirewireDocumentAnalysisData.annotateProjectBomMatches(
                        [deviceMatchedProposal],
                        context.project.worksheetData
                    )
                    const proposedBomActions = (record.result.proposedBomActions || []).map((item) =>
                        item.proposalId === proposalId ? updatedProposal : item)
                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const application: DocumentAnalysisDeviceCreationApplication = {
                        id: `device-creation-${randomUUID()}`,
                        createdAt: new Date().toISOString(),
                        createdBy: userId,
                        proposalId,
                        partId,
                        deviceId: String(device.deviceId),
                        created,
                        name: String(device.name || name),
                        shortName: String(device.shortName || shortName),
                        categoryName: String(device.categoryName || categoryName),
                        includeOnFloorplan: !!device.includeOnFloorplan,
                        floorplanLabelText: String(device.floorplanLabelText || floorplanLabelText),
                        iconId: String(device.iconId || iconId || '').trim() || undefined,
                        iconLabel: String(device.iconLabel || iconLabel || '').trim() || undefined
                    }
                    const updatedRecord: DocumentAnalysisRecord = {
                        ...record,
                        result: { ...record.result, proposedBomActions },
                        deviceCreationApplications: [application, ...(record.deviceCreationApplications || [])].slice(0, 100)
                    }
                    await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    console.info('[document-inspection] Missing device resolved from master part.', {
                        analysisId,
                        proposalId,
                        partId,
                        deviceId: device.deviceId,
                        created,
                        createdBy: userId
                    })
                    return res.status(created ? 201 : 200).json({
                        data: {
                            record: FirewireDocumentAnalysisData.toClientRecord(updatedRecord),
                            proposal: updatedProposal,
                            device,
                            application
                        }
                    })
                } catch (err: Error | any) {
                    const statusCode = Number(err?.status || 0) || (err instanceof DocumentAnalysisInputError ? err.statusCode : 500)
                    return res.status(statusCode).json({ message: FirewireDocumentAnalysisData.getSafeErrorMessage(err) })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/floorplans/proposals/:proposalId/create',
            fx: async (req: express.Request, res: express.Response) => {
                let uploadedBlob: { containerName: string, blobName: string } | null = null
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) return res.status(404).json({ message: 'Project or document version was not found.' })
                    const analysisId = String(req.body?.analysisId || '').trim()
                    const proposalId = String(req.params.proposalId || '').trim()
                    const record = await FirewireDocumentAnalysisData.findCompletedAnalysisRecord(context, analysisId)
                    if (!record) return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    const proposal = (record.result?.proposedFloorplanActions || []).find((item) => item.proposalId === proposalId)
                    if (!proposal) return res.status(404).json({ message: 'The stored floorplan proposal was not found.' })

                    const payload = await FirewireDocumentAnalysisData.loadDocumentLibraryPayload(context.sqldb, context.workspaceKey)
                    const files: DocumentLibraryFile[] = Array.isArray(payload.files) ? payload.files : []
                    const priorApplication = (record.floorplanApplications || []).find((item) => item.proposalId === proposalId)
                    const priorFile = priorApplication
                        ? files.find((file) => String(file.id || '') === priorApplication.floorplanFileId)
                        : undefined
                    if (priorApplication && priorFile) {
                        return res.status(200).json({ data: { record: FirewireDocumentAnalysisData.toClientRecord(record), application: priorApplication, file: priorFile, workspace: payload, alreadyApplied: true } })
                    }

                    const [evaluated] = FirewireDocumentAnalysisData.annotateFloorplanMatches([proposal], payload)
                    if (evaluated.floorplanMatch?.status === 'ALREADY_EXISTS') {
                        return res.status(409).json({
                            message: `${proposal.name} already exists in this project's floorplans.`,
                            code: 'DOCUMENT_FLOORPLAN_ALREADY_EXISTS',
                            floorplanFileId: evaluated.floorplanMatch.floorplanFileId
                        })
                    }
                    if (!/\.pdf$/i.test(context.sourceFilename) && String(context.version.mimeType || '').toLowerCase() !== 'application/pdf') {
                        return res.status(409).json({ message: 'Creating an individual floorplan currently requires a PDF source document.', code: 'DOCUMENT_FLOORPLAN_PDF_REQUIRED' })
                    }

                    const source = await FirewireDocumentAnalysisData.loadVersionContent(context.workspaceKey, context.version)
                    const sourcePdf = await PDFDocument.load(source.buffer)
                    const pageIndex = Math.floor(Number(proposal.pageNumber || 0)) - 1
                    if (pageIndex < 0 || pageIndex >= sourcePdf.getPageCount()) {
                        return res.status(409).json({ message: 'The proposed PDF page no longer exists in this document version. Re-inspect before creating the floorplan.' })
                    }
                    const floorplanPdf = await PDFDocument.create()
                    const [page] = await floorplanPdf.copyPages(sourcePdf, [pageIndex])
                    floorplanPdf.addPage(page)
                    const buffer = Buffer.from(await floorplanPdf.save())
                    const storage = new AzureBlobDocumentStorage()
                    if (!storage.isConfigured()) throw new DocumentAnalysisConfigurationError('Azure Blob Storage is not configured for floorplan creation.')

                    const now = new Date().toISOString()
                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const fileId = `floorplan-${randomUUID()}`
                    const versionId = `version-${randomUUID()}`
                    const sourceFileName = `${FirewireDocumentAnalysisData.sanitizeFloorplanFileName(proposal.name)}.pdf`
                    const blobName = ['project-doc-library', FirewireDocumentAnalysisData.sanitizePathSegment(context.workspaceKey), FirewireDocumentAnalysisData.sanitizePathSegment(fileId), `0001-${FirewireDocumentAnalysisData.sanitizePathSegment(versionId)}-${FirewireDocumentAnalysisData.sanitizePathSegment(sourceFileName)}`].join('/')
                    await storage.upload({
                        buffer,
                        containerName: context.workspaceKey,
                        blobName,
                        contentType: 'application/pdf',
                        metadata: { workspaceKey: context.workspaceKey, fileId, versionId, folderId: 'floorplans', sourceAnalysisId: record.id, sourceProposalId: proposalId }
                    })
                    uploadedBlob = { containerName: context.workspaceKey, blobName }
                    const file: DocumentLibraryFile = {
                        id: fileId,
                        folderId: 'floorplans',
                        documentKind: 'drawing',
                        storageKey: context.workspaceKey,
                        sourceFileName,
                        name: proposal.name,
                        extension: 'pdf',
                        createdAt: now,
                        updatedAt: now,
                        sourceAnalysisId: record.id,
                        sourceDocumentId: record.documentId,
                        sourceDocumentVersionId: record.versionId,
                        floorplanDesign: { annotations: [], rotationDegrees: 0, symbolDisplayMode: 'icon', updatedAt: now },
                        versions: [{
                            id: versionId,
                            versionNumber: 1,
                            uploadedAt: now,
                            uploadedBy: userId,
                            sourceFileName,
                            mimeType: 'application/pdf',
                            sizeBytes: buffer.length,
                            lastModified: Date.now(),
                            blobName,
                            blobContainerName: storage.getProjectContainerName(context.workspaceKey)
                        }]
                    }
                    const nextPayload = { ...payload, files: [...files, file] }
                    await context.sqldb.saveWorkspaceStorage(DOCUMENT_LIBRARY_AREA, context.workspaceKey, JSON.stringify(nextPayload), userId)
                    uploadedBlob = null

                    const application: DocumentAnalysisFloorplanApplication = {
                        id: `floorplan-application-${randomUUID()}`,
                        appliedAt: now,
                        appliedBy: userId,
                        proposalId,
                        floorplanFileId: fileId,
                        floorplanName: proposal.name,
                        pageNumber: proposal.pageNumber
                    }
                    const updatedProposal: DocumentAnalysisFloorplanProposal = {
                        ...proposal,
                        floorplanMatch: { status: 'CREATED', floorplanFileId: fileId, rationale: 'Created from the approved source PDF page.' }
                    }
                    const updatedRecord: DocumentAnalysisRecord = {
                        ...record,
                        result: { ...record.result!, proposedFloorplanActions: record.result!.proposedFloorplanActions.map((item) => item.proposalId === proposalId ? updatedProposal : item) },
                        floorplanApplications: [application, ...(record.floorplanApplications || [])].slice(0, 100)
                    }
                    let applicationRecorded = true
                    try {
                        await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    } catch (storageError) {
                        applicationRecorded = false
                        console.error('[document-inspection] Floorplan created but analysis application history could not be persisted.', {
                            analysisId: record.id,
                            proposalId,
                            floorplanFileId: fileId,
                            message: storageError instanceof Error ? storageError.message : String(storageError || '')
                        })
                    }
                    return res.status(201).json({ data: { record: FirewireDocumentAnalysisData.toClientRecord(updatedRecord), application, applicationRecorded, file, workspace: nextPayload, alreadyApplied: false } })
                } catch (err: Error | any) {
                    if (uploadedBlob) {
                        try { await new AzureBlobDocumentStorage().deleteIfExists(uploadedBlob.containerName, uploadedBlob.blobName) } catch { /* best-effort rollback */ }
                    }
                    const statusCode = err instanceof DocumentAnalysisInputError ? err.statusCode : err instanceof DocumentAnalysisConfigurationError ? 503 : 500
                    return res.status(statusCode).json({ message: FirewireDocumentAnalysisData.getSafeErrorMessage(err) })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/floorplans/proposals/:proposalId/locate-symbols',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) return res.status(404).json({ message: 'Project or document version was not found.' })
                    const analysisId = String(req.body?.analysisId || '').trim()
                    const proposalId = String(req.params.proposalId || '').trim()
                    const record = await FirewireDocumentAnalysisData.findCompletedAnalysisRecord(context, analysisId)
                    if (!record) return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    const proposal = (record.result?.proposedFloorplanActions || []).find((item) => item.proposalId === proposalId)
                    if (!proposal) return res.status(404).json({ message: 'The stored floorplan proposal was not found.' })
                    const replaceExisting = req.body?.replaceExisting === true
                    const priorApplications = (record.floorplanPlacementApplications || [])
                        .filter((application) => application.proposalId === proposalId)
                    if (priorApplications.length > 0 && !replaceExisting) {
                        return res.status(409).json({
                            message: 'This floorplan already has applied AI placements. Choose the replace option to remove and re-scan only this inspection\'s generated symbols.'
                        })
                    }

                    const payload = await FirewireDocumentAnalysisData.loadDocumentLibraryPayload(context.sqldb, context.workspaceKey)
                    const floorplanApplication = (record.floorplanApplications || []).find((item) => item.proposalId === proposalId)
                    const [evaluatedProposal] = FirewireDocumentAnalysisData.annotateFloorplanMatches([proposal], payload)
                    const files: DocumentLibraryFile[] = Array.isArray(payload.files) ? payload.files : []
                    const appliedFloorplanFileId = files.some((file) => String(file.id || '') === floorplanApplication?.floorplanFileId)
                        ? floorplanApplication?.floorplanFileId || ''
                        : ''
                    const floorplanFileId = evaluatedProposal.floorplanMatch?.floorplanFileId || appliedFloorplanFileId
                    const floorplan = files.find((file) => String(file.id || '') === floorplanFileId && String(file.folderId || '') === 'floorplans')
                    const version = floorplan?.versions?.[floorplan.versions.length - 1]
                    if (!floorplan || !version) return res.status(409).json({ message: 'Create or match the floorplan before locating symbols.' })

                    const latestProject = await new FirewireProjectRepository(req.app).getFirewireProject(context.project.uuid)
                    if (!latestProject) return res.status(404).json({ message: 'Project not found.' })
                    const candidates = (record.result?.proposedBomActions || []).flatMap((candidate) => {
                        if (candidate.catalogMatch.entityType !== 'DEVICE' || !candidate.catalogMatch.deviceId) return []
                        const [evaluated] = FirewireDocumentAnalysisData.annotateProjectBomMatches([candidate], latestProject.worksheetData)
                        const row = FirewireDocumentAnalysisData.findBomRow(latestProject.worksheetData, evaluated.projectBomMatch?.bomRowId || '')
                        return row?.includeOnFloorplan ? [{ candidate, row }] : []
                    })
                    if (candidates.length === 0) {
                        return res.status(409).json({
                            message: 'No exact, floorplan-ready device rows from this inspection are currently on the project BOM. Apply or resolve the BOM proposals first.',
                            code: 'DOCUMENT_FLOORPLAN_BOM_REQUIRED'
                        })
                    }

                    const content = await FirewireDocumentAnalysisData.loadVersionContent(floorplan.storageKey || context.workspaceKey, version)
                    const placements = await new OpenAiDocumentAnalysisService().locateFloorplanSymbols({
                        buffer: content.buffer,
                        filename: String(version.sourceFileName || floorplan.sourceFileName || `${proposal.name}.pdf`),
                        mimeType: content.mimeType,
                        projectId: context.project.uuid,
                        documentId: record.documentId,
                        versionId: record.versionId,
                        floorplanName: proposal.name,
                        sourcePageNumber: proposal.pageNumber,
                        bomCandidates: candidates.map(({ candidate, row }) => ({
                            proposalId: candidate.proposalId,
                            deviceType: String(row.type || candidate.deviceType || ''),
                            symbolLabel: String(row.floorplanLabelText || candidate.symbolLabel || ''),
                            manufacturer: candidate.manufacturer,
                            modelNumber: candidate.modelNumber,
                            partNumber: String(row.partNbr || candidate.partNumber || ''),
                            description: [candidate.description, row.description, row.type]
                                .map((value) => String(value || '').trim())
                                .filter((value, index, values) => !!value && values.indexOf(value) === index)
                                .join(' | '),
                            expectedProjectQuantity: Math.max(0, Math.floor(Number(row.floorplanQuantityTarget ?? row.qty ?? 0)))
                        }))
                    })
                    const normalizedPlacements = placements.map((placement, index) => ({
                        ...placement,
                        placementId: `${proposalId}-focused-placement-${index + 1}`,
                        source: {
                            ...placement.source,
                            filename: record.sourceFilename,
                            page: String(proposal.pageNumber)
                        }
                    }))
                    let removedAnnotationCount = 0
                    let workspaceChanged = false
                    const replacedExisting = replaceExisting && priorApplications.length > 0 && normalizedPlacements.length > 0
                    if (replacedExisting) {
                        const priorPlacementIds = new Set(priorApplications.flatMap((application) => application.placementIds))
                        const priorAnnotationIds = new Set(priorApplications.flatMap((application) => application.annotationIds))
                        const now = new Date().toISOString()
                        for (const file of files) {
                            const annotations = Array.isArray(file.floorplanDesign?.annotations)
                                ? file.floorplanDesign.annotations
                                : []
                            const retainedAnnotations = annotations.filter((annotation: any) => {
                                const belongsToInspection = String(annotation?.sourceAnalysisId || '') === record.id
                                const matchesPriorPlacement = priorPlacementIds.has(String(annotation?.sourcePlacementId || ''))
                                const matchesPriorAnnotation = priorAnnotationIds.has(String(annotation?.id || ''))
                                const shouldRemove = belongsToInspection && (matchesPriorPlacement || matchesPriorAnnotation)
                                if (shouldRemove) removedAnnotationCount += 1
                                return !shouldRemove
                            })
                            if (retainedAnnotations.length !== annotations.length) {
                                file.floorplanDesign = { ...(file.floorplanDesign || {}), annotations: retainedAnnotations, updatedAt: now }
                                file.updatedAt = now
                                workspaceChanged = true
                            }
                        }
                    }
                    const retainedPlacements = replaceExisting && priorApplications.length > 0 && normalizedPlacements.length === 0
                        ? proposal.symbolPlacements
                        : normalizedPlacements
                    const updatedProposal = { ...proposal, symbolPlacements: retainedPlacements }
                    const updatedRecord: DocumentAnalysisRecord = {
                        ...record,
                        result: {
                            ...record.result!,
                            proposedFloorplanActions: record.result!.proposedFloorplanActions.map((item) =>
                                item.proposalId === proposalId ? updatedProposal : item)
                        },
                        floorplanPlacementApplications: replacedExisting
                            ? (record.floorplanPlacementApplications || []).filter((application) => application.proposalId !== proposalId)
                            : record.floorplanPlacementApplications
                    }
                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const nextPayload = { ...payload, files }
                    if (workspaceChanged) {
                        await context.sqldb.saveWorkspaceStorage(DOCUMENT_LIBRARY_AREA, context.workspaceKey, JSON.stringify(nextPayload), userId)
                    }
                    await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    return res.status(200).json({
                        data: {
                            record: FirewireDocumentAnalysisData.toClientRecord(updatedRecord),
                            proposal: updatedProposal,
                            placements: normalizedPlacements,
                            removedAnnotationCount,
                            workspace: workspaceChanged ? nextPayload : undefined,
                            file: workspaceChanged ? floorplan : undefined
                        }
                    })
                } catch (err: Error | any) {
                    const statusCode = err instanceof DocumentAnalysisProviderError
                        ? err.statusCode
                        : err instanceof DocumentAnalysisInputError
                            ? err.statusCode
                            : 500
                    return res.status(statusCode).json({ message: FirewireDocumentAnalysisData.getSafeErrorMessage(err) })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/floorplans/proposals/:proposalId/place-symbols',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) return res.status(404).json({ message: 'Project or document version was not found.' })
                    const analysisId = String(req.body?.analysisId || '').trim()
                    const proposalId = String(req.params.proposalId || '').trim()
                    const record = await FirewireDocumentAnalysisData.findCompletedAnalysisRecord(context, analysisId)
                    if (!record) return res.status(404).json({ message: 'The completed inspection result was not found.' })
                    const proposal = (record.result?.proposedFloorplanActions || []).find((item) => item.proposalId === proposalId)
                    if (!proposal) return res.status(404).json({ message: 'The stored floorplan proposal was not found.' })
                    const payload = await FirewireDocumentAnalysisData.loadDocumentLibraryPayload(context.sqldb, context.workspaceKey)
                    const floorplanApplication = (record.floorplanApplications || []).find((item) => item.proposalId === proposalId)
                    const [evaluatedProposal] = FirewireDocumentAnalysisData.annotateFloorplanMatches([proposal], payload)
                    const files: DocumentLibraryFile[] = Array.isArray(payload.files) ? payload.files : []
                    const appliedFloorplanFileId = files.some((file) => String(file.id || '') === floorplanApplication?.floorplanFileId)
                        ? floorplanApplication?.floorplanFileId || ''
                        : ''
                    const floorplanFileId = evaluatedProposal.floorplanMatch?.floorplanFileId || appliedFloorplanFileId
                    if (!floorplanFileId) return res.status(409).json({ message: 'Create or match the floorplan before placing symbols.' })

                    const floorplan = files.find((file) => String(file.id || '') === floorplanFileId && String(file.folderId || '') === 'floorplans')
                    if (!floorplan) return res.status(409).json({ message: 'The target floorplan is no longer available.' })
                    const latestProject = await new FirewireProjectRepository(req.app).getFirewireProject(context.project.uuid)
                    if (!latestProject) return res.status(404).json({ message: 'Project not found.' })

                    const priorApplications = (record.floorplanPlacementApplications || [])
                        .filter((application) => application.proposalId === proposalId)
                    const priorPlacementIds = new Set(priorApplications.flatMap((application) => application.placementIds))
                    const priorAnnotationIdByPlacement = new Map<string, string>()
                    for (const application of priorApplications) {
                        application.placementIds.forEach((placementId, index) => {
                            const annotationId = application.annotationIds[index]
                            if (placementId && annotationId) priorAnnotationIdByPlacement.set(placementId, annotationId)
                        })
                    }
                    const allAnnotations = files.flatMap((file) => Array.isArray(file.floorplanDesign?.annotations) ? file.floorplanDesign.annotations : [])
                    const targetAnnotations = Array.isArray(floorplan.floorplanDesign?.annotations) ? floorplan.floorplanDesign.annotations : []
                    const annotationIds: string[] = []
                    const placementIds: string[] = []
                    const recoveredAnnotationIds: string[] = []
                    const recoveredPlacementIds: string[] = []
                    const skipped: Array<{ placementId: string, reason: string }> = []

                    for (const placement of proposal.symbolPlacements || []) {
                        const priorAnnotationId = priorAnnotationIdByPlacement.get(placement.placementId)
                        const existingAnnotation = allAnnotations.find((item: any) =>
                            (item?.sourceAnalysisId === record.id && item?.sourcePlacementId === placement.placementId)
                            || (!!priorAnnotationId && item?.id === priorAnnotationId))
                        if (existingAnnotation) {
                            if (existingAnnotation && !priorPlacementIds.has(placement.placementId)) {
                                recoveredPlacementIds.push(placement.placementId)
                                recoveredAnnotationIds.push(String(existingAnnotation.id || ''))
                            }
                            skipped.push({ placementId: placement.placementId, reason: 'already placed' })
                            continue
                        }
                        const bomProposal = (record.result?.proposedBomActions || []).find((item) => item.proposalId === placement.bomProposalId)
                        if (!bomProposal || bomProposal.catalogMatch.entityType !== 'DEVICE') {
                            skipped.push({ placementId: placement.placementId, reason: 'device match required' })
                            continue
                        }
                        const [evaluated] = FirewireDocumentAnalysisData.annotateProjectBomMatches([bomProposal], latestProject.worksheetData)
                        const bomRowId = evaluated.projectBomMatch?.bomRowId || ''
                        const row = FirewireDocumentAnalysisData.findBomRow(latestProject.worksheetData, bomRowId)
                        if (!row || !row.includeOnFloorplan) {
                            skipped.push({ placementId: placement.placementId, reason: 'floorplan-ready BOM row required' })
                            continue
                        }
                        const target = Math.max(0, Math.floor(Number(row.floorplanQuantityTarget ?? row.qty ?? 0)))
                        const placedCount = allAnnotations.filter((item: any) => item?.kind === 'symbol' && String(item?.bomRowId || '') === bomRowId).length
                            + annotationIds.filter((annotationId) => targetAnnotations.some((item: any) => item.id === annotationId && item.bomRowId === bomRowId)).length
                        if (placedCount >= target) {
                            skipped.push({ placementId: placement.placementId, reason: 'placement target reached' })
                            continue
                        }
                        const annotation = FirewireDocumentAnalysisData.createFloorplanAnnotation(row, placement, record)
                        targetAnnotations.push(annotation)
                        annotationIds.push(annotation.id)
                        placementIds.push(placement.placementId)
                    }
                    if (annotationIds.length === 0 && recoveredAnnotationIds.length === 0) {
                        return res.status(409).json({ message: 'No symbols were eligible for placement. Apply matched device rows to the BOM first, or review placement targets.', skipped })
                    }
                    const now = new Date().toISOString()
                    floorplan.floorplanDesign = { ...(floorplan.floorplanDesign || {}), annotations: targetAnnotations, updatedAt: now }
                    floorplan.updatedAt = now
                    const userId = FirewireDocumentAnalysisData.resolveUserId(req)
                    const nextPayload = { ...payload, files }
                    await context.sqldb.saveWorkspaceStorage(DOCUMENT_LIBRARY_AREA, context.workspaceKey, JSON.stringify(nextPayload), userId)
                    const application: DocumentAnalysisFloorplanPlacementApplication = {
                        id: `floorplan-placement-${randomUUID()}`,
                        appliedAt: now,
                        appliedBy: userId,
                        proposalId,
                        floorplanFileId,
                        placementIds: [...recoveredPlacementIds, ...placementIds],
                        annotationIds: [...recoveredAnnotationIds, ...annotationIds]
                    }
                    const updatedRecord = { ...record, floorplanPlacementApplications: [application, ...(record.floorplanPlacementApplications || [])].slice(0, 200) }
                    let applicationRecorded = true
                    try {
                        await FirewireDocumentAnalysisData.saveAnalysisRecord(context.sqldb, updatedRecord, userId)
                    } catch (storageError) {
                        applicationRecorded = false
                        console.error('[document-inspection] Floorplan symbols placed but analysis application history could not be persisted.', {
                            analysisId: record.id,
                            proposalId,
                            floorplanFileId,
                            message: storageError instanceof Error ? storageError.message : String(storageError || '')
                        })
                    }
                    return res.status(200).json({ data: { record: FirewireDocumentAnalysisData.toClientRecord(updatedRecord), application, applicationRecorded, alreadyApplied: annotationIds.length === 0, file: floorplan, workspace: nextPayload, skipped } })
                } catch (err: Error | any) {
                    const statusCode = err instanceof DocumentAnalysisInputError ? err.statusCode : 500
                    return res.status(statusCode).json({ message: FirewireDocumentAnalysisData.getSafeErrorMessage(err) })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId',
            fx: async (req: express.Request, res: express.Response) => {
                console.info('[document-inspection] Inspection POST received.', {
                    projectId: String(req.params.projectId || ''),
                    documentId: String(req.params.fileId || ''),
                    versionId: String(req.params.versionId || '')
                })
                let runningRecord: DocumentAnalysisRecord | null = null
                let sqldb: SqlDb | null = null
                let inspectionKey = ''
                let inspectionLockAcquired = false
                try {
                    const context = await FirewireDocumentAnalysisData.resolveRequestContext(req)
                    if (!context) {
                        return res.status(404).json({ message: 'Project or document version was not found.' })
                    }
                    sqldb = context.sqldb

                    inspectionKey = FirewireDocumentAnalysisData.getInspectionKey(
                        context.project.uuid,
                        context.workspaceKey,
                        context.file.id,
                        context.version.id
                    )
                    if (FirewireDocumentAnalysisData.runningInspections.has(inspectionKey)) {
                        return res.status(409).json({
                            message: 'This document version is already being inspected.',
                            code: 'DOCUMENT_INSPECTION_IN_PROGRESS',
                            retryable: true
                        })
                    }
                    FirewireDocumentAnalysisData.assertProjectAnalysisWritable(context.project.uuid)
                    FirewireDocumentAnalysisData.runningInspections.add(inspectionKey)
                    const abortController = new AbortController()
                    FirewireDocumentAnalysisData.runningInspectionControllers.set(inspectionKey, abortController)
                    inspectionLockAcquired = true

                    const service = new OpenAiDocumentAnalysisService()
                    const requestedAt = new Date().toISOString()
                    const requestedBy = FirewireDocumentAnalysisData.resolveUserId(req)
                    runningRecord = {
                        id: `analysis-${randomUUID()}`,
                        projectId: context.project.uuid,
                        workspaceKey: context.workspaceKey,
                        documentId: context.file.id,
                        versionId: context.version.id,
                        sourceFilename: context.sourceFilename,
                        status: 'running',
                        schemaVersion: DOCUMENT_INSPECTION_SCHEMA_VERSION,
                        model: service.getConfiguredModel(),
                        requestedAt,
                        requestedBy,
                        completedAt: '',
                        openAiFileId: '',
                        openAiFileDeletedAt: '',
                        openAiResponseId: '',
                        openAiRequestId: '',
                        result: null,
                        error: '',
                        errorCode: '',
                        errorRetryable: true,
                        progress: FirewireDocumentAnalysisData.createProgress(
                            'queued',
                            'Inspection accepted. Preparing the document.',
                            5
                        )
                    }
                    await FirewireDocumentAnalysisData.saveAnalysisRecord(sqldb, runningRecord, requestedBy)
                    FirewireDocumentAnalysisData.logProgress(runningRecord)

                    runningRecord = await FirewireDocumentAnalysisData.updateProgress(
                        sqldb,
                        runningRecord,
                        'loading',
                        'Loading the selected document from project storage.',
                        15
                    )
                    const content = await FirewireDocumentAnalysisData.loadVersionContent(
                        context.workspaceKey,
                        context.version
                    )
                    runningRecord = await FirewireDocumentAnalysisData.updateProgress(
                        sqldb,
                        runningRecord,
                        'loaded',
                        `Document loaded (${FirewireDocumentAnalysisData.formatBytes(content.buffer.length)}).`,
                        25
                    )
                    const output = await service.inspectDocument({
                        buffer: content.buffer,
                        filename: context.sourceFilename,
                        mimeType: content.mimeType,
                        projectId: context.project.uuid,
                        documentId: context.file.id,
                        versionId: context.version.id,
                        projectContext: FirewireDocumentAnalysisData.createProjectContext(context.project),
                        signal: abortController.signal,
                        onOpenAiFileUploaded: async (fileId) => {
                            FirewireDocumentAnalysisData.activeOpenAiFileIds.set(inspectionKey, fileId)
                            if (!sqldb || !runningRecord) {
                                return
                            }
                            runningRecord = { ...runningRecord, openAiFileId: fileId }
                            await FirewireDocumentAnalysisData.saveAnalysisRecord(
                                sqldb,
                                runningRecord,
                                runningRecord.requestedBy
                            )
                        },
                        onOpenAiFileDeleted: async (fileId, deletedAt) => {
                            FirewireDocumentAnalysisData.activeOpenAiFileIds.delete(inspectionKey)
                            if (!sqldb || !runningRecord) {
                                return
                            }
                            runningRecord = {
                                ...runningRecord,
                                openAiFileId: fileId,
                                openAiFileDeletedAt: deletedAt
                            }
                            await FirewireDocumentAnalysisData.saveAnalysisRecord(
                                sqldb,
                                runningRecord,
                                runningRecord.requestedBy
                            )
                        },
                        onProgress: async (progress) => {
                            if (!sqldb || !runningRecord) {
                                return
                            }
                            runningRecord = await FirewireDocumentAnalysisData.updateProgress(
                                sqldb,
                                runningRecord,
                                progress.stage,
                                progress.message,
                                progress.percent
                            )
                        }
                    })
                    runningRecord = await FirewireDocumentAnalysisData.updateProgress(
                        sqldb,
                        runningRecord,
                        'catalog-matching',
                        'Matching extracted device candidates against the Firewire catalog.',
                        97
                    )
                    const catalogMatchedProposals = await FirewireDocumentAnalysisData.matchBomCatalogCandidates(
                        sqldb,
                        output.result.proposedBomActions || []
                    )
                    const currentProject = await new FirewireProjectRepository(req.app)
                        .getFirewireProject(context.project.uuid)
                    output.result.proposedBomActions = FirewireDocumentAnalysisData.annotateProjectBomMatches(
                        catalogMatchedProposals,
                        currentProject?.worksheetData || context.project.worksheetData
                    )
                    output.result.proposedFloorplanActions = FirewireDocumentAnalysisData.annotateFloorplanMatches(
                        output.result.proposedFloorplanActions || [],
                        await FirewireDocumentAnalysisData.loadDocumentLibraryPayload(context.sqldb, context.workspaceKey)
                    )

                    const completedRecord: DocumentAnalysisRecord = {
                        ...runningRecord,
                        status: 'completed',
                        model: output.model,
                        completedAt: new Date().toISOString(),
                        openAiFileId: output.openAiFileId,
                        openAiFileDeletedAt: output.openAiFileDeletedAt,
                        openAiResponseId: output.openAiResponseId,
                        openAiRequestId: output.openAiRequestId,
                        result: output.result,
                        error: '',
                        errorCode: '',
                        errorRetryable: true,
                        progress: FirewireDocumentAnalysisData.createProgress(
                            'completed',
                            'Inspection complete.',
                            100
                        )
                    }
                    await FirewireDocumentAnalysisData.saveAnalysisRecord(sqldb, completedRecord, requestedBy)
                    FirewireDocumentAnalysisData.logProgress(completedRecord)
                    return res.status(200).json({ data: FirewireDocumentAnalysisData.toClientRecord(completedRecord) })
                } catch (err: Error | any) {
                    const message = FirewireDocumentAnalysisData.getSafeErrorMessage(err)
                    if (sqldb && runningRecord) {
                        const wasCancelled = FirewireDocumentAnalysisData.userCancelledInspections.has(inspectionKey)
                        const failedRecord: DocumentAnalysisRecord = {
                            ...runningRecord,
                            status: wasCancelled ? 'cancelled' : 'failed',
                            completedAt: new Date().toISOString(),
                            error: wasCancelled ? 'Inspection canceled by the user.' : message,
                            errorCode: wasCancelled
                                ? 'DOCUMENT_INSPECTION_CANCELLED'
                                : err instanceof DocumentAnalysisProviderError ? err.code : 'DOCUMENT_INSPECTION_FAILED',
                            errorRetryable: wasCancelled || !(err instanceof DocumentAnalysisProviderError) || err.retryable,
                            progress: FirewireDocumentAnalysisData.createProgress(
                                wasCancelled ? 'cancelled' : 'failed',
                                wasCancelled ? 'Inspection canceled by the user.' : message,
                                100
                            )
                        }
                        try {
                            await FirewireDocumentAnalysisData.saveAnalysisRecord(sqldb, failedRecord, runningRecord.requestedBy)
                            FirewireDocumentAnalysisData.logProgress(failedRecord)
                        } catch (storageError) {
                            console.error('Failed to persist document inspection failure.', {
                                analysisId: runningRecord.id,
                                message: storageError instanceof Error ? storageError.message : String(storageError || '')
                            })
                        }
                    }

                    const statusCode = err instanceof DocumentAnalysisConfigurationError
                        ? 503
                        : err instanceof DocumentAnalysisProviderError
                            ? err.statusCode
                            : err instanceof DocumentAnalysisInputError
                                ? err.statusCode
                                : 500
                    return res.status(statusCode).json({
                        message,
                        ...(err instanceof DocumentAnalysisProviderError
                            ? { code: err.code, retryable: err.retryable }
                            : {})
                    })
                } finally {
                    if (inspectionLockAcquired) {
                        FirewireDocumentAnalysisData.runningInspections.delete(inspectionKey)
                        FirewireDocumentAnalysisData.runningInspectionControllers.delete(inspectionKey)
                        FirewireDocumentAnalysisData.userCancelledInspections.delete(inspectionKey)
                    }
                }
            }
        }
    ]

    private static async resolveRequestContext(req: express.Request): Promise<{
        project: FirewireProjectRecord
        workspaceKey: string
        file: DocumentLibraryFile & { id: string }
        version: DocumentLibraryVersion & { id: string }
        sourceFilename: string
        sqldb: SqlDb
    } | null> {
        const projectId = String(req.params.projectId || '').trim()
        const fileId = String(req.params.fileId || '').trim()
        const versionId = String(req.params.versionId || '').trim()
        const workspaceKey = String(req.body?.workspaceKey || req.query.workspaceKey || projectId).trim()
        if (!projectId || !workspaceKey || !fileId || !versionId) {
            throw new DocumentAnalysisInputError('projectId, workspaceKey, fileId, and versionId are required.', 400)
        }
        FirewireDocumentAnalysisData.assertProjectAnalysisWritable(projectId)

        const repository = new FirewireProjectRepository(req.app)
        const project = await repository.getFirewireProject(projectId)
        if (!project) {
            return null
        }

        const allowedWorkspaceKeys = new Set([
            project.uuid,
            project.projectNbr,
            project.fieldwireId || ''
        ].map((value) => String(value || '').trim()).filter(Boolean))
        if (!allowedWorkspaceKeys.has(workspaceKey)) {
            throw new DocumentAnalysisInputError('The requested document workspace does not belong to this project.', 403)
        }

        const sqldb = new SqlDb(req.app)
        const workspaceRecord = await sqldb.getWorkspaceStorage(DOCUMENT_LIBRARY_AREA, workspaceKey)
        const payload = FirewireDocumentAnalysisData.parsePayload(workspaceRecord?.payloadJson, { files: [] })
        const files: DocumentLibraryFile[] = Array.isArray(payload?.files) ? payload.files : []
        const file = files.find((item) => String(item?.id || '') === fileId)
        const version = file?.versions?.find((item) => String(item?.id || '') === versionId)
        if (!file?.id || !version?.id) {
            return null
        }

        const sourceFilename = String(version.sourceFileName || file.sourceFileName || file.name || 'document').trim()
        return {
            project,
            workspaceKey,
            file: file as DocumentLibraryFile & { id: string },
            version: version as DocumentLibraryVersion & { id: string },
            sourceFilename,
            sqldb
        }
    }

    private static async loadVersionContent(workspaceKey: string, version: DocumentLibraryVersion): Promise<{
        buffer: Buffer
        mimeType: string
    }> {
        if (version.blobName) {
            const storage = new AzureBlobDocumentStorage()
            if (!storage.isConfigured()) {
                throw new DocumentAnalysisConfigurationError(
                    'Document inspection cannot read the selected file because Azure Blob Storage is not configured.'
                )
            }
            const download = await storage.download(version.blobContainerName || workspaceKey, version.blobName)
            return {
                buffer: download.buffer,
                mimeType: download.contentType || version.mimeType || 'application/octet-stream'
            }
        }

        if (version.dataUrl) {
            const commaIndex = version.dataUrl.indexOf(',')
            const header = commaIndex >= 0 ? version.dataUrl.slice(0, commaIndex) : ''
            const encoded = commaIndex >= 0 ? version.dataUrl.slice(commaIndex + 1) : version.dataUrl
            const mimeTypeMatch = header.match(/data:(.*?);base64/)
            return {
                buffer: Buffer.from(encoded, 'base64'),
                mimeType: mimeTypeMatch?.[1] || version.mimeType || 'application/octet-stream'
            }
        }

        throw new DocumentAnalysisInputError('The selected document version has no readable content.', 404)
    }

    private static async loadAnalysisWorkspace(sqldb: SqlDb, projectId: string): Promise<DocumentAnalysisWorkspace> {
        const record = await sqldb.getWorkspaceStorage(DOCUMENT_ANALYSIS_AREA, projectId)
        const payload = FirewireDocumentAnalysisData.parsePayload(record?.payloadJson, {
            schemaVersion: DOCUMENT_INSPECTION_SCHEMA_VERSION,
            analyses: []
        })
        return {
            schemaVersion: DOCUMENT_INSPECTION_SCHEMA_VERSION,
            analyses: Array.isArray(payload?.analyses) ? payload.analyses : []
        }
    }

    private static async saveAnalysisRecord(sqldb: SqlDb, record: DocumentAnalysisRecord, updatedBy: string): Promise<void> {
        FirewireDocumentAnalysisData.assertProjectAnalysisWritable(record.projectId)
        const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(sqldb, record.projectId)
        const analyses = workspace.analyses.filter((item) => !(
            item.workspaceKey === record.workspaceKey
            && item.documentId === record.documentId
            && item.versionId === record.versionId
        ))
        analyses.unshift(record)
        await sqldb.saveWorkspaceStorage(DOCUMENT_ANALYSIS_AREA, record.projectId, JSON.stringify({
            schemaVersion: DOCUMENT_INSPECTION_SCHEMA_VERSION,
            analyses: analyses.slice(0, 500)
        }), updatedBy)
    }

    private static async updateProgress(
        sqldb: SqlDb,
        record: DocumentAnalysisRecord,
        stage: string,
        message: string,
        percent: number
    ): Promise<DocumentAnalysisRecord> {
        const updatedRecord = {
            ...record,
            progress: FirewireDocumentAnalysisData.createProgress(stage, message, percent)
        }
        await FirewireDocumentAnalysisData.saveAnalysisRecord(sqldb, updatedRecord, record.requestedBy)
        FirewireDocumentAnalysisData.logProgress(updatedRecord)
        return updatedRecord
    }

    private static createProgress(stage: string, message: string, percent: number): DocumentAnalysisProgress {
        return {
            stage,
            message,
            percent: Math.max(0, Math.min(100, Math.round(percent))),
            updatedAt: new Date().toISOString()
        }
    }

    private static getInspectionKey(projectId: string, workspaceKey: string, documentId: string, versionId: string): string {
        return [projectId, workspaceKey, documentId, versionId].join(':')
    }

    private static inspectionKeyBelongsToProject(inspectionKey: string, projectId: string): boolean {
        return inspectionKey.startsWith(`${projectId}:`)
    }

    private static assertProjectAnalysisWritable(projectId: string): void {
        const normalizedProjectId = String(projectId || '').trim()
        if (FirewireDocumentAnalysisData.deletingProjectIds.has(normalizedProjectId)
            || FirewireDocumentAnalysisData.deletedProjectIds.has(normalizedProjectId)) {
            throw new DocumentAnalysisInputError(
                'Document analysis is unavailable because this project is being deleted or has been deleted.',
                409
            )
        }
    }

    private static normalizeDeviceText(value: unknown, maxLength: number): string {
        return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    }

    private static normalizeRequiredDeviceText(value: unknown, label: string, maxLength: number): string {
        const normalized = FirewireDocumentAnalysisData.normalizeDeviceText(value, maxLength)
        if (!normalized) {
            throw new DocumentAnalysisInputError(`${label} is required.`, 400)
        }
        return normalized
    }

    private static logProgress(record: DocumentAnalysisRecord): void {
        const elapsedSeconds = Math.max(0, Math.round(
            (Date.now() - new Date(record.requestedAt).getTime()) / 1000
        ))
        console.info('[document-inspection]', {
            analysisId: record.id,
            projectId: record.projectId,
            documentId: record.documentId,
            versionId: record.versionId,
            stage: record.progress?.stage || record.status,
            percent: record.progress?.percent ?? 0,
            elapsedSeconds,
            message: record.progress?.message || ''
        })
    }

    private static formatBytes(sizeBytes: number): string {
        return sizeBytes >= 1024 * 1024
            ? `${(sizeBytes / (1024 * 1024)).toFixed(2)} MB`
            : `${Math.max(1, Math.round(sizeBytes / 1024))} KB`
    }

    private static createProjectContext(project: FirewireProjectRecord) {
        const customerInfo = project.worksheetData?.customerInfo || {}
        const reportSettings = project.worksheetData?.reportSettings || {}
        const reportLines = (value: unknown): string => (Array.isArray(value) ? value : [])
            .filter((item: any) => item?.included !== false)
            .map((item: any) => String(item?.label || item?.description || '').trim())
            .filter(Boolean)
            .join('\n')
        return {
            name: String(project.name || ''),
            projectNbr: String(project.projectNbr || ''),
            address: String(project.address || ''),
            bidDueDate: String(project.bidDueDate || ''),
            projectType: String(project.projectType || ''),
            jobType: String(project.jobType || ''),
            scopeType: String(project.scopeType || ''),
            projectScope: String(project.projectScope || ''),
            totalSqFt: Number(project.totalSqFt || 0),
            customerInfo: {
                billingName: String(customerInfo.billingName || ''),
                businessPointOfContactName: String(customerInfo.businessPointOfContactName || ''),
                billingAddress: String(customerInfo.billingAddress || ''),
                billingEmail: String(customerInfo.billingEmail || ''),
                billingPhone: String(customerInfo.billingPhone || ''),
                contractOrPoNumber: String(customerInfo.contractOrPoNumber || '')
            },
            reportSettings: {
                inclusions: reportLines(reportSettings.inclusions),
                exclusions: reportLines(reportSettings.exclusions)
            }
        }
    }

    private static async loadDocumentLibraryPayload(sqldb: SqlDb, workspaceKey: string): Promise<any> {
        const record = await sqldb.getWorkspaceStorage(DOCUMENT_LIBRARY_AREA, workspaceKey)
        return FirewireDocumentAnalysisData.parsePayload(record?.payloadJson, { files: [] })
    }

    private static async findCompletedAnalysisRecord(context: any, analysisId: string): Promise<DocumentAnalysisRecord | null> {
        if (!analysisId) throw new DocumentAnalysisInputError('analysisId is required.', 400)
        const workspace = await FirewireDocumentAnalysisData.loadAnalysisWorkspace(context.sqldb, context.project.uuid)
        return workspace.analyses.find((item) =>
            item.id === analysisId
            && item.workspaceKey === context.workspaceKey
            && item.documentId === context.file.id
            && item.versionId === context.version.id
            && item.status === 'completed'
            && !!item.result) || null
    }

    private static annotateFloorplanMatches(proposals: DocumentAnalysisFloorplanProposal[], payload: any): DocumentAnalysisFloorplanProposal[] {
        const files: DocumentLibraryFile[] = Array.isArray(payload?.files) ? payload.files : []
        const floorplans = files.filter((file) => String(file.folderId || '') === 'floorplans')
        return proposals.map((proposal) => {
            const key = FirewireDocumentAnalysisData.normalizeFloorplanName(proposal.name)
            const existing = floorplans.find((file) => {
                const names = [file.name, file.sourceFileName, ...(file.versions || []).map((version) => version.sourceFileName)]
                return names.some((name) => FirewireDocumentAnalysisData.normalizeFloorplanName(name) === key)
            })
            return {
                ...proposal,
                floorplanMatch: existing
                    ? {
                        status: 'ALREADY_EXISTS',
                        floorplanFileId: String(existing.id || ''),
                        rationale: 'A project floorplan with the same normalized drawing name already exists.'
                    }
                    : {
                        status: 'MISSING',
                        floorplanFileId: '',
                        rationale: 'No project floorplan with this normalized drawing name was found.'
                    }
            }
        })
    }

    private static normalizeFloorplanName(value: unknown): string {
        return String(value || '')
            .replace(/\.[a-z0-9]{1,8}$/i, '')
            .toLocaleLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
    }

    private static sanitizeFloorplanFileName(value: unknown): string {
        return String(value || 'floorplan').replace(/[<>:"/\\|?*\x00-\x1f]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 160) || 'floorplan'
    }

    private static sanitizePathSegment(value: unknown): string {
        return String(value || 'item').trim().replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-').slice(0, 180) || 'item'
    }

    private static findBomRow(worksheetData: any, bomRowId: string): any | null {
        for (const section of Array.isArray(worksheetData?.bomSections) ? worksheetData.bomSections : []) {
            const row = (Array.isArray(section?.rows) ? section.rows : []).find((candidate: any) => String(candidate?.id || candidate?.bomRowId || '') === bomRowId)
            if (row) return row
        }
        return null
    }

    private static createFloorplanAnnotation(row: any, placement: any, record: DocumentAnalysisRecord): any {
        const bomRowId = String(row.id || row.bomRowId || '')
        const categoryName = String(row.type || row.description || row.partNbr || 'BOM Item').trim()
        const deviceName = String(row.description || row.partNbr || categoryName).trim()
        const label = String(row.floorplanLabelText || placement.symbolLabel || '').replace(/\s+/g, '').slice(0, 4)
            || categoryName.split(/[^a-z0-9]+/i).filter(Boolean).map((word) => word[0]).join('').slice(0, 3).toUpperCase()
            || 'SY'
        const categoryKey = `category-${categoryName.toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'}`
        return {
            id: `ai-symbol-${randomUUID()}`,
            kind: 'symbol',
            xRatio: Math.max(0, Math.min(1, Number(placement.xRatio || 0))),
            yRatio: Math.max(0, Math.min(1, Number(placement.yRatio || 0))),
            bomRowId,
            symbolId: `bom-row-${bomRowId}`,
            categoryKey,
            deviceId: String(row.deviceId || row.sourceDeviceId || '') || undefined,
            categoryName,
            partNumber: String(row.partNbr || ''),
            deviceName,
            shortName: String(row.shortName || ''),
            floorplanLabelText: label,
            partDescription: String(row.partDescription || row.description || ''),
            iconId: row.iconId || null,
            iconLabel: row.iconLabel || null,
            iconDataUrl: row.iconDataUrl || null,
            iconForegroundColor: row.iconForegroundColor || null,
            materialCost: Number(row.cost || 0),
            laborHours: Number(row.labor || 0),
            customAttributes: FirewireDocumentAnalysisData.cloneJson(Array.isArray(row.customAttributes) ? row.customAttributes : []),
            tags: FirewireDocumentAnalysisData.cloneJson(Array.isArray(row.tags) ? row.tags : []),
            mediaFiles: FirewireDocumentAnalysisData.cloneJson(Array.isArray(row.mediaFiles) ? row.mediaFiles : []),
            symbol: label,
            label: deviceName,
            color: '#77d7ff',
            sourceAnalysisId: record.id,
            sourceDocumentId: record.documentId,
            sourceDocumentVersionId: record.versionId,
            sourcePlacementId: String(placement.placementId || ''),
            sourceConfidence: Math.max(0, Math.min(1, Number(placement.confidence || 0)))
        }
    }

    private static getProjectContextValue(
        context: ReturnType<typeof FirewireDocumentAnalysisData.createProjectContext>,
        targetField: DocumentAnalysisProjectField
    ): string {
        if (targetField.startsWith('customerInfo.')) {
            const customerField = targetField.slice('customerInfo.'.length) as keyof typeof context.customerInfo
            return String(context.customerInfo[customerField] || '')
        }
        if (targetField.startsWith('reportSettings.')) {
            const reportField = targetField.slice('reportSettings.'.length) as keyof typeof context.reportSettings
            return String(context.reportSettings[reportField] || '')
        }
        const value = context[targetField as keyof Omit<typeof context, 'customerInfo' | 'reportSettings'>]
        return String(value ?? '')
    }

    private static valuesEqual(valueType: string, left: string, right: string): boolean {
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
        return String(left || '').trim().toLocaleLowerCase() === String(right || '').trim().toLocaleLowerCase()
    }

    private static createProjectUpdateInput(project: FirewireProjectRecord): any {
        return {
            fieldwireId: project.fieldwireId,
            worksheetData: JSON.parse(JSON.stringify(project.worksheetData || {})),
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            bidDueDate: project.bidDueDate,
            projectStatus: project.projectStatus,
            projectType: project.projectType,
            salesman: project.salesman,
            jobType: project.jobType,
            scopeType: project.scopeType,
            projectScope: project.projectScope,
            difficulty: project.difficulty,
            totalSqFt: project.totalSqFt
        }
    }

    private static async createBomRowFromProposal(
        sqldb: SqlDb,
        project: FirewireProjectRecord,
        record: DocumentAnalysisRecord,
        proposal: DocumentAnalysisBomProposal
    ): Promise<any> {
        const bomRowId = randomUUID()
        const quantity = Math.max(1, Math.floor(Number(proposal.reconciledQuantity || 0)))
        const placementTarget = Math.max(0, Math.floor(Number(proposal.floorplanPlacementTarget || 0)))
        const source = {
            sourceAnalysisId: record.id,
            sourceProposalId: proposal.proposalId,
            sourceDocumentId: record.documentId,
            sourceDocumentVersionId: record.versionId,
            sourceFilename: record.sourceFilename,
            quantitySource: 'document-analysis',
            floorplanQuantityTarget: placementTarget
        }

        if (proposal.catalogMatch.entityType === 'DEVICE') {
            const deviceId = String(proposal.catalogMatch.deviceId || '').trim()
            const device = deviceId ? await sqldb.getDevice(deviceId) : null
            if (!device) {
                throw new DocumentAnalysisInputError(
                    `${proposal.deviceType || proposal.partNumber || 'The matched device'} is no longer available in the Firewire catalog. Re-inspect before applying it.`,
                    409
                )
            }
            const [deviceParts, attributes, tagsRecord, mediaRecord] = await Promise.all([
                sqldb.getVwDeviceMaterials().then((rows) => rows.filter((row) => String(row.deviceId || '') === deviceId)),
                sqldb.getMaterialAttributesByDeviceId(deviceId),
                sqldb.getWorkspaceStorage('device-tags', deviceId),
                sqldb.getWorkspaceStorage('device-media', deviceId)
            ])
            const bomRowParts = deviceParts.map((part) => ({
                bomRowPartId: randomUUID(),
                deviceId,
                devicePartId: String(part.devicePartId || part.materialId || '').trim() || null,
                partId: String(part.partId || '').trim() || null,
                vendorId: String(part.vendorId || device.vendorId || '').trim() || null,
                vendorName: String(part.vendorName || part.org || device.vendorName || '').trim() || null,
                partNumber: String(part.materialPartNumber || part.partNumber || '').trim(),
                description: String(part.materialName || '').trim(),
                parentCategory: String(part.parentCategory || '').trim() || null,
                category: String(part.category || part.materialCategoryName || '').trim() || null,
                msrp: Number(part.materialMsrp || 0),
                cost: Number(part.materialCost ?? part.cost ?? 0),
                quantityPerDevice: Math.max(1, Math.floor(Number(part.quantityPerDevice || 1)))
            })).filter((part) => !!part.partNumber)
            const snapshotCost = bomRowParts.length > 0
                ? bomRowParts.reduce((sum, part) => sum + Number(part.cost || 0) * part.quantityPerDevice, 0)
                : Number(device.cost || 0)
            const partDescriptions = [...new Set(bomRowParts
                .map((part) => String(part.description || '').replace(/\s+/g, ' ').trim())
                .filter(Boolean))]
            const deviceName = String(device.name || device.shortName || proposal.description || proposal.deviceType || '').replace(/\s+/g, ' ').trim()
            const description = [deviceName, partDescriptions.join('; ')]
                .filter(Boolean)
                .filter((value, index, values) => values.findIndex((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase()) === index)
                .join(' - ')
            const tagsPayload = FirewireDocumentAnalysisData.parsePayload(tagsRecord?.payloadJson, { tags: [] })
            const mediaPayload = FirewireDocumentAnalysisData.parsePayload(mediaRecord?.payloadJson, { files: [] })
            return {
                id: bomRowId,
                deviceId,
                sourceDeviceId: deviceId,
                sourcePartId: null,
                sourceKind: 'device',
                partNbr: String(device.partNumber || proposal.partNumber || proposal.modelNumber || '').trim(),
                description,
                qty: quantity,
                cost: FirewireDocumentAnalysisData.roundBomMoney(snapshotCost),
                labor: FirewireDocumentAnalysisData.getBomLaborCost(project, device.defaultLabor),
                includeOnFloorplan: !!device.includeOnFloorplan,
                floorplanReady: !!device.includeOnFloorplan,
                type: String(device.categoryName || proposal.deviceType || '').trim(),
                iconId: device.iconId || null,
                iconLabel: device.iconLabel || null,
                iconDataUrl: device.iconDataUrl || null,
                iconForegroundColor: device.iconForegroundColor || null,
                shortName: String(device.shortName || '').trim() || null,
                floorplanLabelText: String(device.floorplanLabelText || proposal.symbolLabel || '').trim().slice(0, 4) || null,
                customAttributes: (attributes || []).map((attribute) => ({
                    name: String(attribute.name || '').trim(),
                    value: String(attribute.defaultValue || '').trim(),
                    defaultValue: String(attribute.defaultValue || '').trim(),
                    valueType: String(attribute.valueType || 'text').trim() || 'text',
                    isReadOnly: !!attribute.isReadOnly
                })).filter((attribute) => !!attribute.name),
                tags: FirewireDocumentAnalysisData.normalizeBomTags(tagsPayload?.tags),
                mediaFiles: FirewireDocumentAnalysisData.normalizeBomMediaFiles(mediaPayload?.files),
                bomRowParts,
                ...source
            }
        }

        const partId = String(proposal.catalogMatch.partId || '').trim()
        const parts = await sqldb.getParts()
        const part = parts.find((candidate) => String(candidate.partId || '') === partId)
        if (!part) {
            throw new DocumentAnalysisInputError(
                `${proposal.partNumber || proposal.deviceType || 'The matched part'} is no longer available in the master parts catalog. Re-inspect before applying it.`,
                409
            )
        }
        const partNumber = String(part.partNumber || part.PartNumber || '').trim()
        const partCost = Number(part.cost ?? part.SalesPrice ?? 0)
        return {
            id: bomRowId,
            deviceId: null,
            sourceDeviceId: null,
            sourcePartId: partId,
            sourceKind: 'part',
            partNbr: partNumber,
            description: String(part.description || part.LongDescription || proposal.description || proposal.deviceType || '').trim(),
            qty: quantity,
            cost: FirewireDocumentAnalysisData.roundBomMoney(partCost),
            labor: FirewireDocumentAnalysisData.getBomLaborCost(project, null),
            includeOnFloorplan: false,
            floorplanReady: false,
            type: String(part.category || part.Category || proposal.deviceType || '').trim(),
            iconId: null,
            iconLabel: null,
            iconDataUrl: null,
            iconForegroundColor: null,
            shortName: null,
            floorplanLabelText: String(proposal.symbolLabel || '').trim().slice(0, 4) || null,
            customAttributes: [],
            tags: [],
            mediaFiles: [],
            bomRowParts: [{
                bomRowPartId: randomUUID(),
                deviceId: null,
                devicePartId: null,
                partId,
                vendorId: String(part.vendorId || '').trim() || null,
                vendorName: String(part.vendorName || part.sourceVendorName || part.brand || '').trim() || null,
                partNumber,
                description: String(part.description || part.LongDescription || '').trim(),
                parentCategory: String(part.parentCategory || part.ParentCategory || '').trim() || null,
                category: String(part.category || part.Category || '').trim() || null,
                msrp: Number(part.msrp ?? part.MSRPPrice ?? 0),
                cost: partCost,
                quantityPerDevice: 1
            }],
            ...source
        }
    }

    private static getBomLaborCost(project: FirewireProjectRecord, defaultLabor: unknown): number {
        const defaultHourlyRate = 56
        const baselineCost = defaultLabor === null || typeof defaultLabor === 'undefined' || defaultLabor === ''
            ? defaultHourlyRate * 2
            : Number(defaultLabor)
        const laborRates = Array.isArray(project.worksheetData?.laborRates) ? project.worksheetData.laborRates : []
        const installation = laborRates.find((rate: any) => String(rate?.label || '').trim().toLocaleLowerCase() === 'installation')
        const installationRate = Number(installation?.effectiveRate || installation?.payRate || defaultHourlyRate)
        const normalizedBaseline = Number.isFinite(baselineCost) ? baselineCost : defaultHourlyRate * 2
        return FirewireDocumentAnalysisData.roundBomMoney((normalizedBaseline / defaultHourlyRate) * installationRate)
    }

    private static getLegendIconLabel(proposal: DocumentAnalysisBomProposal, fallbackName: string): string {
        return [proposal.symbolLabel, proposal.deviceType, fallbackName]
            .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
            .find(Boolean)
            ?.slice(0, 200) || 'Inspection legend symbol'
    }

    private static roundBomMoney(value: unknown): number {
        const numeric = Number(value || 0)
        return Number.isFinite(numeric) && numeric > 0 ? Math.ceil(numeric) : 0
    }

    private static normalizeBomTags(input: unknown): Array<{ id: string, label: string }> {
        if (!Array.isArray(input)) return []
        const seen = new Set<string>()
        return input.map((tag: any) => {
            const label = String(tag?.label ?? tag ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
            return { id: String(tag?.id || '').trim() || randomUUID(), label }
        }).filter((tag) => {
            const key = tag.label.toLocaleLowerCase()
            if (!tag.label || seen.has(key)) return false
            seen.add(key)
            return true
        })
    }

    private static normalizeBomMediaFiles(input: unknown): Array<{
        id: string
        fileName: string
        mimeType?: string
        sizeBytes?: number
        uploadedAt?: string
    }> {
        if (!Array.isArray(input)) return []
        return input.map((file: any) => ({
            id: String(file?.id || '').trim(),
            fileName: String(file?.fileName || file?.name || '').trim(),
            mimeType: String(file?.mimeType || '').trim() || undefined,
            sizeBytes: typeof file?.sizeBytes === 'undefined' || file?.sizeBytes === null ? undefined : Number(file.sizeBytes),
            uploadedAt: String(file?.uploadedAt || '').trim() || undefined
        })).filter((file) => !!file.id && !!file.fileName)
    }

    private static cloneJson<T>(value: T): T {
        return JSON.parse(JSON.stringify(value)) as T
    }

    private static applyProjectProposal(input: any, proposal: DocumentAnalysisProjectDetailProposal): void {
        const value = String(proposal.proposedValue || '').trim()
        if (!value) {
            throw new DocumentAnalysisInputError(`${proposal.fieldLabel} has no proposed value.`, 400)
        }
        if (proposal.targetField.startsWith('customerInfo.')) {
            const customerField = proposal.targetField.slice('customerInfo.'.length)
            input.worksheetData = input.worksheetData || {}
            input.worksheetData.customerInfo = input.worksheetData.customerInfo || {}
            input.worksheetData.customerInfo[customerField] = value
            return
        }
        if (proposal.targetField === 'reportSettings.inclusions' || proposal.targetField === 'reportSettings.exclusions') {
            const listKey = proposal.targetField.slice('reportSettings.'.length)
            const proposedLines = value.split(/\r?\n|\s*;\s*/).map((line) => line.replace(/^[-*•]\s*/, '').trim()).filter(Boolean)
            input.worksheetData = input.worksheetData || {}
            input.worksheetData.reportSettings = input.worksheetData.reportSettings || {}
            input.worksheetData.reportSettings[listKey] = proposedLines.map((line, index) => ({
                settingId: `analysis-${randomUUID()}`,
                label: line,
                description: '',
                sortOrder: index * 10,
                included: true
            }))
            return
        }
        if (proposal.targetField === 'totalSqFt') {
            const numberValue = Number(value.replace(/,/g, ''))
            if (!Number.isFinite(numberValue) || numberValue < 0) {
                throw new DocumentAnalysisInputError('Square footage must be a non-negative number.', 400)
            }
            input.totalSqFt = numberValue
            return
        }
        if (proposal.targetField === 'bidDueDate') {
            const parsed = Date.parse(value)
            if (!Number.isFinite(parsed)) {
                throw new DocumentAnalysisInputError('Bid due date must be a valid date.', 400)
            }
            input.bidDueDate = new Date(parsed).toISOString()
            return
        }
        if (proposal.targetField === 'projectType' && !['Fire Alarm', 'Sprinkler', 'Security'].includes(value)) {
            throw new DocumentAnalysisInputError('Project type must be Fire Alarm, Sprinkler, or Security.', 400)
        }
        input[proposal.targetField] = value
    }

    private static isProjectValidationError(err: unknown): boolean {
        const message = err instanceof Error ? err.message : ''
        return /required|invalid|cannot be changed|must be|maximum|too long/i.test(message)
    }

    private static async matchBomCatalogCandidates(
        sqldb: SqlDb,
        proposals: DocumentAnalysisBomProposal[]
    ): Promise<DocumentAnalysisBomProposal[]> {
        if (proposals.length === 0) {
            return proposals
        }
        try {
            const [devices, deviceParts, masterParts] = await Promise.all([
                sqldb.getVwDevices(),
                sqldb.getVwDeviceMaterials(),
                sqldb.getParts()
            ])
            const partsByDevice = new Map<string, any[]>()
            for (const part of deviceParts) {
                const deviceId = String(part.deviceId || '').trim()
                if (!deviceId) continue
                partsByDevice.set(deviceId, [...(partsByDevice.get(deviceId) || []), part])
            }

            return proposals.map((proposal) => {
                const ranked = [
                    ...devices.map((device) => {
                        const parts = partsByDevice.get(String(device.deviceId || '').trim()) || []
                        return FirewireDocumentAnalysisData.scoreCatalogDevice(proposal, device, parts)
                    }),
                    ...masterParts.map((part) => FirewireDocumentAnalysisData.scoreCatalogPart(proposal, part))
                ].filter((candidate) => candidate.score > 0)
                    .sort((left, right) => right.score - left.score)
                const best = ranked[0]
                if (!best || best.score < 0.5) {
                    return {
                        ...proposal,
                        catalogMatch: {
                            status: 'NOT_FOUND' as const,
                            entityType: 'NONE' as const,
                            deviceId: '',
                            deviceName: '',
                            partId: '',
                            partNumber: '',
                            vendorName: '',
                            confidence: best?.score || 0,
                            rationale: 'No sufficiently similar Firewire device or master part was found. Human catalog review is required.'
                        }
                    }
                }
                const next = ranked[1]
                const sameIdentifierAcrossDeviceAndPart = !!next
                    && best.entityType !== next.entityType
                    && FirewireDocumentAnalysisData.normalizeCatalogIdentifier(best.item.partNumber || best.item.PartNumber)
                        === FirewireDocumentAnalysisData.normalizeCatalogIdentifier(next.item.partNumber || next.item.PartNumber)
                const ambiguous = !!next
                    && (best.score - next.score) < 0.05
                    && !sameIdentifierAcrossDeviceAndPart
                const matched = best.score >= 0.9 && !ambiguous
                return {
                    ...proposal,
                    catalogMatch: {
                        status: matched ? 'MATCHED' as const : 'POSSIBLE' as const,
                        entityType: best.entityType,
                        deviceId: best.entityType === 'DEVICE' ? String(best.item.deviceId || '') : '',
                        deviceName: best.entityType === 'DEVICE' ? String(best.item.name || best.item.shortName || '') : '',
                        partId: best.entityType === 'PART' ? String(best.item.partId || '') : '',
                        partNumber: String(best.item.partNumber || best.item.PartNumber || ''),
                        vendorName: String(best.item.vendorName || best.item.sourceVendorName || ''),
                        confidence: Math.min(1, Math.max(0, best.score)),
                        rationale: matched
                            ? `Matched ${best.entityType === 'DEVICE' ? 'Firewire device' : 'master part'} by ${best.reasons.join(', ')}.`
                            : `Possible ${best.entityType === 'DEVICE' ? 'device' : 'master part'} match by ${best.reasons.join(', ') || 'similar catalog text'}; confirm before creating a BOM row${ambiguous ? ' because another catalog result scored similarly' : ''}.`
                    }
                }
            })
        } catch (error) {
            console.error('[document-inspection] Firewire device/part catalog matching failed.', {
                message: error instanceof Error ? error.message : String(error || '')
            })
            return proposals
        }
    }

    private static annotateProjectBomMatches(
        proposals: DocumentAnalysisBomProposal[],
        worksheetData: any
    ): DocumentAnalysisBomProposal[] {
        const bomRows = (Array.isArray(worksheetData?.bomSections) ? worksheetData.bomSections : [])
            .flatMap((section: any) => (Array.isArray(section?.rows) ? section.rows : []).map((row: any) => ({
                row,
                sectionTitle: String(section?.title || '').trim()
            })))
        const seenProposalEntities = new Set<string>()

        return proposals.map((proposal) => {
            const entityKey = FirewireDocumentAnalysisData.getBomProposalEntityKey(proposal)
            if (!entityKey) {
                return {
                    ...proposal,
                    projectBomMatch: {
                        status: 'NOT_EVALUATED',
                        bomRowId: '',
                        bomSectionTitle: '',
                        quantity: 0,
                        rationale: 'An exact catalog device or part match is required before checking the project BOM.'
                    }
                }
            }

            const existing = bomRows.find(({ row }: { row: any }) =>
                FirewireDocumentAnalysisData.bomRowMatchesProposalEntity(row, proposal))
            if (existing) {
                seenProposalEntities.add(entityKey)
                return {
                    ...proposal,
                    projectBomMatch: {
                        status: 'ALREADY_ON_BOM',
                        bomRowId: String(existing.row?.id || existing.row?.bomRowId || '').trim(),
                        bomSectionTitle: existing.sectionTitle,
                        quantity: Number(existing.row?.qty ?? existing.row?.quantity ?? 0),
                        rationale: 'The exact matched catalog entity is already represented by a project BOM row.'
                    }
                }
            }

            if (seenProposalEntities.has(entityKey)) {
                return {
                    ...proposal,
                    projectBomMatch: {
                        status: 'DUPLICATE_PROPOSAL',
                        bomRowId: '',
                        bomSectionTitle: '',
                        quantity: 0,
                        rationale: 'Another proposal in this inspection resolves to the same catalog entity.'
                    }
                }
            }
            seenProposalEntities.add(entityKey)
            return {
                ...proposal,
                projectBomMatch: {
                    status: 'NOT_ON_BOM',
                    bomRowId: '',
                    bomSectionTitle: '',
                    quantity: 0,
                    rationale: 'No BOM row for the exact matched catalog entity was found on this project.'
                }
            }
        })
    }

    private static getBomProposalEntityKey(proposal: DocumentAnalysisBomProposal): string {
        if (proposal.catalogMatch.status !== 'MATCHED') return ''
        if (proposal.catalogMatch.entityType === 'DEVICE' && proposal.catalogMatch.deviceId) {
            return `device:${String(proposal.catalogMatch.deviceId).trim().toLocaleLowerCase()}`
        }
        if (proposal.catalogMatch.entityType === 'PART' && proposal.catalogMatch.partId) {
            return `part:${String(proposal.catalogMatch.partId).trim().toLocaleLowerCase()}`
        }
        return ''
    }

    private static bomRowMatchesProposalEntity(row: any, proposal: DocumentAnalysisBomProposal): boolean {
        const normalizeId = (value: unknown) => String(value || '').trim().toLocaleLowerCase()
        if (proposal.catalogMatch.entityType === 'DEVICE') {
            const deviceId = normalizeId(proposal.catalogMatch.deviceId)
            if (!deviceId) return false
            const rowDeviceIds = [row?.deviceId, row?.sourceDeviceId].map(normalizeId).filter(Boolean)
            if (rowDeviceIds.includes(deviceId)) return true
            return rowDeviceIds.length === 0
                && String(row?.sourceKind || '').trim().toLocaleLowerCase() === 'device'
                && FirewireDocumentAnalysisData.normalizeCatalogIdentifier(row?.partNbr)
                    === FirewireDocumentAnalysisData.normalizeCatalogIdentifier(proposal.catalogMatch.partNumber)
        }

        if (proposal.catalogMatch.entityType === 'PART') {
            const partId = normalizeId(proposal.catalogMatch.partId)
            if (!partId) return false
            const rowPartId = normalizeId(row?.sourcePartId)
            if (rowPartId === partId) return true
            return !rowPartId
                && String(row?.sourceKind || '').trim().toLocaleLowerCase() === 'part'
                && FirewireDocumentAnalysisData.normalizeCatalogIdentifier(row?.partNbr)
                    === FirewireDocumentAnalysisData.normalizeCatalogIdentifier(proposal.catalogMatch.partNumber)
        }
        return false
    }

    private static scoreCatalogDevice(proposal: DocumentAnalysisBomProposal, device: any, parts: any[]): {
        entityType: 'DEVICE'
        item: any
        score: number
        reasons: string[]
    } {
        let score = 0
        const reasons: string[] = []
        const candidateIdentifiers = FirewireDocumentAnalysisData.getCatalogCandidateIdentifiers(proposal)
        const deviceIdentifier = FirewireDocumentAnalysisData.normalizeCatalogIdentifier(device.partNumber)
        const linkedIdentifiers = parts.flatMap((part) => [part.materialPartNumber, part.partNumber])
            .map(FirewireDocumentAnalysisData.normalizeCatalogIdentifier)
            .filter(Boolean)
        if (deviceIdentifier && candidateIdentifiers.includes(deviceIdentifier)) {
            score = 1
            reasons.push('exact device part number')
        } else if (candidateIdentifiers.some((candidate) => linkedIdentifiers.includes(candidate))) {
            score = 0.94
            reasons.push('exact linked-part/model number')
        } else if (candidateIdentifiers.some((candidate) =>
            [deviceIdentifier, ...linkedIdentifiers].some((known) => candidate.length >= 5 && (known.includes(candidate) || candidate.includes(known))))) {
            score = Math.max(score, 0.82)
            reasons.push('partial part/model number')
        }

        const symbol = FirewireDocumentAnalysisData.normalizeCatalogText(proposal.symbolLabel)
        const catalogSymbols = [device.floorplanLabelText, device.shortName]
            .map(FirewireDocumentAnalysisData.normalizeCatalogText)
            .filter(Boolean)
        if (symbol && catalogSymbols.includes(symbol)) {
            score = Math.max(score, 0.7)
            reasons.push('floorplan symbol')
        }

        const candidateText = FirewireDocumentAnalysisData.normalizeCatalogText([
            proposal.deviceType,
            proposal.description,
            proposal.manufacturer
        ].join(' '))
        const deviceText = FirewireDocumentAnalysisData.normalizeCatalogText([
            device.name,
            device.shortName,
            device.categoryName,
            device.vendorName
        ].join(' '))
        const textSimilarity = FirewireDocumentAnalysisData.catalogTokenSimilarity(candidateText, deviceText)
        if (textSimilarity > 0) {
            score = Math.max(score, textSimilarity * 0.72)
            if (textSimilarity >= 0.5) reasons.push('device description')
        }

        const manufacturer = FirewireDocumentAnalysisData.normalizeCatalogText(proposal.manufacturer)
        const vendor = FirewireDocumentAnalysisData.normalizeCatalogText(device.vendorName)
        if (manufacturer && vendor && (manufacturer === vendor || manufacturer.includes(vendor) || vendor.includes(manufacturer))) {
            score = Math.min(1, score + 0.05)
            reasons.push('manufacturer')
        }
        return { entityType: 'DEVICE', item: device, score, reasons: [...new Set(reasons)] }
    }

    private static scoreCatalogPart(proposal: DocumentAnalysisBomProposal, part: any): {
        entityType: 'PART'
        item: any
        score: number
        reasons: string[]
    } {
        let score = 0
        const reasons: string[] = []
        const candidateIdentifiers = FirewireDocumentAnalysisData.getCatalogCandidateIdentifiers(proposal)
        const partIdentifier = FirewireDocumentAnalysisData.normalizeCatalogIdentifier(part.partNumber || part.PartNumber)
        if (partIdentifier && candidateIdentifiers.includes(partIdentifier)) {
            score = 0.98
            reasons.push('exact master part number')
        } else if (partIdentifier && candidateIdentifiers.some((candidate) =>
            candidate.length >= 5 && (partIdentifier.includes(candidate) || candidate.includes(partIdentifier)))) {
            score = 0.82
            reasons.push('partial master part number')
        }

        const candidateText = FirewireDocumentAnalysisData.normalizeCatalogText([
            proposal.deviceType,
            proposal.description
        ].join(' '))
        const partText = FirewireDocumentAnalysisData.normalizeCatalogText([
            part.description,
            part.LongDescription,
            part.brand,
            part.parentCategory,
            part.category
        ].join(' '))
        const textSimilarity = FirewireDocumentAnalysisData.catalogTokenSimilarity(candidateText, partText)
        if (textSimilarity > 0) {
            score = Math.max(score, textSimilarity * 0.72)
            if (textSimilarity >= 0.5) reasons.push('part description')
        }

        const manufacturer = FirewireDocumentAnalysisData.normalizeCatalogText(proposal.manufacturer)
        const catalogVendor = FirewireDocumentAnalysisData.normalizeCatalogText([
            part.brand,
            part.vendorName,
            part.sourceVendorName
        ].join(' '))
        if (manufacturer && catalogVendor && catalogVendor.includes(manufacturer)) {
            score = Math.min(1, score + 0.01)
            reasons.push('manufacturer')
        }
        return { entityType: 'PART', item: part, score, reasons: [...new Set(reasons)] }
    }

    private static normalizeCatalogIdentifier(value: unknown): string {
        return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]/g, '')
    }

    private static getCatalogCandidateIdentifiers(proposal: DocumentAnalysisBomProposal): string[] {
        const manufacturer = FirewireDocumentAnalysisData.normalizeCatalogIdentifier(proposal.manufacturer)
        const identifiers = [proposal.partNumber, proposal.modelNumber]
            .map(FirewireDocumentAnalysisData.normalizeCatalogIdentifier)
            .filter(Boolean)
        if (manufacturer) {
            for (const identifier of [...identifiers]) {
                if (identifier.startsWith(manufacturer) && identifier.length > manufacturer.length) {
                    identifiers.push(identifier.slice(manufacturer.length))
                }
            }
        }
        return [...new Set(identifiers)]
    }

    private static normalizeCatalogText(value: unknown): string {
        return String(value || '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
    }

    private static catalogTokenSimilarity(left: string, right: string): number {
        const leftTokens = new Set(left.split(' ').filter((token) => token.length > 1))
        const rightTokens = new Set(right.split(' ').filter((token) => token.length > 1))
        if (leftTokens.size === 0 || rightTokens.size === 0) return 0
        let matches = 0
        for (const token of leftTokens) {
            if (rightTokens.has(token)) matches += 1
        }
        return matches / leftTokens.size
    }

    private static parsePayload(value: string | null | undefined, fallback: any): any {
        if (!value) {
            return fallback
        }
        try {
            return JSON.parse(value)
        } catch {
            return fallback
        }
    }

    private static getSafeErrorMessage(err: unknown): string {
        if (err instanceof DocumentAnalysisConfigurationError || err instanceof DocumentAnalysisInputError) {
            return err.message
        }
        if (err instanceof SyntaxError) {
            return 'OpenAI returned an invalid structured document inspection response.'
        }
        return err instanceof Error && err.message
            ? err.message
            : 'Document inspection failed.'
    }

    private static toClientRecord(record: DocumentAnalysisRecord): Omit<
        DocumentAnalysisRecord,
        'openAiFileId' | 'openAiFileDeletedAt' | 'openAiResponseId' | 'openAiRequestId'
    > {
        const normalizedRecord = FirewireDocumentAnalysisData.normalizeLegacyFailure(record)
        const {
            openAiFileId,
            openAiFileDeletedAt,
            openAiResponseId,
            openAiRequestId,
            ...clientRecord
        } = normalizedRecord
        return clientRecord
    }

    private static normalizeLegacyFailure(record: DocumentAnalysisRecord): DocumentAnalysisRecord {
        if (record.status !== 'failed') {
            return record
        }

        const error = String(record.error || '')
        const normalizedError = error.toLowerCase()
        const isQuotaFailure = normalizedError.includes('no credits remaining')
            || normalizedError.includes('insufficient_quota')
        if (isQuotaFailure) {
            const message = 'OpenAI API credits were exhausted for this inspection attempt. Verify OpenAI Platform billing, then run a new inspection.'
            return {
                ...record,
                error: message,
                errorCode: 'OPENAI_QUOTA_EXCEEDED',
                errorRetryable: false,
                progress: record.progress || FirewireDocumentAnalysisData.createProgress('failed', message, 100)
            }
        }

        return {
            ...record,
            errorCode: record.errorCode || 'DOCUMENT_INSPECTION_FAILED',
            errorRetryable: record.errorRetryable !== false,
            progress: record.progress || FirewireDocumentAnalysisData.createProgress(
                'failed',
                error || 'The document inspection failed.',
                100
            )
        }
    }

    private static resolveUserId(req: express.Request): string {
        const tokenOutput = (req as any).bearerTokenOutput || {}
        const candidates = [
            tokenOutput.preferred_username,
            tokenOutput.upn,
            tokenOutput.email,
            tokenOutput.unique_name,
            tokenOutput.name,
            tokenOutput.oid,
            tokenOutput.sub
        ]
        const userId = candidates.map((value) => String(value || '').trim()).find(Boolean)
        if (!userId) {
            throw new Error('Unable to resolve request user context from bearer token.')
        }
        return userId
    }
}
