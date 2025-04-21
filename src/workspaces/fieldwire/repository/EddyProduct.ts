export interface EddyProduct {
    RecordID: string
    ProductID: string
    PartNumber: string
    LongDescription: string
    PrimaryImage: string
    TradePrice: number
    SalesPrice: number
    ClearancePrice: number
    FutureTradePrice: number
    FutureMSRPEffectiveDate: Date
    FutureSalesPrice: number
    FutureSalesEffectiveDate: Date
    QuantityAvailable: number
    ProductOrderable: boolean
    ReplacedBy: string
    IsDiscontinued: boolean
    IsTrainingProduct: boolean
    NonPurchasableMessage: string
    TieredPricingAvailable: boolean
    RootCategoryID: string
    RootCategoryName: string
    ProductCategoryID: string
    ProductCategoryName: string
    AsOf: Date
}
