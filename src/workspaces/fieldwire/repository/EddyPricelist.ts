export interface EddyPricelist {
    ParentCategory: string
    Category: string
    PartNumber: string
    LongDescription: string
    MSRPPrice: number
    SalesPrice: number
    FuturePrice: number
    FutureEffectiveDate: Date
    FutureSalesPrice: number
    FutureSalesEffectiveDate: Date
    MinOrderQuantity: number
    ProductStatus: string
    Agency: string
    CountryOfOrigin: string
    UPC: string
}