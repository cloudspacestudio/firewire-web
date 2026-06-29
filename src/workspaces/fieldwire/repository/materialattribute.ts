export interface MaterialAttribute {
    materialAttributeId: string
    name: string
    statusId: string
    materialId: string
    projectId: string
    valueType: string
    defaultValue: string
    isReadOnly?: boolean
    ordinal: number
    toBeValue: number | string | null
}
