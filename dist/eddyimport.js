"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EddyImporter = void 0;
const utils_1 = require("./core/utils");
const path = __importStar(require("node:path"));
const bootstrap_1 = require("./core/bootstrap");
const port = process.env.PORT || 3000;
const bootstrapper = new bootstrap_1.Bootstrap();
const cookie = `_ga=GA1.1.730408176.1742973438; ASP.NET_SessionId=snq32d4dod1qsqqxatqtnlpb; UTCPin=1497948; _ga_QZPGXDB5HS=GS1.1.1742975816.2.1.1742975906.55.0.0; .ASPXAUTH=92E2953EAD1D8170490213141FEB540F176CF2D6BEE8E3DC017DBDBCF85B99B54D10B6E988599D808A4490D7EEF8A88C2C367323F10E384C123ABCACD7266CFB7E30CEBBFB833691245D3961E2F08AABC7447BB31918E4640605BAB8ABD6CE920D4A1ECA; _ga_R8Z8J0M9FT=GS1.1.1743005008.4.1.1743005009.0.0.0`;
class EddyImporter {
    init() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const app = yield bootstrapper.start(true);
                app.post('/api/extract', (req, res) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const result = yield this.doExtract();
                        res.status(200).json(result);
                    }
                    catch (err) {
                        console.error(`EddyImporter.init.extract: `, err);
                        res.status(500).json(err);
                    }
                }));
                app.post('/api/import', (req, res) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const result = yield this.doImport(req.app);
                        res.status(200).json(result);
                    }
                    catch (err) {
                        if (!err.handled) {
                            err.handled = true;
                            console.error(err);
                        }
                        res.status(500).json(err);
                    }
                }));
                app.all('/api/eddyproducts', (req, res) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const result = yield this.getRecords(req.app);
                        if (!result) {
                            throw new Error(`Invalid query result for Eddy Products`);
                        }
                        if (req.accepts('application/json') && false) {
                            res.status(200).json(result);
                        }
                        else {
                            const html = this.formatRecordsAsHtmlTable(result);
                            res.contentType('text/html').status(200).send(html);
                        }
                    }
                    catch (err) {
                        if (!err.handled) {
                            err.handled = true;
                            console.error(err);
                        }
                        res.status(500).json(err);
                    }
                }));
                return resolve(app);
            }
            catch (initErr) {
                if (!initErr.handled) {
                    initErr.handled = true;
                    console.error(initErr);
                }
                return reject(initErr);
            }
        }));
    }
    // #region Eddy Http actions
    eddyPost(url, body) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield fetch(url, {
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
                });
                if (response.status >= 300) {
                    throw new Error(response.statusText);
                }
                const result = yield response.json();
                return resolve(result);
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    getRootProductCategories() {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductCategories', { categoryID: -1 });
    }
    getProductCategories(categoryId) {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductCategories', { categoryID: categoryId });
    }
    getProductsByCategory(categoryId) {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductsByCategory', { categoryID: categoryId });
    }
    getProductMedia(productId) {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductMedia', { productID: productId });
    }
    getProductFeatures(productId) {
        return this.eddyPost('https://myeddie.edwardsfiresafety.com/Products/GetProductFeatures', { productID: productId });
    }
    // #endregion
    doExtract() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                let created = 0;
                const ts = new Date();
                yield utils_1.Utils.ensureSubdirectoryExists(process.cwd(), 'eddyResponse');
                const rootCategoryResponse = yield this.getRootProductCategories();
                if (rootCategoryResponse && rootCategoryResponse.ProductCategories && rootCategoryResponse.ProductCategories.length > 0) {
                    yield utils_1.Utils.sleep(utils_1.Utils.getRandomIntBetween(1200, 5365));
                    for (let rootIndex = 0; rootIndex < rootCategoryResponse.ProductCategories.length; rootIndex++) {
                        // For each root category
                        const rootCategoryRecord = rootCategoryResponse.ProductCategories[rootIndex];
                        const productCategoryResponse = yield this.getProductCategories(rootCategoryRecord.CategoryID);
                        if (productCategoryResponse && productCategoryResponse.ProductCategories && productCategoryResponse.ProductCategories.length > 0) {
                            // We have a list of sub categories for the root category
                            yield utils_1.Utils.sleep(utils_1.Utils.getRandomIntBetween(1344, 5766));
                            for (let categoryIndex = 0; categoryIndex < productCategoryResponse.ProductCategories.length; categoryIndex++) {
                                const productCategoryRecord = productCategoryResponse.ProductCategories[categoryIndex];
                                // Get list of all products in the sub category and write response to json file
                                const productByCategoryResponse = yield this.getProductsByCategory(productCategoryRecord.CategoryID);
                                if (productByCategoryResponse && productByCategoryResponse.Products && productByCategoryResponse.Products.length > 0) {
                                    console.log(`Root Category: ${rootIndex + 1} of ${rootCategoryResponse.ProductCategories.length} [Sub Category: ${categoryIndex + 1} of ${productCategoryResponse.ProductCategories.length}]`);
                                    let filename = utils_1.Utils.newGuid();
                                    const proxy = productByCategoryResponse;
                                    proxy.RootCategoryID = rootCategoryRecord.CategoryID;
                                    proxy.RootCategoryDisplayName = rootCategoryRecord.CategoryDisplayName;
                                    proxy.ProductCategoryID = productCategoryRecord.CategoryID;
                                    proxy.ProductCategoryDisplayName = productCategoryRecord.CategoryDisplayName;
                                    proxy.ts = ts;
                                    yield utils_1.Utils.writeFile(path.join(process.cwd(), 'eddyResponse', `${filename}.json`), proxy);
                                    created++;
                                }
                            }
                        }
                    }
                }
                return resolve({
                    created
                });
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    formatRecordsAsHtmlTable(records) {
        if (!records || records.length < 0) {
            return '';
        }
        const firstRecord = records[0];
        const keys = Object.keys(firstRecord);
        const output = [];
        const dateKeys = [
            'FutureMSRPEffectiveDate',
            'FutureSalesEffectiveDate',
            'AsOf'
        ];
        output.push(`<!DOCTYPE html>`);
        output.push(`<html>`);
        output.push(`<head><title>Eddy Products</title></head>`);
        output.push(`<body>`);
        output.push(`<table id="eddyproducttable">`);
        output.push(`<thead>`);
        output.push(`<tr>`);
        keys.forEach((key) => {
            output.push(`<th>${key}</th>`);
        });
        output.push(`</tr>`);
        output.push(`</thead>`);
        output.push(`<tbody>`);
        records.forEach((record) => {
            output.push(`<tr>`);
            keys.forEach((key) => {
                const value = dateKeys.indexOf(key) >= 0 ? utils_1.Utils.toISODate(record[key]) : record[key];
                output.push(`<td>${value || ''}</td>`);
            });
            output.push(`</tr>`);
        });
        output.push(`</tbody>`);
        output.push(`</table>`);
        output.push(`</body>`);
        output.push(`</html>`);
        return output.join('\n');
    }
    getRecords(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const sql = app.locals.sqlserver;
                if (!app || !sql) {
                    throw new Error(`Invalid sql server database object instance`);
                }
                const result = yield sql.query(`SELECT * FROM EddyProducts`);
                if (!result || !result.recordset) {
                    throw new Error(`Invalid response from EddyProduct query`);
                }
                return resolve(result.recordset);
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    doImport(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Get a list of candidate files to import
                const fileList = yield utils_1.Utils.getFilesWithPhrase(path.join(process.cwd(), 'eddyResponse'), '.json');
                if (!fileList || fileList.length <= 0) {
                    return resolve({
                        code: -1,
                        message: 'No extracted files found'
                    });
                }
                const output = [];
                let imported = 0;
                let created = 0;
                let updated = 0;
                for (let i = 0; i < fileList.length; i++) {
                    const fileJson = require(fileList[i]);
                    const productList = fileJson.Products;
                    const categoryList = fileJson.Categories;
                    console.log(`Importing record ${i + 1} of ${fileList.length}`);
                    if (productList && productList.length > 0) {
                        for (let productIndx = 0; productIndx < productList.length; productIndx++) {
                            const product = productList[productIndx];
                            const result = yield this._importProduct(product, categoryList, app);
                            if (result) {
                                output.push(result);
                                imported++;
                                created++;
                                console.log(`Total imported: ${imported}`);
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
                });
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    _importProduct(product, categories, app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let insertSql = '';
            try {
                if (!product || !app) {
                    throw new Error(`Invalid product or app parameter`);
                }
                const discoverSql = `SELECT * FROM [dbo].[EddyProducts] WHERE ProductID='${product.ProductID}'`;
                const sql = app.locals.sqlserver;
                const upsertResult = yield sql.query(discoverSql);
                if (!upsertResult || !upsertResult.recordset) {
                    throw new Error(`Invalid response from sql database`);
                }
                if (upsertResult.recordset.length <= 0) {
                    // No record exists, do insert
                    insertSql = this._buildInsertProductStatement(product, categories);
                    if (insertSql) {
                        const insertResult = yield sql.query(insertSql);
                        return resolve(insertResult);
                    }
                    return resolve(null);
                }
                else {
                    // Record exists at destination, do update
                    return resolve({
                        output: {
                            message: `Record ${product.ProductID} already exists`
                        }
                    });
                }
            }
            catch (err) {
                console.log(`ERROR EXECUTING SQL\n${insertSql}`);
                if (!err.handled) {
                    err.handled = true;
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    _buildInsertProductStatement(product, categories) {
        if (!categories || categories.length <= 0) {
            return null;
        }
        let rootCategoryRecord = {
            CategoryID: 0,
            CategoryName: 'None'
        };
        let productCategoryRecord = {
            CategoryID: 0,
            CategoryName: 'None'
        };
        if (categories.length > 1) {
            const test = categories.find(s => s.ParentCategoryID === -1);
            if (test) {
                rootCategoryRecord = test;
                const productTest = categories.find(s => s.ParentCategoryID === rootCategoryRecord.CategoryID);
                if (productTest) {
                    productCategoryRecord = productTest;
                }
            }
            else {
                // there was no root category of -1
                rootCategoryRecord = categories[0];
                productCategoryRecord = categories[1];
            }
        }
        else {
            // categories length is 1
            productCategoryRecord = categories[0];
            rootCategoryRecord.CategoryID = productCategoryRecord.ParentCategoryID || 0;
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
           '${utils_1.Utils.newGuid()}'
           ,'${product.ProductID}'
           ,'${product.PartNumber}'
           ,'${utils_1.Utils.safeString(product.LongDescription)}'
           ,'${product.PrimaryImage}'
           ,${product.TradePrice}
           ,${product.SalesPrice}
           ,${product.ClearancePrice}
           ,${product.FutureTradePrice}
           ,'${product.FutureMSRPEffectiveDate}'
           ,${product.FutureSalesPrice}
           ,'${product.FutureSalesEffectiveDate}'
           ,${product.QuantityAvailable}
           ,${utils_1.Utils.toBit(product.ProductOrderable)}
           ,'${product.ReplacedBy}'
           ,${utils_1.Utils.toBit(product.IsDiscontinued)}
           ,${utils_1.Utils.toBit(product.IsTrainingProduct)}
           ,'${product.NonPurchasableMessage}'
           ,${utils_1.Utils.toBit(product.TieredPricingAvailable)}
           ,'${rootCategoryRecord.CategoryID}'
           ,'${rootCategoryRecord.CategoryName}'
           ,'${productCategoryRecord.CategoryID}'
           ,'${productCategoryRecord.CategoryName}'
           ,'${utils_1.Utils.formatDateTimeForSqlServer(new Date())}'
           )
        `;
    }
}
exports.EddyImporter = EddyImporter;
const importer = new EddyImporter();
importer.init().then((app) => {
    app.listen(port, () => {
        console.log(`eddyimporter.webserver: started on port ${port}`);
    });
}).catch((e) => {
    if (!e.handled) {
        console.log(`eddyimporter.webserver: exit error`);
        console.error(e);
    }
    process.exit(-1);
});
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
