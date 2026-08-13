import * as express from 'express'
import { randomUUID } from 'node:crypto'

import { SqlDb } from '../../fieldwire/repository/sqldb'
import {
    DOCUMENT_INSPECTION_SCHEMA_VERSION
} from '../ai/document-analysis.schema'
import {
    DocumentAnalysisActionApplication,
    DocumentAnalysisBomActionApplication,
    DocumentAnalysisBomProposal,
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

const DOCUMENT_ANALYSIS_AREA = 'project-document-analysis'
const DOCUMENT_LIBRARY_AREA = 'project-doc-library'

type DocumentLibraryVersion = {
    id?: string
    sourceFileName?: string
    mimeType?: string
    sizeBytes?: number
    blobName?: string
    blobContainerName?: string
    dataUrl?: string
}

type DocumentLibraryFile = {
    id?: string
    name?: string
    sourceFileName?: string
    versions?: DocumentLibraryVersion[]
}

export class FirewireDocumentAnalysisData {
    private static readonly runningInspections = new Set<string>()
    private static readonly runningInspectionControllers = new Map<string, AbortController>()
    private static readonly userCancelledInspections = new Set<string>()

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
                        return res.status(404).json({ message: 'This document version has not been inspected.' })
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

                    return res.status(200).json({ data: FirewireDocumentAnalysisData.toClientRecord(record) })
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
                    const ineligible = (selected as DocumentAnalysisBomProposal[]).filter((proposal) =>
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
                    for (const proposal of selected as DocumentAnalysisBomProposal[]) {
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
                    output.result.proposedBomActions = await FirewireDocumentAnalysisData.matchBomCatalogCandidates(
                        sqldb,
                        output.result.proposedBomActions || []
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
            }
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
        const value = context[targetField as keyof Omit<typeof context, 'customerInfo'>]
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
