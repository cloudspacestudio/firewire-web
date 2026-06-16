export interface VwDeviceMaterial {
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
