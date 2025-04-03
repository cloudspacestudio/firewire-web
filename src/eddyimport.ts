import { Utils } from "./core/utils"
import * as path from 'node:path'
import * as express from 'express'
import { Bootstrap } from './core/bootstrap'

const port = process.env.PORT || 3000
const bootstrapper: Bootstrap = new Bootstrap()

const cookie = `_ga=GA1.1.730408176.1742973438; ASP.NET_SessionId=snq32d4dod1qsqqxatqtnlpb; UTCPin=1497948; _ga_QZPGXDB5HS=GS1.1.1742975816.2.1.1742975906.55.0.0; .ASPXAUTH=92E2953EAD1D8170490213141FEB540F176CF2D6BEE8E3DC017DBDBCF85B99B54D10B6E988599D808A4490D7EEF8A88C2C367323F10E384C123ABCACD7266CFB7E30CEBBFB833691245D3961E2F08AABC7447BB31918E4640605BAB8ABD6CE920D4A1ECA; _ga_R8Z8J0M9FT=GS1.1.1743005008.4.1.1743005009.0.0.0`

export class EddyImporter {

    init(): Promise<express.Application> {
        return new Promise(async(resolve, reject) => {
            try {
                const app: express.Application = await bootstrapper.start(true)

                app.post('/api/extract', async(req: express.Request, res: express.Response) => {
                    try {
                        const result = await this.doExtract()
                        res.status(200).json(result)    
                    } catch (err) {
                        console.error(`EddyImporter.init.extract: `, err)
                        res.status(500).json(err)
                    }
                })

                app.post('/api/import', async(req: express.Request, res: express.Response) => {
                    try {
                        const result = await this.doImport(req.app)
                        res.status(200).json(result)
                    } catch (err: any) {
                        if (!err.handled) {
                            err.handled = true
                            console.error(err)
                        }
                        res.status(500).json(err)
                    }
                })

                app.all('/api/eddyproducts', async(req: express.Request, res: express.Response) => {
                    try {
                        const result = await this.getRecords(req.app)
                        if (!result) {
                            throw new Error(`Invalid query result for Eddy Products`)
                        }
                        if (req.accepts('application/json') && false) {
                            res.status(200).json(result)
                        } else {
                            const html = this.formatRecordsAsHtmlTable(result)
                            res.contentType('text/html').status(200).send(html)
                        }
                    } catch (err: any) {
                        if (!err.handled) {
                            err.handled = true
                            console.error(err)
                        }
                        res.status(500).json(err)
                    }
                })

                return resolve(app)
            } catch (initErr: any) {
                if (!initErr.handled) {
                    initErr.handled = true
                    console.error(initErr)
                }
                return reject(initErr)
            }
        })
    }

    // #region Eddy Http actions
    private eddyPost(url: string, body: any): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                const response = await fetch(url, {
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
                    body: JSON.stringify(body)
                })
                if (response.status >= 300) {
                    throw new Error(response.statusText)
                }
                const result = await response.json()
                return resolve(result)
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(err)
                }
                return reject(err)
            }
        })        
    }

    private getRootProductCategories(): Promise<ProductCategoryResponse> {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductCategories', {categoryID: -1})
    }

    private getProductCategories(categoryId: number): Promise<ProductCategoryResponse> {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductCategories', {categoryID: categoryId})
    }

    private getProductsByCategory(categoryId: number): Promise<ProductsByCategoryResponse> {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductsByCategory', {categoryID: categoryId})
    }

    private getProductMedia(productId: number): Promise<ProductMediaResponse> {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductMedia', {productID: productId})
    }

    private getProductFeatures(productId: number): Promise<ProductFeatureResponse> {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductFeatures', {productID: productId})
    }
    // #endregion

    private doExtract() {
        return new Promise(async(resolve, reject) => {
            try {

                let created = 0
                const ts = new Date()
                await Utils.ensureSubdirectoryExists(process.cwd(), 'eddyResponse')
                const rootCategoryResponse = await this.getRootProductCategories()
                if (rootCategoryResponse && rootCategoryResponse.ProductCategories && rootCategoryResponse.ProductCategories.length > 0) {
                    await Utils.sleep(Utils.getRandomIntBetween(1200, 5365))
                    for(let rootIndex = 0; rootIndex < rootCategoryResponse.ProductCategories.length; rootIndex++) {
                        // For each root category
                        const rootCategoryRecord = rootCategoryResponse.ProductCategories[rootIndex]
                        const productCategoryResponse = await this.getProductCategories(rootCategoryRecord.CategoryID)
                        if (productCategoryResponse && productCategoryResponse.ProductCategories && productCategoryResponse.ProductCategories.length > 0) {
                            // We have a list of sub categories for the root category
                            await Utils.sleep(Utils.getRandomIntBetween(1344, 5766))
                            for (let categoryIndex = 0; categoryIndex < productCategoryResponse.ProductCategories.length; categoryIndex++) {
                                const productCategoryRecord = productCategoryResponse.ProductCategories[categoryIndex]
                                // Get list of all products in the sub category and write response to json file
                                const productByCategoryResponse = await this.getProductsByCategory(productCategoryRecord.CategoryID)
                                if (productByCategoryResponse && productByCategoryResponse.Products && productByCategoryResponse.Products.length > 0) {
                                    console.log(`Root Category: ${rootIndex+1} of ${rootCategoryResponse.ProductCategories.length} [Sub Category: ${categoryIndex+1} of ${productCategoryResponse.ProductCategories.length}]`)                                    
                                    let filename = Utils.newGuid()
                                    const proxy: any = productByCategoryResponse
                                    proxy.RootCategoryID = rootCategoryRecord.CategoryID
                                    proxy.RootCategoryDisplayName = rootCategoryRecord.CategoryDisplayName
                                    proxy.ProductCategoryID = productCategoryRecord.CategoryID
                                    proxy.ProductCategoryDisplayName = productCategoryRecord.CategoryDisplayName
                                    proxy.ts = ts
                                    await Utils.writeFile(path.join(process.cwd(), 'eddyResponse', `${filename}.json`),
                                    proxy)
                                    created++
                                }
                            }
                        }
                    }
                }
                return resolve({
                    created
                })
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(err)
                }
                return reject(err)
            }
        })
    }

    private formatRecordsAsHtmlTable(records: ProductResponse[]): string {
        if (!records || records.length < 0) {
            return ''
        }
        const firstRecord = records[0]
        const keys = Object.keys(firstRecord)
        const output: string[] = []
        const dateKeys = [
            'FutureMSRPEffectiveDate',
            'FutureSalesEffectiveDate',
            'AsOf'
        ]
        output.push(`<!DOCTYPE html>`)
        output.push(`<html>`)
        output.push(`<head><title>Eddy Products</title></head>`)
        output.push(`<body>`)
        output.push(`<table id="eddyproducttable">`)
        output.push(`<thead>`)
        output.push(`<tr>`)
        keys.forEach((key: string) => {
            output.push(`<th>${key}</th>`)
        })
        output.push(`</tr>`)
        output.push(`</thead>`)
        output.push(`<tbody>`)
        records.forEach((record: ProductResponse|any) => {
            output.push(`<tr>`)
            keys.forEach((key: string) => {
                const value = dateKeys.indexOf(key) >= 0 ? Utils.toISODate(record[key]):record[key]
                output.push(`<td>${value||''}</td>`)
            })
            output.push(`</tr>`)
        })
        output.push(`</tbody>`)
        output.push(`</table>`)
        output.push(`</body>`)
        output.push(`</html>`)
        return output.join('\n')
    }
    
    private getRecords(app: express.Application): Promise<ProductResponse[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = app.locals.sqlserver
                if (!app || !sql) {
                    throw new Error(`Invalid sql server database object instance`)
                }
                const result = await sql.query(`SELECT * FROM EddyProducts`)
                if (!result || !result.recordset) {
                    throw new Error(`Invalid response from EddyProduct query`)
                }
                return resolve(result.recordset)
            } catch (err:any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(err)
                }
                return reject(err)
            }
        })
    }

    private doImport(app: express.Application): Promise<EddyImportResponse> {
        return new Promise(async(resolve, reject) => {
            try {
                // Get a list of candidate files to import
                const fileList = await Utils.getFilesWithPhrase(path.join(process.cwd(), 'eddyResponse'), '.json')
                if (!fileList || fileList.length <= 0) {
                    return resolve({
                        code: -1,
                        message: 'No extracted files found'
                    })
                }
                const output: any[] = []
                let imported: number = 0
                let created: number = 0
                let updated: number = 0
                for(let i = 0; i < fileList.length; i++) {
                    const fileJson = require(fileList[i])
                    const productList = fileJson.Products
                    const categoryList: ProductCategory[] = fileJson.Categories
                    console.log(`Importing record ${i+1} of ${fileList.length}`)
                    if (productList && productList.length > 0) {
                        for (let productIndx = 0; productIndx < productList.length; productIndx++) {
                            const product = productList[productIndx]
                            const result = await this._importProduct(product, categoryList, app)
                            if (result) {
                                output.push(result)
                                imported++
                                created++
                                console.log(`Total imported: ${imported}`)
                            }
                        }
                    }
                }
                return resolve({
                    code: 0,
                    message: 'OK',
                    data: {
                        imported,
                        created,
                        updated,
                        records: output
                    }
                })
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(err)
                }
                return reject(err)
            }
        })
    }

    private _importProduct(product: ProductResponse, categories: ProductCategory[], app: express.Application): Promise<any> {
        return new Promise(async(resolve, reject) => {
            let insertSql: string|null|undefined = ''
            try {
                if (!product || !app) {
                    throw new Error(`Invalid product or app parameter`)
                }
                const discoverSql = `SELECT * FROM [dbo].[EddyProducts] WHERE ProductID='${product.ProductID}'`
                const sql = app.locals.sqlserver
                const upsertResult = await sql.query(discoverSql)
                if (!upsertResult || !upsertResult.recordset) {
                    throw new Error(`Invalid response from sql database`)
                }
                if (upsertResult.recordset.length <= 0) {
                    // No record exists, do insert
                    insertSql = this._buildInsertProductStatement(product, categories)
                    if (insertSql) {
                        const insertResult = await sql.query(insertSql)
                        return resolve(insertResult)
                    }
                    return resolve(null)
                } else {
                    // Record exists at destination, do update
                    return resolve({
                        output: {
                            message: `Record ${product.ProductID} already exists`
                        }
                    })
                }
            } catch (err: any) {
                console.log(`ERROR EXECUTING SQL\n${insertSql}`)
                if (!err.handled) {
                    err.handled = true
                    console.error(err)
                }
                return reject(err)
            }
        })
    }

    private _buildInsertProductStatement(product: ProductResponse, categories: ProductCategory[]): string | null {
        if (!categories || categories.length <= 0) {
            return null
        }
        let rootCategoryRecord: ProductCategory = {
            CategoryID: 0,
            CategoryName: 'None'
        }
        let productCategoryRecord: ProductCategory = {
            CategoryID: 0,
            CategoryName: 'None'
        }
        if (categories.length > 1) {
            const test = categories.find(s => s.ParentCategoryID===-1)
            if (test) {
                rootCategoryRecord = test
                const productTest = categories.find(s => s.ParentCategoryID===rootCategoryRecord.CategoryID)
                if (productTest) {
                    productCategoryRecord = productTest
                }
            } else {
                // there was no root category of -1
                rootCategoryRecord = categories[0]
                productCategoryRecord = categories[1]
            }
        } else {
            // categories length is 1
            productCategoryRecord = categories[0]
            rootCategoryRecord.CategoryID = productCategoryRecord.ParentCategoryID||0
        }

        return `
        INSERT INTO [dbo].[EddyProducts]
           ([RecordID]
           ,[ProductID]
           ,[PartNumber]
           ,[LongDescription]
           ,[PrimaryImage]
           ,[TradePrice]
           ,[SalesPrice]
           ,[ClearancePrice]
           ,[FutureTradePrice]
           ,[FutureMSRPEffectiveDate]
           ,[FutureSalesPrice]
           ,[FutureSalesEffectiveDate]
           ,[QuantityAvailable]
           ,[ProductOrderable]
           ,[ReplacedBy]
           ,[IsDiscontinued]
           ,[IsTrainingProduct]
           ,[NonPurchasableMessage]
           ,[TieredPricingAvailable]
           ,[RootCategoryID]
           ,[RootCategoryName]
           ,[ProductCategoryID]
           ,[ProductCategoryName]
           ,[AsOf])
     VALUES (
           '${Utils.newGuid()}'
           ,'${product.ProductID}'
           ,'${product.PartNumber}'
           ,'${Utils.safeString(product.LongDescription)}'
           ,'${product.PrimaryImage}'
           ,${product.TradePrice}
           ,${product.SalesPrice}
           ,${product.ClearancePrice}
           ,${product.FutureTradePrice}
           ,'${product.FutureMSRPEffectiveDate}'
           ,${product.FutureSalesPrice}
           ,'${product.FutureSalesEffectiveDate}'
           ,${product.QuantityAvailable}
           ,${Utils.toBit(product.ProductOrderable)}
           ,'${product.ReplacedBy}'
           ,${Utils.toBit(product.IsDiscontinued)}
           ,${Utils.toBit(product.IsTrainingProduct)}
           ,'${product.NonPurchasableMessage}'
           ,${Utils.toBit(product.TieredPricingAvailable)}
           ,'${rootCategoryRecord.CategoryID}'
           ,'${rootCategoryRecord.CategoryName}'
           ,'${productCategoryRecord.CategoryID}'
           ,'${productCategoryRecord.CategoryName}'
           ,'${Utils.formatDateTimeForSqlServer(new Date())}'
           )
        `
    }
}

const importer = new EddyImporter()
importer.init().then((app: express.Application) => {
    app.listen(port, () => {
        console.log(`eddyimporter.webserver: started on port ${port}`)
    })
}).catch((e: any) => {
    if (!e.handled) {
        console.log(`eddyimporter.webserver: exit error`)
        console.error(e)
    }
    process.exit(-1)
})

export interface EddyImportResponse {
    code: number
    message: string
    data?: any
}

export interface ProductCategoryResponse {
    ProductCategories: RootProductCategory[]
}
export interface RootProductCategory {
    CategoryID: number
    CategoryDisplayName: string
    ParentCategoryID?: number
}
export interface ProductsByCategoryResponse {
    AvailableShown: boolean
    PriceShown: boolean
    MSRPShown: boolean
    PlaceOrder: boolean
    Categories: ProductCategory[]
    Products: ProductResponse[]
}
export interface ProductCategory {
    CategoryID: number
    CategoryName: string
    ParentCategoryID?: number
}
export interface ProductResponse {
    ProductID: string
    PartNumber: string
    LongDescription: string
    PrimaryImage: string
    TradePrice: number
    SalesPrice: number
    ClearancePrice: number
    FutureTradePrice: number
    FutureMSRPEffectiveDate: string
    FutureSalesPrice:number
    FutureSalesEffectiveDate: string
    QuantityAvailable: number
    ProductOrderable: number
    ReplacedBy: string
    IsDiscontinued: boolean
    IsTrainingProduct: boolean
    NonPurchasableMessage: string
    TieredPricingAvailable: boolean
}
export interface ProductMediaResponse {
    Media: ProductMedia[]
}
export interface ProductMedia {
    Disclaimer: string
    MediaAccess: string
    MediaFileName: string
    MediaID: number
    MediaTitle: string
    MediaTypeName: string
    MediaURL: string
}
export interface ProductFeatureResponse {
    Features: ProductFeature[]
}
export interface ProductFeature {
    FeatureName: string
    FeatureValue: string
}

// const tester = new EddyImporter()
// tester.doImport().then(() => {
//     console.log(`Response received`)
// }).catch((e) => {
//     console.log(`Error during fetch`)
// })
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


USE [corp]
GO

Object:  Table [dbo].[EddyProducts]    Script Date: 3/27/2025 4:51:08 AM
SET ANSI_NULLS ON
GO

SET QUOTED_IDENTIFIER ON
GO

CREATE TABLE [dbo].[EddyProducts](
	[RecordID] [nvarchar](50) NOT NULL,
	[ProductID] [int] NOT NULL,
	[PartNumber] [nvarchar](50) NOT NULL,
	[LongDescription] [nvarchar](1000) NOT NULL,
	[PrimaryImage] [nvarchar](1000) NULL,
	[TradePrice] [money] NOT NULL,
	[SalesPrice] [money] NOT NULL,
	[ClearancePrice] [money] NOT NULL,
	[FutureTradePrice] [money] NOT NULL,
	[FutureMSRPEffectiveDate] [date] NULL,
	[FutureSalesPrice] [money] NOT NULL,
	[FutureSalesEffectiveDate] [date] NULL,
	[QuantityAvailable] [int] NOT NULL,
	[ProductOrderable] [bit] NOT NULL,
	[ReplacedBy] [nvarchar](50) NULL,
	[IsDiscontinued] [bit] NOT NULL,
	[IsTrainingProduct] [bit] NOT NULL,
	[NonPurchasableMessage] [nvarchar](100) NULL,
	[TieredPricingAvailable] [bit] NOT NULL,
	[RootCategoryID] [int] NOT NULL,
	[RootCategoryName] [nvarchar](50) NOT NULL,
	[ProductCategoryID] [int] NOT NULL,
	[ProductCategoryName] [nvarchar](50) NOT NULL,
	[AsOf] [datetime] NOT NULL
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_Table_1_RecordId]  DEFAULT (newid()) FOR [RecordID]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_TradePrice]  DEFAULT ((0.00)) FOR [TradePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_SalesPrice]  DEFAULT ((0.00)) FOR [SalesPrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_ClearancePrice]  DEFAULT ((0.00)) FOR [ClearancePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_FutureTradePrice]  DEFAULT ((0.00)) FOR [FutureTradePrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_FutureSalesPrice]  DEFAULT ((0.00)) FOR [FutureSalesPrice]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_QuantityAvailable]  DEFAULT ((0)) FOR [QuantityAvailable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_ProductOrderable]  DEFAULT ((1)) FOR [ProductOrderable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_IsDiscontinued]  DEFAULT ((0)) FOR [IsDiscontinued]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_IsTrainingProduct]  DEFAULT ((0)) FOR [IsTrainingProduct]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_EddyProducts_TieredPricingAvailable]  DEFAULT ((0)) FOR [TieredPricingAvailable]
GO

ALTER TABLE [dbo].[EddyProducts] ADD  CONSTRAINT [DF_Table_1_ts]  DEFAULT (getdate()) FOR [AsOf]
GO


*/