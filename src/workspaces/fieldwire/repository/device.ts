export interface Device {
    deviceId: string
    name: string
    shortName?: string
    categoryName: string
    includeOnFloorplan?: boolean
    floorplanLabelText?: string | null
    vendorId: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    laborRate?: number
    iconId?: string | null
    iconForegroundColor?: string | null
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string
    areaOfInfluence: string
}
