export interface VwDeviceMaterial {
    devicePartId?: string
    partId?: string | null
    vendorId?: string
    vendorName?: string
    parentCategory?: string | null
    category?: string | null
    quantityPerDevice?: number
    deviceId: string
    deviceName: string
    deviceShortName: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    org: string
    materialId: string
    materialName: string
    materialShortName: string
    materialCategoryName?: string
    materialPartNumber: string
    materialLink: string
    materialMsrp?: number
    materialCost: number
    materialDefaultLabor: number
    deviceCategoryName: string
    deviceCategoryShortName: string
}
