export interface Device {
    deviceId: string
    name: string
    shortName?: string
    categoryId: string
    vendorId: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string
}
