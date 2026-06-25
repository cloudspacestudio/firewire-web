export interface DevicePart {
    devicePartId: string
    deviceId: string
    partId?: string | null
    vendorId: string
    partNumber: string
    description?: string | null
    parentCategory?: string | null
    category?: string | null
    msrp?: number | null
    cost?: number | null
    quantityPerDevice: number
    sortOrder?: number | null
    createat?: Date | string
    createby?: string
    updateat?: Date | string
    updateby?: string
}
