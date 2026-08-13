const sourceSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        filename: { type: 'string' },
        page: { type: 'string' },
        section: { type: 'string' },
        location: { type: 'string' }
    },
    required: ['filename', 'page', 'section', 'location']
}

const findingSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        evidenceType: {
            type: 'string',
            enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'ASSUMPTION', 'UNRESOLVED_QUESTION']
        },
        text: { type: 'string' },
        confidence: { type: 'number' },
        source: sourceSchema
    },
    required: ['evidenceType', 'text', 'confidence', 'source']
}

const findingArraySchema = {
    type: 'array',
    items: findingSchema
}

const projectDetailProposalSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        actionType: { type: 'string', enum: ['UPDATE_PROJECT_DETAIL'] },
        targetField: {
            type: 'string',
            enum: [
                'name', 'projectNbr', 'address', 'bidDueDate', 'projectType', 'jobType',
                'scopeType', 'projectScope', 'totalSqFt', 'customerInfo.billingName',
                'customerInfo.businessPointOfContactName', 'customerInfo.billingAddress',
                'customerInfo.billingEmail', 'customerInfo.billingPhone',
                'customerInfo.contractOrPoNumber'
            ]
        },
        fieldLabel: { type: 'string' },
        valueType: { type: 'string', enum: ['TEXT', 'NUMBER', 'DATE'] },
        currentValue: { type: 'string' },
        proposedValue: { type: 'string' },
        evidenceType: {
            type: 'string',
            enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'ASSUMPTION', 'UNRESOLVED_QUESTION']
        },
        confidence: { type: 'number' },
        rationale: { type: 'string' },
        source: sourceSchema
    },
    required: [
        'actionType', 'targetField', 'fieldLabel', 'valueType', 'currentValue',
        'proposedValue', 'evidenceType', 'confidence', 'rationale', 'source'
    ]
}

const bomProposalSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        proposalId: { type: 'string' },
        actionType: { type: 'string', enum: ['ADD_BOM_DEVICE'] },
        deviceType: { type: 'string' },
        symbolLabel: { type: 'string' },
        manufacturer: { type: 'string' },
        modelNumber: { type: 'string' },
        partNumber: { type: 'string' },
        description: { type: 'string' },
        scheduleQuantityFound: { type: 'boolean' },
        scheduleQuantity: { type: 'integer', minimum: 0 },
        drawingQuantityFound: { type: 'boolean' },
        drawingQuantity: { type: 'integer', minimum: 0 },
        quantityStatus: { type: 'string', enum: ['MATCHED', 'SCHEDULE_ONLY', 'DRAWING_ONLY', 'CONFLICT', 'UNKNOWN'] },
        reconciledQuantity: { type: 'integer', minimum: 0 },
        floorplanSymbolFound: { type: 'boolean' },
        floorplanPlacementTarget: { type: 'integer', minimum: 0 },
        quantityRationale: { type: 'string' },
        evidenceType: {
            type: 'string',
            enum: ['DOCUMENT_FACT', 'AI_INTERPRETATION', 'ASSUMPTION', 'UNRESOLVED_QUESTION']
        },
        confidence: { type: 'number' },
        scheduleSource: sourceSchema,
        drawingSource: sourceSchema,
        catalogMatch: {
            type: 'object',
            additionalProperties: false,
            properties: {
                status: { type: 'string', enum: ['NOT_EVALUATED', 'MATCHED', 'POSSIBLE', 'NOT_FOUND'] },
                entityType: { type: 'string', enum: ['NONE', 'DEVICE', 'PART'] },
                deviceId: { type: 'string' },
                deviceName: { type: 'string' },
                partId: { type: 'string' },
                partNumber: { type: 'string' },
                vendorName: { type: 'string' },
                confidence: { type: 'number' },
                rationale: { type: 'string' }
            },
            required: [
                'status', 'entityType', 'deviceId', 'deviceName', 'partId', 'partNumber',
                'vendorName', 'confidence', 'rationale'
            ]
        }
    },
    required: [
        'proposalId', 'actionType', 'deviceType', 'symbolLabel', 'manufacturer', 'modelNumber',
        'partNumber', 'description', 'scheduleQuantityFound', 'scheduleQuantity',
        'drawingQuantityFound', 'drawingQuantity', 'quantityStatus', 'reconciledQuantity',
        'floorplanSymbolFound', 'floorplanPlacementTarget', 'quantityRationale', 'evidenceType',
        'confidence', 'scheduleSource', 'drawingSource', 'catalogMatch'
    ]
}

export const DOCUMENT_INSPECTION_SCHEMA_VERSION = 4

export const documentInspectionJsonSchema = {
    type: 'object',
    additionalProperties: false,
    properties: {
        document: {
            type: 'object',
            additionalProperties: false,
            properties: {
                originalFilename: { type: 'string' },
                documentType: { type: 'string' },
                discipline: { type: 'string' },
                title: { type: 'string' },
                documentNumber: { type: 'string' },
                revision: { type: 'string' },
                documentDate: { type: 'string' },
                issuingOrganization: { type: 'string' },
                summary: { type: 'string' }
            },
            required: [
                'originalFilename', 'documentType', 'discipline', 'title', 'documentNumber',
                'revision', 'documentDate', 'issuingOrganization', 'summary'
            ]
        },
        projectDetails: findingArraySchema,
        scope: {
            type: 'object',
            additionalProperties: false,
            properties: {
                inclusions: findingArraySchema,
                exclusions: findingArraySchema,
                assumptions: findingArraySchema,
                customerResponsibilities: findingArraySchema,
                otherTradeResponsibilities: findingArraySchema,
                specificInstructions: findingArraySchema,
                limitations: findingArraySchema,
                alternates: findingArraySchema
            },
            required: [
                'inclusions', 'exclusions', 'assumptions', 'customerResponsibilities',
                'otherTradeResponsibilities', 'specificInstructions', 'limitations', 'alternates'
            ]
        },
        requirements: findingArraySchema,
        codes: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    code: { type: 'string' },
                    edition: { type: 'string' },
                    status: {
                        type: 'string',
                        enum: ['DOCUMENT-STATED', 'JURISDICTION-VERIFIED', 'POTENTIALLY-APPLICABLE']
                    },
                    verificationRequired: { type: 'boolean' },
                    explanation: { type: 'string' },
                    source: sourceSchema
                },
                required: ['code', 'edition', 'status', 'verificationRequired', 'explanation', 'source']
            }
        },
        risks: {
            type: 'array',
            items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    severity: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] },
                    category: { type: 'string' },
                    description: { type: 'string' },
                    basis: { type: 'string' },
                    potentialImpact: { type: 'string' },
                    recommendedAction: { type: 'string' },
                    source: sourceSchema
                },
                required: ['severity', 'category', 'description', 'basis', 'potentialImpact', 'recommendedAction', 'source']
            }
        },
        openQuestions: findingArraySchema,
        proposedActions: {
            type: 'array',
            items: projectDetailProposalSchema
        },
        proposedBomActions: {
            type: 'array',
            items: bomProposalSchema
        },
        executiveSummary: { type: 'string' }
    },
    required: [
        'document', 'projectDetails', 'scope', 'requirements', 'codes',
        'risks', 'openQuestions', 'proposedActions', 'proposedBomActions', 'executiveSummary'
    ]
}
