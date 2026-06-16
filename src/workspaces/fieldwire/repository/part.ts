export interface Part {
    partId?: string
    vendorId?: string
    sourceVendorName?: string
    brand?: string
    parentCategory?: string
    category?: string
    partNumber?: string
    description?: string
    msrp?: number
    cost?: number
    minQty?: number | null
    upc?: string | null
    productStatus?: string | null
    agency?: string | null
    countryOfOrigin?: string | null
    rawJson?: string | null
    createat?: Date
    createby?: string
    updateat?: Date
    updateby?: string

    // Import compatibility aliases accepted while old vendor configs are normalized.
    ParentCategory?: string
    Category?: string
    PartNumber?: string
    LongDescription?: string
    MSRPPrice?: number
    SalesPrice?: number
    FuturePrice?: number | null
    FutureEffectiveDate?: Date | string | null
    FutureSalesPrice?: number | null
    FutureSalesEffectiveDate?: Date | string | null
    MinOrderQuantity?: number | null
    ProductStatus?: string | null
    Agency?: string | null
    CountryOfOrigin?: string | null
    UPC?: string | null
    RawJson?: string | null
}
