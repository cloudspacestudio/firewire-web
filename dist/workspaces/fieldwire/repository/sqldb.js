"use strict";
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
    getVwDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('vwDevices');
        });
    }
    getCategories() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('categories');
        });
    }
    getVendors() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('vendors');
        });
    }
    getMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materials');
        });
    }
    getDeviceMaterials() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('devicematerials');
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
    getMaterialSubTasks() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('materialSubTasks');
        });
    }
    getTestDevices() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('testdevices');
        });
    }
    getEddyProducts() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('EddyProducts');
        });
    }
    getEddyPricelist() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('EddyPricelist');
        });
    }
    createCategory(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO categories(name, shortName, handle)
                VALUES('${input.name}','${input.shortName}','${input.handle}')`);
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
            return this._getOne('categories', `handle='${handle}'`);
        });
    }
    createMaterial(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO materials(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    '${input.name}','${input.shortName}','${input.vendorId}', '${input.categoryId}',
                    '${input.partNumber}', '${input.link}', ${input.cost}, ${input.defaultLabor},
                    '${input.slcAddress}', '${input.serialNumber}', '${input.strobeAddress}', '${input.speakerAddress}'
                )`);
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
    createDevice(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO devices(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    '${input.name}','${input.shortName}','${input.vendorId}', '${input.categoryId}',
                    '${input.partNumber}', '${input.link}', ${input.cost}, ${input.defaultLabor},
                    '${input.slcAddress}', '${input.serialNumber}', '${input.strobeAddress}', '${input.speakerAddress}'
                )`);
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
    createDeviceMaterialMap(deviceId, materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sql = this.app.locals.sqlserver;
                    const result = yield sql.query(`INSERT INTO devicematerials(
                    deviceId, materialId
                )
                VALUES(
                    '${deviceId}', '${materialId}'
                )`);
                    return resolve(true);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getDeviceMaterialByIds(deviceId, materialId) {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getOne('devicematerials', `deviceId='${deviceId}' AND materialId='${materialId}`);
        });
    }
    getEddyProductByPartNumber(partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this._getOne('EddyPriceList', `PartNumber='${partNumber}'`);
        });
    }
    getDeviceResolutionStrategies() {
        return __awaiter(this, void 0, void 0, function* () {
            return this._getMany('deviceResolutionStrategies');
        });
    }
    _getMany(tableName, filter, sort) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.app.locals && this.app.locals[tableName]) {
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
                this.app.locals[tableName] = [...result.recordset];
                return resolve([...this.app.locals[tableName]]);
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
