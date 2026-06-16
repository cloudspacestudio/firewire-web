export interface Device {
    deviceId: string
    name: string
    shortName?: string
    categoryName: string
    includeOnFloorplan?: boolean
    vendorId: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    laborRate?: number
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string
}
