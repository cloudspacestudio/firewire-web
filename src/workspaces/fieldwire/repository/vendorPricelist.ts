export interface VendorPricelist {
    vendorPartId?: string
    vendorId: string
    sourceVendorName?: string
    brand?: string
    ParentCategory: string
    Category: string
    PartNumber: string
    LongDescription: string
    ServiceDescription?: string
    ManufacturerOrReseller?: string
    MSRPPrice: number
    DiscountPercent?: number | null
    DirAdminFee?: number | null
    SalesPrice: number
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
    createat?: Date
    createby?: string
    updateat?: Date
    updateby?: string
}
