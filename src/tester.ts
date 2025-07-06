const cookie = `_ga=GA1.1.730408176.1742973438; ASP.NET_SessionId=snq32d4dod1qsqqxatqtnlpb; UTCPin=1497948; _ga_QZPGXDB5HS=GS1.1.1742975816.2.1.1742975906.55.0.0; .ASPXAUTH=8B8F6623806F8213F4396DE72055BD0E819F1A551984F46F01624E399F2A7B9F642398D24BE579554D780710AA5189FFAA2B4B9CFD74ED0539BB060504D2C608308A766FEB3A7CDC846224C1DC2BE8A5D997C54892EBDB12723DD567464A0795C0729877; _ga_R8Z8J0M9FT=GS1.1.1742977843.2.1.1742977858.0.0.0`

export class Tester {

    getProductCategories() {
        return new Promise(async(resolve, reject) => {
            try {
                const response = await fetch('https://myeddie.edwardsfiresafety.com/Products/GetProductsByCategory', {
                    method: 'POST',
                    headers: {
                        'Accept': '*/*',
                        'Accept-Encoding': 'gzip, defalte, br, zstd',
                        'Accept-Language': 'en-US;en;q=0.9',
                        'Cache-Control': 'no-cache',
                        'Content-Type': 'application/json',
                        'Cookie': cookie,
                        'Origin': 'https://myeddie.edwardsfiresafety.com',
                        'Pragma': 'no-cache',
                        'Priority': 'u=1, i',
                        'Referer': 'https://myeddie.edwardsfiresafety.com/Home/Index',
                        'Sec-Ch-Ua': 'Chromium";v="134", "Not:A-Brand";v="24", "Google Chrome";v="134',
                        'sec-ch-ua-mobile': '?0',
                        'sec-ch-ua-platform': 'Windows',
                        'sec-fetch-dest': 'empty',
                        'sec-fetch-mode': 'cors',
                        'sec-fetch-site': 'same-origin',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
                        'X-Requested-With': 'XMLHttpRequest'
                    },
                    body: JSON.stringify({categoryID: 392})
                })
                console.dir(response)
                const result = await response.json()
                console.dir(result)
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }

}

const tester = new Tester()
tester.getProductCategories().then(() => {
    console.log(`Response received`)
}).catch((e) => {
    console.log(`Error during fetch`)
})
/*
https://myeddie.edwardsfiresafety.com/Products/GetProductCategories with categoryID: -1
    ProductCategories[] {CategoryID, CategoryDisplayName}

    https://myeddie.edwardsfiresafety.com/Products/GetProductCategories with categoryID: 12 "Fire Alarm Telephones"
    ProductCategories[] {CategoryID, CategoryDisplayName} at a finer level e.g. Frontplates and Wallboxes, Telephone Handsets, Warden Stations

https://myeddie.edwardsfiresafety.com/Products/GetProductsByCategory with categoryID: 392 "Frontplates and Wallboxes"
    {AvailableShown, PriceShown, MSRPShown, PlaceOrder, Categories[] of ProductCategory above, Products[] of Product below}
    {
        ProductID, PartNumber, LongDescription, PrimaryImage, TradePrice, SalesPrice, ClearancePrice, FutureTradePrice, FutureMSRPEffectiveDate,
        FurtureSalesPrice, FutureSalesEffectiveDate, QuantityAvailable, ProductOrderable, ReplacedBy, IsDiscontinued, IsTrainingProduct,
        NonPurchasableMessage, TieredPricingAvailable
    }

https://myeddie.edwardsfiresafety.com/Products/GetProductMedia with productID of above product
    {Media[] of Media below}
    {
        Disclaimer, MediaAccess, MediaFileName, MediaID, MediaTitle, MediaTypeName, MediaURL
    }

https://myeddie.edwardsfiresafety.com/Products/GetProductFeatures with productID of above product
    {Features[] of Feature below}
    {
        FeatureName, FeatureValue
    }
*/