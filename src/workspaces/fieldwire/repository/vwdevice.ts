export interface VwDevice {
    deviceId: string
    name: string
    shortName: string
    categoryId: string
    categoryName: string
    vendorId: string
    vendorName: string
    partNumber: string
    cost: number
    defaultLabor: number
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