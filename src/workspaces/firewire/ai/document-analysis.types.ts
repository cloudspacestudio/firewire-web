export type DocumentAnalysisEvidenceType = 'DOCUMENT_FACT' | 'AI_INTERPRETATION' | 'ASSUMPTION' | 'UNRESOLVED_QUESTION'
export type DocumentAnalysisCodeStatus = 'DOCUMENT-STATED' | 'JURISDICTION-VERIFIED' | 'POTENTIALLY-APPLICABLE'
export type DocumentAnalysisRiskSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
export type DocumentAnalysisProjectField =
    | 'name'
    | 'projectNbr'
    | 'address'
    | 'bidDueDate'
    | 'projectType'
    | 'jobType'
    | 'scopeType'
    | 'projectScope'
    | 'totalSqFt'
    | 'customerInfo.billingName'
    | 'customerInfo.businessPointOfContactName'
    | 'customerInfo.billingAddress'
    | 'customerInfo.billingEmail'
    | 'customerInfo.billingPhone'
    | 'customerInfo.contractOrPoNumber'
export type DocumentAnalysisProjectValueType = 'TEXT' | 'NUMBER' | 'DATE'
export type DocumentAnalysisBomQuantityStatus = 'MATCHED' | 'SCHEDULE_ONLY' | 'DRAWING_ONLY' | 'CONFLICT' | 'UNKNOWN'
export type DocumentAnalysisCatalogMatchStatus = 'NOT_EVALUATED' | 'MATCHED' | 'POSSIBLE' | 'NOT_FOUND'
export type DocumentAnalysisCatalogEntityType = 'NONE' | 'DEVICE' | 'PART'

export interface DocumentAnalysisProgress {
    stage: string
    message: string
    percent: number
    updatedAt: string
}

export interface DocumentAnalysisSource {
    filename: string
    page: string
    section: string
    location: string
}

export interface DocumentAnalysisFinding {
    evidenceType: DocumentAnalysisEvidenceType
    text: string
    confidence: number
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisCodeFinding {
    code: string
    edition: string
    status: DocumentAnalysisCodeStatus
    verificationRequired: boolean
    explanation: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisRisk {
    severity: DocumentAnalysisRiskSeverity
    category: string
    description: string
    basis: string
    potentialImpact: string
    recommendedAction: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisProjectDetailProposal {
    actionType: 'UPDATE_PROJECT_DETAIL'
    targetField: DocumentAnalysisProjectField
    fieldLabel: string
    valueType: DocumentAnalysisProjectValueType
    currentValue: string
    proposedValue: string
    evidenceType: DocumentAnalysisEvidenceType
    confidence: number
    rationale: string
    source: DocumentAnalysisSource
}

export interface DocumentAnalysisBomProposal {
    proposalId: string
    actionType: 'ADD_BOM_DEVICE'
    deviceType: string
    symbolLabel: string
    manufacturer: string
    modelNumber: string
    partNumber: string
    description: string
    scheduleQuantityFound: boolean
    scheduleQuantity: number
    drawingQuantityFound: boolean
    drawingQuantity: number
    quantityStatus: DocumentAnalysisBomQuantityStatus
    reconciledQuantity: number
    floorplanSymbolFound: boolean
    floorplanPlacementTarget: number
    quantityRationale: string
    evidenceType: DocumentAnalysisEvidenceType
    confidence: number
    scheduleSource: DocumentAnalysisSource
    drawingSource: DocumentAnalysisSource
    catalogMatch: {
        status: DocumentAnalysisCatalogMatchStatus
        entityType: DocumentAnalysisCatalogEntityType
        deviceId: string
        deviceName: string
        partId: string
        partNumber: string
        vendorName: string
        confidence: number
        rationale: string
    }
}

export interface DocumentAnalysisProjectContext {
    name: string
    projectNbr: string
    address: string
    bidDueDate: string
    projectType: string
    jobType: string
    scopeType: string
    projectScope: string
    totalSqFt: number
    customerInfo: {
        billingName: string
        businessPointOfContactName: string
        billingAddress: string
        billingEmail: string
        billingPhone: string
        contractOrPoNumber: string
    }
}

export interface DocumentAnalysisActionApplication {
    id: string
    appliedAt: string
    appliedBy: string
    targetFields: DocumentAnalysisProjectField[]
    changes: Array<{
        targetField: DocumentAnalysisProjectField
        fieldLabel: string
        previousValue: string
        appliedValue: string
    }>
}

export interface DocumentAnalysisBomActionApplication {
    id: string
    appliedAt: string
    appliedBy: string
    proposalIds: string[]
    sectionKey: string
    rows: Array<{
        proposalId: string
        bomRowId: string
        entityType: 'DEVICE' | 'PART'
        deviceId: string
        partId: string
        quantity: number
        floorplanQuantityTarget: number
    }>
}

export interface DocumentInspectionResult {
    document: {
        originalFilename: string
        documentType: string
        discipline: string
        title: string
        documentNumber: string
        revision: string
        documentDate: string
        issuingOrganization: string
        summary: string
    }
    projectDetails: DocumentAnalysisFinding[]
    scope: {
        inclusions: DocumentAnalysisFinding[]
        exclusions: DocumentAnalysisFinding[]
        assumptions: DocumentAnalysisFinding[]
        customerResponsibilities: DocumentAnalysisFinding[]
        otherTradeResponsibilities: DocumentAnalysisFinding[]
        specificInstructions: DocumentAnalysisFinding[]
        limitations: DocumentAnalysisFinding[]
        alternates: DocumentAnalysisFinding[]
    }
    requirements: DocumentAnalysisFinding[]
    codes: DocumentAnalysisCodeFinding[]
    risks: DocumentAnalysisRisk[]
    openQuestions: DocumentAnalysisFinding[]
    proposedActions: DocumentAnalysisProjectDetailProposal[]
    proposedBomActions: DocumentAnalysisBomProposal[]
    executiveSummary: string
}

export interface DocumentAnalysisRecord {
    id: string
    projectId: string
    workspaceKey: string
    documentId: string
    versionId: string
    sourceFilename: string
    status: 'running' | 'completed' | 'failed' | 'cancelled'
    schemaVersion: number
    model: string
    requestedAt: string
    requestedBy: string
    completedAt: string
    openAiFileId: string
    openAiFileDeletedAt: string
    openAiResponseId: string
    openAiRequestId: string
    result: DocumentInspectionResult | null
    error: string
    errorCode: string
    errorRetryable: boolean
    progress?: DocumentAnalysisProgress
    actionApplications?: DocumentAnalysisActionApplication[]
    bomActionApplications?: DocumentAnalysisBomActionApplication[]
}

export interface DocumentAnalysisWorkspace {
    schemaVersion: number
    analyses: DocumentAnalysisRecord[]
}
