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
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.NoRecordsFound = exports.SqlDb = void 0;
const mssql = __importStar(require("mssql"));
const node_crypto_1 = require("node:crypto");
class SqlDb {
    constructor(app) {
        this.app = app;
    }
    // #region Sql Table Queries
    getDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('devices');
        });
    }
    getDevice(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceMaterialTextSchema();
            return this._getOne('vwDevices', `deviceId='${deviceId}'`);
        });
    }
    getVwDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceMaterialTextSchema();
            return this._getMany('vwDevices');
        });
    }
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCategorySchema();
            return this._getMany('categories');
        });
    }
    getVendors() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            return this._getMany('vendors');
        });
    }
    getVendorById(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            return this._getOne('vendors', `[vendorId]='${this._escapeSql(vendorId)}'`);
        });
    }
    getVendorByName(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            return this._getOne('vendors', `[name]=N'${this._escapeSql(name)}'`);
        });
    }
    createVendor(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    const pool = yield sql.init();
                    const vendorId = input.vendorId || (0, node_crypto_1.randomUUID)();
                    yield pool.request()
                        .input('vendorId', mssql.NVarChar(40), vendorId)
                        .input('name', mssql.NVarChar(100), String(input.name || '').trim())
                        .input('desc', mssql.NVarChar(500), String(input.desc || '').trim())
                        .input('link', mssql.NVarChar(500), String(input.link || '').trim())
                        .input('importConfigJson', mssql.NVarChar(mssql.MAX), typeof input.importConfigJson === 'string' ? input.importConfigJson : null)
                        .query(`
                        INSERT INTO dbo.vendors([vendorId], [name], [desc], [link], [importConfigJson], [createby], [updateby])
                        VALUES(@vendorId, @name, @desc, @link, @importConfigJson, 'system', 'system')
                    `);
                    this.app.locals.vendors = null;
                    return resolve(vendorId);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateVendor(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    const escape = (value) => String(value || '').replace(/'/g, "''");
                    const importConfigSql = typeof input.importConfigJson === 'string'
                        ? `N'${escape(input.importConfigJson)}'`
                        : '[importConfigJson]';
                    const logoFileNameSql = typeof input.logoFileName === 'string'
                        ? `N'${escape(input.logoFileName)}'`
                        : '[logoFileName]';
                    const logoDataUrlSql = typeof input.logoDataUrl === 'string'
                        ? `N'${escape(input.logoDataUrl)}'`
                        : '[logoDataUrl]';
                    yield sql.query(`UPDATE vendors
                    SET [name]='${escape(input.name)}',
                        [desc]='${escape(input.desc)}',
                        [link]='${escape(input.link)}',
                        [importConfigJson]=${importConfigSql},
                        [logoFileName]=${logoFileNameSql},
                        [logoDataUrl]=${logoDataUrlSql},
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${escape(input.vendorId)}'`);
                    this.app.locals.vendors = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateVendorImportConfig(vendorId, importConfigJson) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`UPDATE vendors
                    SET [importConfigJson]=N'${this._escapeSql(importConfigJson)}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${this._escapeSql(vendorId)}'`);
                    this.app.locals.vendors = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateVendorLogo(vendorId, logoFileName, logoDataUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`UPDATE vendors
                    SET [logoFileName]=N'${this._escapeSql(logoFileName)}',
                        [logoDataUrl]=N'${this._escapeSql(logoDataUrl)}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${this._escapeSql(vendorId)}'`);
                    this.app.locals.vendors = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getCategoryLabors() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('categoryLabors');
        });
    }
    getMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materials');
        });
    }
    getVwMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('vwMaterials');
        });
    }
    getVwDeviceMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('vwDeviceMaterials');
        });
    }
    getDeviceMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('devicematerials');
        });
    }
    getDeviceSets() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceSetSchema();
            return this._getMany('deviceSets', undefined, '[name] ASC');
        });
    }
    getDeviceSet(deviceSetId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceSetSchema();
            return this._getOne('deviceSets', `[deviceSetId]='${this._escapeSql(deviceSetId)}'`);
        });
    }
    getDeviceSetDevices(deviceSetId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceSetSchema();
            const filter = deviceSetId ? `[deviceSetId]='${this._escapeSql(deviceSetId)}'` : undefined;
            return this._getMany('deviceSetDevices', filter, '[createat] ASC');
        });
    }
    getDeviceAliases() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('deviceAliases');
        });
    }
    getMaterialAttributes() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materialAttributes');
        });
    }
    getMaterialAttributesByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materialAttributes', `materialId='${deviceId}'`);
        });
    }
    getMaterialSubTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materialSubTasks');
        });
    }
    getMaterialSubTasksByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materialSubTasks', `materialId='${deviceId}'`);
        });
    }
    getTestDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('testdevices');
        });
    }
    getParts() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensurePartsSchema();
            return this.normalizePartRows(yield this._getMany('vwParts', `[productStatus] IS NULL OR [productStatus] = N''`, '[partNumber] ASC'));
        });
    }
    getPartByPartNumber(partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensurePartsSchema();
            return this.normalizePartRows(yield this._getMany('vwParts', `[partNumber]=N'${this._escapeSql(partNumber)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`));
        });
    }
    getPartsByVendor(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensurePartsSchema();
            return this.normalizePartRows(yield this._getMany('vwParts', `[vendorId]='${this._escapeSql(vendorId)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`, '[partNumber] ASC'));
        });
    }
    getPartByVendorAndPartNumber(vendorId, partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensurePartsSchema();
            return this.normalizePartRows(yield this._getMany('vwParts', `[vendorId]='${this._escapeSql(vendorId)}' AND [partNumber]=N'${this._escapeSql(partNumber)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`));
        });
    }
    getRawPartsByVendor(vendorId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensurePartsSchema();
            return this._getMany('parts', `[vendorId]='${this._escapeSql(vendorId)}'`, '[partNumber] ASC');
        });
    }
    getWorkspaceStorage(area, workspaceKey) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureWorkspaceStorageSchema();
            return this._getOne('workspaceStorage', `[area]=N'${this._escapeSql(area)}' AND [workspaceKey]=N'${this._escapeSql(workspaceKey)}'`);
        });
    }
    saveWorkspaceStorage(area_1, workspaceKey_1, payloadJson_1) {
        return __awaiter(this, arguments, void 0, function* (area, workspaceKey, payloadJson, updatedBy = 'system') {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureWorkspaceStorageSchema();
                    const sql = this.app.locals.sqlserver;
                    const pool = yield sql.init();
                    const request = pool.request();
                    request.timeout = Math.max(Number(request.timeout || 0), 120000);
                    yield request
                        .input('workspaceStorageId', mssql.UniqueIdentifier, (0, node_crypto_1.randomUUID)())
                        .input('area', mssql.NVarChar(100), area)
                        .input('workspaceKey', mssql.NVarChar(200), workspaceKey)
                        .input('payloadJson', mssql.NVarChar(mssql.MAX), payloadJson)
                        .input('updatedBy', mssql.NVarChar(100), updatedBy)
                        .query(`
                    MERGE dbo.workspaceStorage AS target
                    USING (SELECT @area AS [area], @workspaceKey AS [workspaceKey]) AS source
                    ON target.[area] = source.[area] AND target.[workspaceKey] = source.[workspaceKey]
                    WHEN MATCHED THEN
                        UPDATE SET
                            [payloadJson] = @payloadJson,
                            [updateat] = GETDATE(),
                            [updateby] = @updatedBy
                    WHEN NOT MATCHED THEN
                        INSERT ([workspaceStorageId], [area], [workspaceKey], [payloadJson], [createby], [updateby])
                        VALUES (@workspaceStorageId, @area, @workspaceKey, @payloadJson, @updatedBy, @updatedBy);
                `);
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createCategory(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureCategorySchema();
                    const sql = this.app.locals.sqlserver;
                    const createBy = this._escapeSql(String(input.createby || 'system'));
                    const updateBy = this._escapeSql(String(input.updateby || input.createby || 'system'));
                    const result = yield sql.query(`INSERT INTO categories(
                    name, shortName, handle, defaultLabor, includeOnFloorplan, slcAddress, speakerAddress, strobeAddress, createby, updateby
                )
                VALUES(
                    '${this._escapeSql(input.name)}',
                    '${this._escapeSql(input.shortName)}',
                    '${this._escapeSql(input.handle)}',
                    ${typeof input.defaultLabor === 'number' && Number.isFinite(input.defaultLabor) ? Number(input.defaultLabor) : 'NULL'},
                    ${input.includeOnFloorplan ? 1 : 0},
                    ${input.slcAddress ? `N'${this._escapeSql(String(input.slcAddress))}'` : 'NULL'},
                    ${input.speakerAddress ? `N'${this._escapeSql(String(input.speakerAddress))}'` : 'NULL'},
                    ${input.strobeAddress ? `N'${this._escapeSql(String(input.strobeAddress))}'` : 'NULL'},
                    '${createBy}',
                    '${updateBy}'
                )`);
                    this.app.locals.categories = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateCategory(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureCategorySchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`UPDATE categories
                    SET [name]='${this._escapeSql(input.name)}',
                        [shortName]='${this._escapeSql(input.shortName)}',
                        [handle]='${this._escapeSql(input.handle)}',
                        [defaultLabor]=${typeof input.defaultLabor === 'number' && Number.isFinite(input.defaultLabor) ? Number(input.defaultLabor) : 'NULL'},
                        [includeOnFloorplan]=${input.includeOnFloorplan ? 1 : 0},
                        [slcAddress]=${input.slcAddress ? `N'${this._escapeSql(String(input.slcAddress))}'` : 'NULL'},
                        [speakerAddress]=${input.speakerAddress ? `N'${this._escapeSql(String(input.speakerAddress))}'` : 'NULL'},
                        [strobeAddress]=${input.strobeAddress ? `N'${this._escapeSql(String(input.strobeAddress))}'` : 'NULL'},
                        [updateat]=GETDATE(),
                        [updateby]='${this._escapeSql(String(input.updateby || 'system'))}'
                    WHERE [categoryId]='${this._escapeSql(input.categoryId)}'`);
                    this.app.locals.categories = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteCategory(categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM categories WHERE [categoryId]='${this._escapeSql(categoryId)}'`);
                    this.app.locals.categories = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getCategoryByHandle(handle) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCategorySchema();
            return this._getOne('categories', `handle='${handle}'`);
        });
    }
    getCategoryById(categoryId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureCategorySchema();
            return this._getOne('categories', `[categoryId]='${this._escapeSql(categoryId)}'`);
        });
    }
    createMaterial(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceMaterialTextSchema();
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO materials(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    ${this._toSqlValue(this._truncateSqlString(input.name, 500))}, ${this._toSqlValue(this._truncateSqlString(input.shortName || '', 200))}, '${this._escapeSql(input.vendorId)}', '${this._escapeSql(input.categoryId)}',
                    ${this._toSqlValue(this._truncateSqlString(input.partNumber, 120))}, ${this._toSqlValue(this._truncateSqlString(input.link || '', 1000))}, ${Number(input.cost || 0)}, ${Number(input.defaultLabor || 0)},
                    ${this._toSqlValue(this._truncateSqlString(input.slcAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.serialNumber || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.strobeAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.speakerAddress || '', 100))}
                )`);
                    this.app.locals.materials = null;
                    this.app.locals.vwMaterials = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateDevice(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceMaterialTextSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`UPDATE devices
                    SET [name]=N'${this._escapeSql(this._truncateSqlString(input.name, 500))}',
                        [shortName]=N'${this._escapeSql(this._truncateSqlString(input.shortName || '', 200))}',
                        [vendorId]='${this._escapeSql(input.vendorId)}',
                        [categoryId]='${this._escapeSql(input.categoryId)}',
                        [partNumber]=N'${this._escapeSql(this._truncateSqlString(input.partNumber, 120))}',
                        [link]=N'${this._escapeSql(this._truncateSqlString(input.link || '', 1000))}',
                        [cost]=${Number(input.cost || 0)},
                        [defaultLabor]=${Number(input.defaultLabor || 0)},
                        [laborRate]=${Number(input.laborRate || 56)},
                        [slcAddress]=N'${this._escapeSql(this._truncateSqlString(input.slcAddress || '', 100))}',
                        [serialNumber]=N'${this._escapeSql(this._truncateSqlString(input.serialNumber || '', 100))}',
                        [strobeAddress]=N'${this._escapeSql(this._truncateSqlString(input.strobeAddress || '', 100))}',
                        [speakerAddress]=N'${this._escapeSql(this._truncateSqlString(input.speakerAddress || '', 100))}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [deviceId]='${this._escapeSql(input.deviceId)}'`);
                    this.app.locals.devices = null;
                    this.app.locals.vwDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getMaterialByPartNumber(partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('materials', `partNumber='${partNumber}'`);
        });
    }
    getMaterialByVendorAndPartNumber(vendorId, partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('materials', `vendorId='${this._escapeSql(vendorId)}' AND partNumber='${this._escapeSql(partNumber)}'`);
        });
    }
    getDeviceMaterialMapCountByMaterialId(materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const sql = this.app.locals.sqlserver;
            const pool = yield sql.init();
            const result = yield pool.request()
                .input('materialId', mssql.NVarChar(50), materialId)
                .query('SELECT COUNT(1) AS mapCount FROM dbo.devicematerials WHERE materialId = @materialId');
            return Number(((_a = (result.recordset || [])[0]) === null || _a === void 0 ? void 0 : _a.mapCount) || 0);
        });
    }
    isDeviceOrMaterialReferencedByProjectWorksheet(input) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const needles = Array.from(new Set([
                String(input.deviceId || '').trim(),
                ...(Array.isArray(input.partNumbers) ? input.partNumbers : [])
            ].map((value) => String(value || '').trim()).filter(Boolean)));
            if (needles.length <= 0) {
                return false;
            }
            const sql = this.app.locals.sqlserver;
            const pool = yield sql.init();
            const request = pool.request();
            const clauses = needles.map((needle, index) => {
                const parameterName = `needle${index}`;
                request.input(parameterName, mssql.NVarChar(300), `%${this._escapeSqlLike(needle)}%`);
                return `worksheetJson LIKE @${parameterName} ESCAPE N'~'`;
            });
            const result = yield request.query(`
            IF OBJECT_ID(N'dbo.firewireProjectWorksheets', N'U') IS NULL
            BEGIN
                SELECT CAST(0 AS INT) AS referenceCount
            END
            ELSE
            BEGIN
                SELECT COUNT(1) AS referenceCount
                FROM dbo.firewireProjectWorksheets
                WHERE ${clauses.join(' OR ')}
            END
        `);
            return Number(((_a = (result.recordset || [])[0]) === null || _a === void 0 ? void 0 : _a.referenceCount) || 0) > 0;
        });
    }
    deleteMaterial(materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [materials] WHERE [materialId]='${this._escapeSql(materialId)}'`);
                    this.app.locals.materials = null;
                    this.app.locals.vwMaterials = null;
                    this.app.locals.vwDeviceMaterials = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createDevice(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceMaterialTextSchema();
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO devices(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor, laborRate,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    ${this._toSqlValue(this._truncateSqlString(input.name, 500))}, ${this._toSqlValue(this._truncateSqlString(input.shortName || '', 200))}, '${this._escapeSql(input.vendorId)}', '${this._escapeSql(input.categoryId)}',
                    ${this._toSqlValue(this._truncateSqlString(input.partNumber, 120))}, ${this._toSqlValue(this._truncateSqlString(input.link || '', 1000))}, ${Number(input.cost || 0)}, ${Number(input.defaultLabor || 0)}, ${Number(input.laborRate || 56)},
                    ${this._toSqlValue(this._truncateSqlString(input.slcAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.serialNumber || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.strobeAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.speakerAddress || '', 100))}
                )`);
                    this.app.locals.devices = null;
                    this.app.locals.vwDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createDeviceSet(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceSetSchema();
                    const sql = this.app.locals.sqlserver;
                    const deviceSetId = (0, node_crypto_1.randomUUID)();
                    const createdBy = this._escapeSql(input.createdBy || 'system');
                    yield sql.query(`INSERT INTO [deviceSets](
                    [deviceSetId], [name], [createat], [createby], [updateat], [updateby]
                ) VALUES (
                    '${this._escapeSql(deviceSetId)}',
                    N'${this._escapeSql(input.name)}',
                    GETDATE(),
                    '${createdBy}',
                    GETDATE(),
                    '${createdBy}'
                )`);
                    this.app.locals.deviceSets = null;
                    return resolve(deviceSetId);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    updateDeviceSet(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceSetSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`UPDATE [deviceSets]
                    SET [name]=N'${this._escapeSql(input.name)}',
                        [updateat]=GETDATE(),
                        [updateby]='${this._escapeSql(input.updatedBy || 'system')}'
                    WHERE [deviceSetId]='${this._escapeSql(input.deviceSetId)}'`);
                    this.app.locals.deviceSets = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteDeviceSet(deviceSetId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceSetSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`);
                    yield sql.query(`DELETE FROM [deviceSets] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`);
                    this.app.locals.deviceSets = null;
                    this.app.locals.deviceSetDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    replaceDeviceSetDevices(deviceSetId, deviceIds, createdBy) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceSetSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`);
                    for (const deviceId of deviceIds) {
                        yield sql.query(`INSERT INTO [deviceSetDevices](
                        [deviceSetDeviceId], [deviceSetId], [deviceId], [createat], [createby]
                    ) VALUES (
                        '${this._escapeSql((0, node_crypto_1.randomUUID)())}',
                        '${this._escapeSql(deviceSetId)}',
                        '${this._escapeSql(deviceId)}',
                        GETDATE(),
                        '${this._escapeSql(createdBy || 'system')}'
                    )`);
                    }
                    this.app.locals.deviceSetDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteDeviceSetDevicesByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceSetSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceId]='${this._escapeSql(deviceId)}'`);
                    this.app.locals.deviceSetDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteDevice(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [devices] WHERE [deviceId]='${this._escapeSql(deviceId)}'`);
                    this.app.locals.devices = null;
                    this.app.locals.vwDevices = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getDeviceByPartNumber(partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('devices', `partNumber='${partNumber}'`);
        });
    }
    getDeviceByVendorAndPartNumber(vendorId, partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('devices', `vendorId='${this._escapeSql(vendorId)}' AND partNumber='${this._escapeSql(partNumber)}'`);
        });
    }
    createDeviceMaterialMap(deviceId, materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO devicematerials(
                    deviceId, materialId
                )
                VALUES(
                    '${this._escapeSql(deviceId)}', '${this._escapeSql(materialId)}'
                )`);
                    this.app.locals.devicematerials = null;
                    this.app.locals.vwDeviceMaterials = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteDeviceMaterialMapsByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [devicematerials] WHERE [deviceId]='${this._escapeSql(deviceId)}'`);
                    this.app.locals.devicematerials = null;
                    this.app.locals.vwDeviceMaterials = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getDeviceMaterialByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('vwDeviceMaterials', `deviceId='${this._escapeSql(deviceId)}'`);
        });
    }
    getDeviceMaterialByIds(deviceId, materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('devicematerials', `deviceId='${this._escapeSql(deviceId)}' AND materialId='${this._escapeSql(materialId)}'`);
        });
    }
    getDeviceVendorLinkIgnores() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureDeviceVendorLinkIgnoreSchema();
            return this._getMany('deviceVendorLinkIgnores');
        });
    }
    createDeviceVendorLinkIgnore(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceVendorLinkIgnoreSchema();
                    const sql = this.app.locals.sqlserver;
                    const existing = yield this._getOne('deviceVendorLinkIgnores', `[deviceId]='${this._escapeSql(input.deviceId)}' AND [vendorId]='${this._escapeSql(input.vendorId)}' AND [partNumber]='${this._escapeSql(input.partNumber)}' AND [sourceKind]='${this._escapeSql(input.sourceKind)}'`);
                    if (existing === null || existing === void 0 ? void 0 : existing.ignoreId) {
                        return resolve(existing.ignoreId);
                    }
                    const ignoreId = (0, node_crypto_1.randomUUID)();
                    yield sql.query(`INSERT INTO [deviceVendorLinkIgnores](
                    [ignoreId], [deviceId], [vendorId], [partNumber], [sourceKind], [reason], [createat], [createby]
                )
                VALUES(
                    '${this._escapeSql(ignoreId)}',
                    '${this._escapeSql(input.deviceId)}',
                    '${this._escapeSql(input.vendorId)}',
                    '${this._escapeSql(input.partNumber)}',
                    '${this._escapeSql(input.sourceKind)}',
                    ${typeof input.reason === 'string' && input.reason.trim() ? `N'${this._escapeSql(input.reason)}'` : 'NULL'},
                    GETDATE(),
                    '${this._escapeSql(input.createdBy || 'system')}'
                )`);
                    return resolve(ignoreId);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    removeDeviceVendorLinkIgnore(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceVendorLinkIgnoreSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [deviceVendorLinkIgnores]
                    WHERE [deviceId]='${this._escapeSql(input.deviceId)}'
                      AND [vendorId]='${this._escapeSql(input.vendorId)}'
                      AND [partNumber]='${this._escapeSql(input.partNumber)}'
                      AND [sourceKind]='${this._escapeSql(input.sourceKind)}'`);
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteDeviceVendorLinkIgnoresByDeviceId(deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureDeviceVendorLinkIgnoreSchema();
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [deviceVendorLinkIgnores] WHERE [deviceId]='${this._escapeSql(deviceId)}'`);
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createMaterialAttribute(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`INSERT INTO materialAttributes(
                    [name], [statusId], [materialId], [projectId], [valueType], [defaultValue], [ordinal], [org]
                ) VALUES (
                    N'${this._escapeSql(input.name)}',
                    N'${this._escapeSql(input.statusId || '')}',
                    '${this._escapeSql(input.materialId)}',
                    ${input.projectId ? `'${this._escapeSql(input.projectId)}'` : 'NULL'},
                    N'${this._escapeSql(input.valueType || 'text')}',
                    N'${this._escapeSql(String(input.defaultValue || ''))}',
                    ${Number(input.ordinal || 0)},
                    NULL
                )`);
                    this.app.locals.materialAttributes = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteMaterialAttributesByMaterialId(materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [materialAttributes] WHERE [materialId]='${this._escapeSql(materialId)}'`);
                    this.app.locals.materialAttributes = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createMaterialSubTask(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`INSERT INTO materialSubTasks(
                    [materialId], [statusName], [taskNameFormat], [laborHours], [ordinal], [projectId], [org]
                ) VALUES (
                    '${this._escapeSql(input.materialId)}',
                    N'${this._escapeSql(input.statusName)}',
                    ${input.taskNameFormat ? `N'${this._escapeSql(input.taskNameFormat)}'` : 'NULL'},
                    ${Number(input.laborHours || 0)},
                    ${Number(input.ordinal || 0)},
                    ${input.projectId ? `'${this._escapeSql(input.projectId)}'` : 'NULL'},
                    NULL
                )`);
                    this.app.locals.materialSubTasks = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteMaterialSubTasksByMaterialId(materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    yield sql.query(`DELETE FROM [materialSubTasks] WHERE [materialId]='${this._escapeSql(materialId)}'`);
                    this.app.locals.materialSubTasks = null;
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createVendorImportSnapshot(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    const snapshotId = (0, node_crypto_1.randomUUID)();
                    const createdBy = this._escapeSql(input.createdBy || 'system');
                    yield sql.query(`INSERT INTO [vendorImportSnapshots](
                    [snapshotId], [vendorId], [targetTable], [fileName],
                    [summaryJson], [rowsJson], [rowCount], [createdAt], [createdBy]
                )
                VALUES(
                    '${this._escapeSql(snapshotId)}',
                    '${this._escapeSql(input.vendorId)}',
                    '${this._escapeSql(input.targetTable)}',
                    N'${this._escapeSql(input.fileName)}',
                    N'${this._escapeSql(input.summaryJson)}',
                    N'${this._escapeSql(input.rowsJson)}',
                    ${Number(input.rowCount || 0)},
                    GETDATE(),
                    '${createdBy}'
                )`);
                    return resolve(snapshotId);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getVendorImportSnapshots(vendorId, targetTable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`];
            if (targetTable) {
                filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`);
            }
            return this._getMany('vendorImportSnapshots', filters.join(' AND '), '[createdAt] DESC');
        });
    }
    getVendorImportSnapshot(snapshotId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            return this._getOne('vendorImportSnapshots', `[snapshotId]='${this._escapeSql(snapshotId)}'`);
        });
    }
    createVendorImportRun(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensureVendorImportSchema();
                    const sql = this.app.locals.sqlserver;
                    const runId = (0, node_crypto_1.randomUUID)();
                    yield sql.query(`INSERT INTO [vendorImportRuns](
                    [runId], [vendorId], [targetTable], [fileName], [snapshotId],
                    [action], [rowCount], [importedAt], [createdBy], [notesJson]
                )
                VALUES(
                    '${this._escapeSql(runId)}',
                    '${this._escapeSql(input.vendorId)}',
                    '${this._escapeSql(input.targetTable)}',
                    N'${this._escapeSql(input.fileName)}',
                    ${input.snapshotId ? `'${this._escapeSql(input.snapshotId)}'` : 'NULL'},
                    '${this._escapeSql(input.action)}',
                    ${Number(input.rowCount || 0)},
                    GETDATE(),
                    '${this._escapeSql(input.createdBy || 'system')}',
                    ${typeof input.notesJson === 'string' ? `N'${this._escapeSql(input.notesJson)}'` : 'NULL'}
                )`);
                    return resolve(runId);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getVendorImportRuns(vendorId, targetTable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`];
            if (targetTable) {
                filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`);
            }
            return this._getMany('vendorImportRuns', filters.join(' AND '), '[importedAt] DESC');
        });
    }
    getLatestVendorImportRun(vendorId, targetTable) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureVendorImportSchema();
            const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`];
            if (targetTable) {
                filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`);
            }
            return this._getOne('vendorImportRuns', filters.join(' AND '), '[importedAt] DESC');
        });
    }
    replacePartsForVendor(vendorId, rows) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    yield this.ensurePartsSchema();
                    const sql = this.app.locals.sqlserver;
                    const batches = [];
                    const chunkSize = 150;
                    for (let i = 0; i < rows.length; i += chunkSize) {
                        const batch = rows.slice(i, i + chunkSize);
                        if (batch.length <= 0) {
                            continue;
                        }
                        const values = batch.map((row) => {
                            var _a, _b, _c, _d;
                            return `(
                        ${this._toSqlValue(vendorId)},
                        ${this._toSqlValue(row.sourceVendorName)},
                        ${this._toSqlValue(row.brand)},
                        ${this._toSqlValue(row.parentCategory || row.ParentCategory || '')},
                        ${this._toSqlValue(row.category || row.Category || '')},
                        ${this._toSqlValue(row.partNumber || row.PartNumber || '')},
                        ${this._toSqlValue(row.description || row.LongDescription || '')},
                        ${this._toSqlValue((_a = row.msrp) !== null && _a !== void 0 ? _a : row.MSRPPrice, 'number')},
                        ${this._toSqlValue((_c = (_b = row.cost) !== null && _b !== void 0 ? _b : row.SalesPrice) !== null && _c !== void 0 ? _c : row.MSRPPrice, 'number')},
                        ${this._toSqlValue((_d = row.minQty) !== null && _d !== void 0 ? _d : row.MinOrderQuantity, 'number')},
                        ${this._toSqlValue(row.productStatus || row.ProductStatus || '')},
                        ${this._toSqlValue(row.agency || row.Agency || '')},
                        ${this._toSqlValue(row.countryOfOrigin || row.CountryOfOrigin || '')},
                        ${this._toSqlValue(row.upc || row.UPC || '')},
                        ${this._toSqlValue(row.rawJson || row.RawJson || null)}
                    )`;
                        }).join(',\n');
                        batches.push(`INSERT INTO dbo.parts(
                        vendorId, sourceVendorName, brand, parentCategory, category, partNumber,
                        description, msrp, cost, minQty, productStatus, agency, countryOfOrigin,
                        upc, rawJson
                    ) VALUES ${values}`);
                    }
                    const statements = [
                        'BEGIN TRANSACTION',
                        `DELETE FROM dbo.parts WHERE vendorId=N'${this._escapeSql(vendorId)}'`,
                        ...batches,
                        'COMMIT TRANSACTION'
                    ].join(';\n');
                    yield sql.query(statements);
                    this.app.locals.parts = null;
                    this.app.locals.vwParts = null;
                    return resolve(true);
                }
                catch (err) {
                    try {
                        const sql = this.app.locals.sqlserver;
                        yield sql.query(`IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION`);
                    }
                    catch (_a) { }
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getDeviceResolutionStrategies() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('deviceResolutionStrategies');
        });
    }
    ensurePartsSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield this.ensureVendorImportSchema();
            yield sql.query(`
            IF OBJECT_ID('dbo.parts', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.parts(
                    [partId] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_partId_runtime] DEFAULT (CONVERT(NVARCHAR(40), NEWID())) PRIMARY KEY,
                    [vendorId] NVARCHAR(40) NOT NULL,
                    [sourceVendorName] NVARCHAR(200) NULL,
                    [brand] NVARCHAR(200) NULL,
                    [parentCategory] NVARCHAR(500) NULL,
                    [category] NVARCHAR(500) NULL,
                    [partNumber] NVARCHAR(120) NOT NULL,
                    [description] NVARCHAR(2000) NULL,
                    [msrp] MONEY NULL,
                    [cost] MONEY NULL,
                    [minQty] INT NULL,
                    [upc] NVARCHAR(50) NULL,
                    [productStatus] NVARCHAR(500) NULL,
                    [agency] NVARCHAR(50) NULL,
                    [countryOfOrigin] NVARCHAR(50) NULL,
                    [rawJson] NVARCHAR(MAX) NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_parts_createat_runtime] DEFAULT (GETDATE()),
                    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_createby_runtime] DEFAULT ('system'),
                    [updateat] DATETIME NOT NULL CONSTRAINT [DF_parts_updateat_runtime] DEFAULT (GETDATE()),
                    [updateby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_parts_updateby_runtime] DEFAULT ('system')
                )
            END

            IF EXISTS (
                SELECT 1
                FROM sys.columns
                WHERE [object_id] = OBJECT_ID('dbo.parts')
                    AND [name] = 'description'
                    AND [max_length] < 4000
            )
            BEGIN
                ALTER TABLE dbo.parts ALTER COLUMN [description] NVARCHAR(2000) NULL
            END

            IF NOT EXISTS (
                SELECT 1 FROM sys.indexes
                WHERE [name] = 'IX_parts_vendor_part'
                    AND [object_id] = OBJECT_ID('dbo.parts')
            )
            BEGIN
                CREATE NONCLUSTERED INDEX [IX_parts_vendor_part]
                    ON dbo.parts([vendorId] ASC, [partNumber] ASC)
            END

            EXEC(N'CREATE OR ALTER VIEW dbo.vwParts AS SELECT
                    p.partId,
                    p.vendorId,
                    v.name AS vendorName,
                    p.sourceVendorName,
                    p.brand,
                    p.parentCategory,
                    p.category,
                    p.partNumber,
                    p.description,
                    p.msrp,
                    p.cost,
                    p.minQty,
                    p.upc,
                    p.productStatus,
                    p.agency,
                    p.countryOfOrigin
                FROM dbo.parts p
                INNER JOIN dbo.vendors v ON p.vendorId = v.vendorId')
        `);
        });
    }
    normalizePartRows(rows) {
        return rows.map((row) => {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
            return (Object.assign(Object.assign({}, row), { ParentCategory: (_b = (_a = row.ParentCategory) !== null && _a !== void 0 ? _a : row.parentCategory) !== null && _b !== void 0 ? _b : '', Category: (_d = (_c = row.Category) !== null && _c !== void 0 ? _c : row.category) !== null && _d !== void 0 ? _d : '', PartNumber: (_f = (_e = row.PartNumber) !== null && _e !== void 0 ? _e : row.partNumber) !== null && _f !== void 0 ? _f : '', LongDescription: (_h = (_g = row.LongDescription) !== null && _g !== void 0 ? _g : row.description) !== null && _h !== void 0 ? _h : '', MSRPPrice: Number((_k = (_j = row.MSRPPrice) !== null && _j !== void 0 ? _j : row.msrp) !== null && _k !== void 0 ? _k : 0), SalesPrice: Number((_m = (_l = row.SalesPrice) !== null && _l !== void 0 ? _l : row.cost) !== null && _m !== void 0 ? _m : 0), FuturePrice: (_o = row.FuturePrice) !== null && _o !== void 0 ? _o : null, FutureEffectiveDate: (_p = row.FutureEffectiveDate) !== null && _p !== void 0 ? _p : null, FutureSalesPrice: (_q = row.FutureSalesPrice) !== null && _q !== void 0 ? _q : null, FutureSalesEffectiveDate: (_r = row.FutureSalesEffectiveDate) !== null && _r !== void 0 ? _r : null, MinOrderQuantity: Number((_t = (_s = row.MinOrderQuantity) !== null && _s !== void 0 ? _s : row.minQty) !== null && _t !== void 0 ? _t : 0), ProductStatus: (_v = (_u = row.ProductStatus) !== null && _u !== void 0 ? _u : row.productStatus) !== null && _v !== void 0 ? _v : null, Agency: (_x = (_w = row.Agency) !== null && _w !== void 0 ? _w : row.agency) !== null && _x !== void 0 ? _x : null, CountryOfOrigin: (_z = (_y = row.CountryOfOrigin) !== null && _y !== void 0 ? _y : row.countryOfOrigin) !== null && _z !== void 0 ? _z : null, UPC: (_1 = (_0 = row.UPC) !== null && _0 !== void 0 ? _0 : row.upc) !== null && _1 !== void 0 ? _1 : '', ProductID: (_2 = row.ProductID) !== null && _2 !== void 0 ? _2 : row.partId, PrimaryImage: (_3 = row.PrimaryImage) !== null && _3 !== void 0 ? _3 : null, QuantityAvailable: (_4 = row.QuantityAvailable) !== null && _4 !== void 0 ? _4 : null }));
        });
    }
    ensureVendorImportSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF COL_LENGTH('dbo.vendors', 'importConfigJson') IS NULL
            BEGIN
                ALTER TABLE dbo.vendors
                ADD [importConfigJson] NVARCHAR(MAX) NULL
            END

            IF COL_LENGTH('dbo.vendors', 'logoFileName') IS NULL
            BEGIN
                ALTER TABLE dbo.vendors
                ADD [logoFileName] NVARCHAR(260) NULL
            END

            IF COL_LENGTH('dbo.vendors', 'logoDataUrl') IS NULL
            BEGIN
                ALTER TABLE dbo.vendors
                ADD [logoDataUrl] NVARCHAR(MAX) NULL
            END

            IF OBJECT_ID('dbo.vendorImportSnapshots', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.vendorImportSnapshots(
                    [snapshotId] NVARCHAR(40) NOT NULL PRIMARY KEY,
                    [vendorId] NVARCHAR(40) NOT NULL,
                    [targetTable] NVARCHAR(128) NOT NULL,
                    [fileName] NVARCHAR(260) NOT NULL,
                    [summaryJson] NVARCHAR(MAX) NOT NULL,
                    [rowsJson] NVARCHAR(MAX) NOT NULL,
                    [rowCount] INT NOT NULL,
                    [createdAt] DATETIME NOT NULL CONSTRAINT [DF_vendorImportSnapshots_createdAt_runtime] DEFAULT (GETDATE()),
                    [createdBy] NVARCHAR(40) NOT NULL CONSTRAINT [DF_vendorImportSnapshots_createdBy_runtime] DEFAULT ('system')
                )
            END

            IF OBJECT_ID('dbo.vendorImportRuns', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.vendorImportRuns(
                    [runId] NVARCHAR(40) NOT NULL PRIMARY KEY,
                    [vendorId] NVARCHAR(40) NOT NULL,
                    [targetTable] NVARCHAR(128) NOT NULL,
                    [fileName] NVARCHAR(260) NOT NULL,
                    [snapshotId] NVARCHAR(40) NULL,
                    [action] NVARCHAR(30) NOT NULL,
                    [rowCount] INT NOT NULL,
                    [importedAt] DATETIME NOT NULL CONSTRAINT [DF_vendorImportRuns_importedAt_runtime] DEFAULT (GETDATE()),
                    [createdBy] NVARCHAR(40) NOT NULL CONSTRAINT [DF_vendorImportRuns_createdBy_runtime] DEFAULT ('system'),
                    [notesJson] NVARCHAR(MAX) NULL
                )
            END
        `);
        });
    }
    ensureDeviceVendorLinkIgnoreSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF OBJECT_ID('dbo.deviceVendorLinkIgnores', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.deviceVendorLinkIgnores(
                    [ignoreId] NVARCHAR(40) NOT NULL PRIMARY KEY,
                    [deviceId] NVARCHAR(40) NOT NULL,
                    [vendorId] NVARCHAR(40) NOT NULL,
                    [partNumber] NVARCHAR(100) NOT NULL,
                    [sourceKind] NVARCHAR(20) NOT NULL,
                    [reason] NVARCHAR(500) NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_deviceVendorLinkIgnores_createat_runtime] DEFAULT (GETDATE()),
                    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceVendorLinkIgnores_createby_runtime] DEFAULT ('system')
                )
            END
        `);
        });
    }
    ensureDeviceSetSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF OBJECT_ID('dbo.deviceSets', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.deviceSets(
                    [deviceSetId] NVARCHAR(40) NOT NULL PRIMARY KEY,
                    [name] NVARCHAR(120) NOT NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_deviceSets_createat_runtime] DEFAULT (GETDATE()),
                    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceSets_createby_runtime] DEFAULT ('system'),
                    [updateat] DATETIME NOT NULL CONSTRAINT [DF_deviceSets_updateat_runtime] DEFAULT (GETDATE()),
                    [updateby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceSets_updateby_runtime] DEFAULT ('system')
                )
            END

            IF OBJECT_ID('dbo.deviceSetDevices', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.deviceSetDevices(
                    [deviceSetDeviceId] NVARCHAR(40) NOT NULL PRIMARY KEY,
                    [deviceSetId] NVARCHAR(40) NOT NULL,
                    [deviceId] NVARCHAR(40) NOT NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_deviceSetDevices_createat_runtime] DEFAULT (GETDATE()),
                    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceSetDevices_createby_runtime] DEFAULT ('system')
                )
            END
        `);
        });
    }
    ensureDeviceMaterialTextSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.app.locals.deviceMaterialTextSchemaEnsured) {
                return;
            }
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF OBJECT_ID('dbo.devices', 'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('dbo.devices', 'laborRate') IS NULL
                BEGIN
                    ALTER TABLE dbo.devices ADD [laborRate] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_devices_laborRate_runtime] DEFAULT ((56))
                END

                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'name' AND max_length < 1000)
                    ALTER TABLE dbo.devices ALTER COLUMN [name] NVARCHAR(500) NOT NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'shortName' AND max_length < 400)
                    ALTER TABLE dbo.devices ALTER COLUMN [shortName] NVARCHAR(200) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'partNumber' AND max_length < 240)
                    ALTER TABLE dbo.devices ALTER COLUMN [partNumber] NVARCHAR(120) NOT NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'link' AND max_length < 2000)
                    ALTER TABLE dbo.devices ALTER COLUMN [link] NVARCHAR(1000) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'slcAddress' AND max_length < 200)
                    ALTER TABLE dbo.devices ALTER COLUMN [slcAddress] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'serialNumber' AND max_length < 200)
                    ALTER TABLE dbo.devices ALTER COLUMN [serialNumber] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'strobeAddress' AND max_length < 200)
                    ALTER TABLE dbo.devices ALTER COLUMN [strobeAddress] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'speakerAddress' AND max_length < 200)
                    ALTER TABLE dbo.devices ALTER COLUMN [speakerAddress] NVARCHAR(100) NULL
            END

            IF OBJECT_ID('dbo.materials', 'U') IS NOT NULL
            BEGIN
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'name' AND max_length < 1000)
                    ALTER TABLE dbo.materials ALTER COLUMN [name] NVARCHAR(500) NOT NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'shortName' AND max_length < 400)
                    ALTER TABLE dbo.materials ALTER COLUMN [shortName] NVARCHAR(200) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'partNumber' AND max_length < 240)
                    ALTER TABLE dbo.materials ALTER COLUMN [partNumber] NVARCHAR(120) NOT NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'link' AND max_length < 2000)
                    ALTER TABLE dbo.materials ALTER COLUMN [link] NVARCHAR(1000) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'slcAddress' AND max_length < 200)
                    ALTER TABLE dbo.materials ALTER COLUMN [slcAddress] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'serialNumber' AND max_length < 200)
                    ALTER TABLE dbo.materials ALTER COLUMN [serialNumber] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'strobeAddress' AND max_length < 200)
                    ALTER TABLE dbo.materials ALTER COLUMN [strobeAddress] NVARCHAR(100) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'speakerAddress' AND max_length < 200)
                    ALTER TABLE dbo.materials ALTER COLUMN [speakerAddress] NVARCHAR(100) NULL
            END
        `);
            yield sql.query(`
            IF OBJECT_ID('dbo.vwDevices', 'V') IS NOT NULL
                AND (
                    COL_LENGTH('dbo.vwDevices', 'laborRate') IS NULL
                    OR COL_LENGTH('dbo.vwDevices', 'attributeCount') IS NULL
                    OR COL_LENGTH('dbo.vwDevices', 'subTaskCount') IS NULL
                )
            BEGIN
                EXEC(N'ALTER VIEW [dbo].[vwDevices]
                AS
                SELECT dbo.devices.deviceId, dbo.devices.name, dbo.devices.shortName, dbo.devices.categoryId, dbo.categories.name AS categoryName, dbo.devices.vendorId, dbo.vendors.name AS vendorName, dbo.devices.partNumber, dbo.devices.cost,
                    dbo.devices.defaultLabor, dbo.devices.laborRate, dbo.devices.slcAddress, dbo.devices.serialNumber, dbo.devices.strobeAddress, dbo.devices.speakerAddress, dbo.devices.createat, dbo.devices.createby, dbo.devices.updateat, dbo.devices.updateby,
                    ISNULL(attributeCounts.attributeCount, 0) AS attributeCount,
                    ISNULL(subTaskCounts.subTaskCount, 0) AS subTaskCount
                FROM dbo.devices INNER JOIN
                    dbo.categories ON dbo.devices.categoryId = dbo.categories.categoryId INNER JOIN
                    dbo.vendors ON dbo.devices.vendorId = dbo.vendors.vendorId LEFT OUTER JOIN
                    (SELECT materialId, COUNT(*) AS attributeCount FROM dbo.materialAttributes GROUP BY materialId) AS attributeCounts ON dbo.devices.deviceId = attributeCounts.materialId LEFT OUTER JOIN
                    (SELECT materialId, COUNT(*) AS subTaskCount FROM dbo.materialSubTasks GROUP BY materialId) AS subTaskCounts ON dbo.devices.deviceId = subTaskCounts.materialId')
            END
        `);
            this.app.locals.deviceMaterialTextSchemaEnsured = true;
        });
    }
    ensureCategorySchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF COL_LENGTH('dbo.categories', 'defaultLabor') IS NULL
            BEGIN
                ALTER TABLE dbo.categories ADD [defaultLabor] DECIMAL(18, 2) NULL
            END

            IF COL_LENGTH('dbo.categories', 'includeOnFloorplan') IS NULL
            BEGIN
                ALTER TABLE dbo.categories ADD [includeOnFloorplan] BIT NOT NULL CONSTRAINT [DF_categories_includeOnFloorplan_runtime] DEFAULT ((0))
            END

            IF COL_LENGTH('dbo.categories', 'slcAddress') IS NULL
            BEGIN
                ALTER TABLE dbo.categories ADD [slcAddress] NVARCHAR(50) NULL
            END

            IF COL_LENGTH('dbo.categories', 'speakerAddress') IS NULL
            BEGIN
                ALTER TABLE dbo.categories ADD [speakerAddress] NVARCHAR(50) NULL
            END

            IF COL_LENGTH('dbo.categories', 'strobeAddress') IS NULL
            BEGIN
                ALTER TABLE dbo.categories ADD [strobeAddress] NVARCHAR(50) NULL
            END
        `);
        });
    }
    ensureWorkspaceStorageSchema() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            yield sql.query(`
            IF OBJECT_ID('dbo.workspaceStorage', 'U') IS NULL
            BEGIN
                CREATE TABLE dbo.workspaceStorage (
                    [workspaceStorageId] UNIQUEIDENTIFIER NOT NULL CONSTRAINT [DF_workspaceStorage_workspaceStorageId_runtime] DEFAULT NEWID(),
                    [area] NVARCHAR(100) NOT NULL,
                    [workspaceKey] NVARCHAR(200) NOT NULL,
                    [payloadJson] NVARCHAR(MAX) NOT NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_workspaceStorage_createat_runtime] DEFAULT GETDATE(),
                    [createby] NVARCHAR(100) NOT NULL CONSTRAINT [DF_workspaceStorage_createby_runtime] DEFAULT ('system'),
                    [updateat] DATETIME NOT NULL CONSTRAINT [DF_workspaceStorage_updateat_runtime] DEFAULT GETDATE(),
                    [updateby] NVARCHAR(100) NOT NULL CONSTRAINT [DF_workspaceStorage_updateby_runtime] DEFAULT ('system'),
                    CONSTRAINT [PK_workspaceStorage_runtime] PRIMARY KEY CLUSTERED ([workspaceStorageId] ASC)
                )
            END

            IF NOT EXISTS (
                SELECT 1
                FROM sys.indexes
                WHERE [name] = 'IX_workspaceStorage_area_workspaceKey'
                    AND [object_id] = OBJECT_ID('dbo.workspaceStorage')
            )
            BEGIN
                CREATE UNIQUE NONCLUSTERED INDEX [IX_workspaceStorage_area_workspaceKey]
                    ON dbo.workspaceStorage([area] ASC, [workspaceKey] ASC)
            END
        `);
        });
    }
    _getMany(tableName, filter, sort) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.app.locals && this.app.locals[tableName] && !filter) {
                    return resolve([...this.app.locals[tableName]]);
                }
                const sql = this.app.locals.sqlserver;
                let phrase = `SELECT * FROM ${tableName}`;
                if (filter) {
                    phrase += ` WHERE ${filter}`;
                }
                if (sort) {
                    phrase += ` ORDER BY ${sort}`;
                }
                const result = yield sql.query(phrase);
                if (!result || !result.recordset) {
                    throw new Error(`No ${tableName} with filter ${filter} found`);
                }
                if (!filter) {
                    this.app.locals[tableName] = [...result.recordset];
                }
                return resolve([...result.recordset]);
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.error(`ERROR getMany: ${tableName} with filter: "${filter}" and sort: "${sort}"`);
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    _escapeSql(value) {
        return String(value || '').replace(/'/g, "''");
    }
    _escapeSqlLike(value) {
        return String(value || '')
            .replace(/~/g, '~~')
            .replace(/%/g, '~%')
            .replace(/_/g, '~_')
            .replace(/\[/g, '[[]');
    }
    _truncateSqlString(value, maxLength) {
        const text = String(value || '');
        return text.length > maxLength ? text.slice(0, maxLength) : text;
    }
    _toSqlValue(value, type = 'string') {
        if (value === null || typeof value === 'undefined' || value === '') {
            return 'NULL';
        }
        if (type === 'number') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? `${parsed}` : 'NULL';
        }
        if (type === 'date') {
            const normalized = this._normalizeDateValue(value);
            return normalized ? `'${this._escapeSql(normalized)}'` : 'NULL';
        }
        return `N'${this._escapeSql(String(value))}'`;
    }
    _normalizeDateValue(value) {
        if (!value) {
            return null;
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10);
        }
        const raw = String(value).trim();
        if (!raw) {
            return null;
        }
        const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (dateOnlyMatch) {
            return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`;
        }
        const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
        if (usMatch) {
            const month = usMatch[1].padStart(2, '0');
            const day = usMatch[2].padStart(2, '0');
            return `${usMatch[3]}-${month}-${day}`;
        }
        const parsed = new Date(raw);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10);
        }
        return null;
    }
    _getOne(tableName, filter, sort) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    let phrase = `SELECT * FROM ${tableName}`;
                    if (filter) {
                        phrase += ` WHERE ${filter}`;
                    }
                    if (sort) {
                        phrase += ` ORDER BY ${sort}`;
                    }
                    const result = yield sql.query(phrase);
                    if (!result || !result.recordset) {
                        throw new Error(`No One Record from ${tableName} with filter ${filter} found`);
                    }
                    if (result.length > 0) {
                        return resolve(result[0]);
                    }
                    if (result.recordset && result.recordset.length > 0) {
                        return resolve(result.recordset[0]);
                    }
                    return resolve(null);
                }
                catch (err) {
                    if (!err.handled) {
                        err.handled = true;
                        console.error(`ERROR getMany: ${tableName} with filter: "${filter}" and sort: "${sort}"`);
                        console.error(err);
                    }
                    return reject(err);
                }
            }));
        });
    }
}
exports.SqlDb = SqlDb;
class NoRecordsFound {
}
exports.NoRecordsFound = NoRecordsFound;
