import * as express from 'express'
import { Device } from './device';
import { Category } from './category';
import { Vendor } from './vendor';
import { Material } from './material';
import { DeviceMaterial } from './devicematerial';
import { TestDevice } from './testdevice';
import { EddyProduct } from './EddyProduct';
import { EddyPricelist } from './EddyPricelist';
import { MaterialAttribute } from './materialattribute';
import { MaterialSubTask } from './materialsubtask';
import { DeviceResolutionStrategy } from './deviceResolutionStrategy';
import { DeviceAlias } from './devicealias';
import { VwDevice } from './vwdevice';
import { VwMaterial } from './vwmaterial';
import { VwDeviceMaterial } from './vwdevicematerial';
import { VwEddyPricelist } from './vwEddyPricelist';

export class SqlDb {

    constructor(private app: express.Application) {}

    // #region Sql Table Queries
    public async getDevices(): Promise<Device[]> {
        return this._getMany<Device>('devices')
    }
    public async getDevice(deviceId: string): Promise<VwDevice|null> {
        return this._getOne<VwDevice>('vwDevices', `deviceId='${deviceId}'`)
    }
    public async getVwDevices(): Promise<VwDevice[]> {
        return this._getMany<VwDevice>('vwDevices')
    }
    public async getCategories(): Promise<Category[]> {
        return this._getMany<Category>('categories')
    }
    public async getVendors(): Promise<Vendor[]> {
        return this._getMany<Vendor>('vendors')
    }
    public async getMaterials(): Promise<Material[]> {
        return this._getMany<Material>('materials')
    }
    public async getVwMaterials(): Promise<VwMaterial[]> {
        return this._getMany<VwMaterial>('vwMaterials')
    }
    public async getVwDeviceMaterials(): Promise<VwDeviceMaterial[]> {
        return this._getMany<VwDeviceMaterial>('vwDeviceMaterials')
    }
    public async getDeviceMaterials(): Promise<DeviceMaterial[]> {
        return this._getMany<DeviceMaterial>('devicematerials')
    }
    public async getDeviceAliases(): Promise<DeviceAlias[]> {
        return this._getMany<DeviceAlias>('deviceAliases')
    }
    public async getMaterialAttributes(): Promise<MaterialAttribute[]> {
        return this._getMany<MaterialAttribute>('materialAttributes')
    }
    public async getMaterialAttributesByDeviceId(deviceId: string): Promise<MaterialAttribute[]> {
        return this._getMany<MaterialAttribute>('materialAttributes', `materialId='${deviceId}'`)
    }
    public async getMaterialSubTasks(): Promise<MaterialSubTask[]> {
        return this._getMany<MaterialSubTask>('materialSubTasks')
    }
    public async getMaterialSubTasksByDeviceId(deviceId: string): Promise<MaterialSubTask[]> {
        return this._getMany<MaterialSubTask>('materialSubTasks', `materialId='${deviceId}'`)
    }
    
    public async getTestDevices(): Promise<TestDevice[]> {
        return this._getMany<TestDevice>('testdevices')
    }
    public async getEddyProducts(): Promise<EddyProduct[]> {
        return this._getMany<EddyProduct>('EddyProducts')
    }
    public async getEddyPricelist(): Promise<EddyPricelist[]> {
        return this._getMany<EddyPricelist>('EddyPricelist', `ProductStatus IS NULL`)
    }
    public async getVwEddyPricelist(): Promise<VwEddyPricelist[]> {
        return this._getMany<VwEddyPricelist>('VwEddyPricelist', `ProductStatus IS NULL`)
    }
    public async getVwEddyPricelistByPartNumber(partNumber: string): Promise<VwEddyPricelist[]> {
        return this._getMany<VwEddyPricelist>('VwEddyPricelist', `PartNumber='${partNumber}' AND ProductStatus IS NULL`)
    }
    public async createCategory(input: Category): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO categories(name, shortName, handle)
                VALUES('${input.name}','${input.shortName}','${input.handle}')`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async getCategoryByHandle(handle: string): Promise<Category|null> {
        return this._getOne<Category>('categories', `handle='${handle}'`)
    }
    public async createMaterial(input: Material): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO materials(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    '${input.name}','${input.shortName}','${input.vendorId}', '${input.categoryId}',
                    '${input.partNumber}', '${input.link}', ${input.cost}, ${input.defaultLabor},
                    '${input.slcAddress}', '${input.serialNumber}', '${input.strobeAddress}', '${input.speakerAddress}'
                )`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async getMaterialByPartNumber(partNumber: string): Promise<Material|null> {
        return this._getOne<Material>('materials', `partNumber='${partNumber}'`)
    }
    public async createDevice(input: Device): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO devices(
                    name, shortName, vendorId, categoryId,
                    partNumber, link, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    '${input.name}','${input.shortName}','${input.vendorId}', '${input.categoryId}',
                    '${input.partNumber}', '${input.link}', ${input.cost}, ${input.defaultLabor},
                    '${input.slcAddress}', '${input.serialNumber}', '${input.strobeAddress}', '${input.speakerAddress}'
                )`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async getDeviceByPartNumber(partNumber: string): Promise<Device|null> {
        return this._getOne<Device>('devices', `partNumber='${partNumber}'`)
    }
    public async createDeviceMaterialMap(deviceId: string, materialId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO devicematerials(
                    deviceId, materialId
                )
                VALUES(
                    '${deviceId}', '${materialId}'
                )`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async getDeviceMaterialByDeviceId(deviceId: string): Promise<VwDeviceMaterial[]|null> {
        return this._getMany<VwDeviceMaterial>('vwDeviceMaterials', `deviceId='${deviceId}'`)
    }
    public async getDeviceMaterialByIds(deviceId: string, materialId: string): Promise<DeviceMaterial|null> {
        return this._getOne<DeviceMaterial>('devicematerials', `deviceId='${deviceId}' AND materialId='${materialId}`)
    }
    public async getEddyProductByPartNumber(partNumber: string): Promise<Material|null> {
        return await this._getOne<Material>('EddyPriceList', `PartNumber='${partNumber}'`)
    }
    public async getDeviceResolutionStrategies(): Promise<DeviceResolutionStrategy[]> {
        return this._getMany<DeviceResolutionStrategy>('deviceResolutionStrategies')
    }
    
    private _getMany<T>(tableName: string, filter?: string, sort?: string): Promise<T[]> {
        return new Promise<T[]>(async(resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals[tableName] && !filter) {
                    return resolve([...this.app.locals[tableName]])
                }
                const sql = this.app.locals.sqlserver
                let phrase = `SELECT * FROM ${tableName}`
                if (filter) {
                    phrase += ` WHERE ${filter}`
                }
                if (sort) {
                    phrase += ` ORDER BY ${sort}`
                }
                const result = await sql.query(phrase)
                if (!result || !result.recordset) {
                    throw new Error(`No ${tableName} with filter ${filter} found`)
                }
                if (!filter) {
                    this.app.locals[tableName] = [...result.recordset]
                }
                return resolve([...result.recordset])
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(`ERROR getMany: ${tableName} with filter: "${filter}" and sort: "${sort}"`)
                    console.error(err)
                }
                return reject(err)
            }
        })
    }
    private async _getOne<T>(tableName: string, filter?: string, sort?: string): Promise<T|null> {
        return new Promise<T>(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                let phrase = `SELECT * FROM ${tableName}`
                if (filter) {
                    phrase += ` WHERE ${filter}`
                }
                if (sort) {
                    phrase += ` ORDER BY ${sort}`
                }
                const result = await sql.query(phrase)
                if (!result || !result.recordset) {
                    throw new Error(`No One Record from ${tableName} with filter ${filter} found`)
                }
                if (result.length > 0) {
                    return resolve(result[0])
                }
                if (result.recordset && result.recordset.length > 0) {
                    return resolve(result.recordset[0])
                }
                return resolve(null as any)
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.error(`ERROR getMany: ${tableName} with filter: "${filter}" and sort: "${sort}"`)
                    console.error(err)
                }
                return reject(err)
            }
        })
    }
    // #endregion    

}

export class NoRecordsFound {

}