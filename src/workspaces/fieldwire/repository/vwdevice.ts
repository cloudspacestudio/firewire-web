export interface VwDevice {
    deviceId: string
    name: string
    shortName: string
    categoryName: string
    includeOnFloorplan: boolean
    floorplanLabelText?: string | null
    vendorId: string
    vendorName: string
    partNumber: string
    cost: number
    defaultLabor: number
    laborRate?: number
    iconId?: string | null
    iconLabel?: string | null
    iconDataUrl?: string | null
    iconForegroundColor?: string | null
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string
    areaOfInfluence: string
    createat: Date
    createby: string
    updateat: Date
    updateby: string
    attributeCount?: number
    subTaskCount?: number
}
