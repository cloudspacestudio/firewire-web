export interface VwDevice {
    deviceId: string
    name: string
    shortName: string
    categoryName: string
    includeOnFloorplan: boolean
    vendorId: string
    vendorName: string
    partNumber: string
    cost: number
    defaultLabor: number
    laborRate?: number
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string
    createat: Date
    createby: string
    updateat: Date
    updateby: string
    attributeCount?: number
    subTaskCount?: number
}
