export interface DeviceVendorLinkIgnore {
    ignoreId: string
    deviceId: string
    vendorId: string
    partNumber: string
    sourceKind: string
    reason?: string | null
    createat: Date
    createby: string
}
