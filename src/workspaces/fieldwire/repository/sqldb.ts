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

export class SqlDb {

    constructor(private app: express.Application) {}

    // #region Sql Table Queries
    public async getDevices(): Promise<Device[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.devices) {
                    return resolve([...this.app.locals.devices])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM devices`)
                if (!result || !result.recordset) {
                    throw new Error(`No devices found`)
                }
                this.app.locals.devices = [...result.recordset]
                return resolve([...this.app.locals.devices])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getCategories(): Promise<Category[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.categories) {
                    return resolve([...this.app.locals.categories])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM categories`)
                if (!result || !result.recordset) {
                    throw new Error(`No categories found`)
                }
                this.app.locals.categories = [...result.recordset]
                return resolve([...this.app.locals.categories])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getVendors(): Promise<Vendor[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.vendors) {
                    return resolve([...this.app.locals.vendors])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM vendors`)
                if (!result || !result.recordset) {
                    throw new Error(`No vendors found`)
                }
                this.app.locals.vendors = [...result.recordset]
                return resolve([...this.app.locals.vendors])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getMaterials(): Promise<Material[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.materials) {
                    return resolve([...this.app.locals.materials])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM materials`)
                if (!result || !result.recordset) {
                    throw new Error(`No materials found`)
                }
                this.app.locals.materials = [...result.recordset]
                return resolve([...this.app.locals.materials])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getDeviceMaterials(): Promise<DeviceMaterial[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.devicematerials) {
                    return resolve([...this.app.locals.devicematerials])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM devicematerials`)
                if (!result || !result.recordset) {
                    throw new Error(`No devicematerials found`)
                }
                this.app.locals.devicematerials = [...result.recordset]
                return resolve([...this.app.locals.devicematerials])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getMaterialAttributes(): Promise<MaterialAttribute[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.materialattributes) {
                    return resolve([...this.app.locals.materialattributes])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM materialAttributes`)
                if (!result || !result.recordset) {
                    throw new Error(`No materialattributes found`)
                }
                this.app.locals.materialattributes = [...result.recordset]
                return resolve([...this.app.locals.materialattributes])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getMaterialSubTasks(): Promise<MaterialSubTask[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.materialsubtasks) {
                    return resolve([...this.app.locals.materialsubtasks])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM materialSubTasks`)
                if (!result || !result.recordset) {
                    throw new Error(`No materialsubtasks found`)
                }
                this.app.locals.materialsubtasks = [...result.recordset]
                return resolve([...this.app.locals.materialsubtasks])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getTestDevices(): Promise<TestDevice[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.testdevices) {
                    return resolve([...this.app.locals.testdevices])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM testdevices`)
                if (!result || !result.recordset) {
                    throw new Error(`No testdevices found`)
                }
                this.app.locals.testdevices = [...result.recordset]
                return resolve([...this.app.locals.testdevices])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getEddyProducts(): Promise<EddyProduct[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.eddyproducts) {
                    return resolve([...this.app.locals.eddyproducts])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM EddyProducts`)
                if (!result || !result.recordset) {
                    throw new Error(`No eddyproducts found`)
                }
                this.app.locals.eddyproducts = [...result.recordset]
                return resolve([...this.app.locals.eddyproducts])
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async getEddyPricelist(): Promise<EddyPricelist[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (this.app.locals && this.app.locals.eddypricelist) {
                    return resolve([...this.app.locals.eddypricelist])
                }
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM EddyPricelist`)
                if (!result || !result.recordset) {
                    throw new Error(`No eddypricelist found`)
                }
                this.app.locals.eddypricelist = [...result.recordset]
                return resolve([...this.app.locals.eddypricelist])
            } catch (err) {
                return reject(err)
            }
        });
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
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM categories WHERE handle='${handle}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return resolve(null)
                }
                return resolve(result.recordset[0])
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
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
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM materials WHERE partNumber='${partNumber}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return resolve(null)
                }
                return resolve(result.recordset[0])
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
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
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM devices WHERE partNumber='${partNumber}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return resolve(null)
                }
                return resolve(result.recordset[0])
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
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
    public async getDeviceMaterialByIds(deviceId: string, materialId: string): Promise<DeviceMaterial|null> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM devicematerials WHERE deviceId='${deviceId}' AND materialId='${materialId}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return resolve(null)
                }
                return resolve(result.recordset[0])
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getEddyProductByPartNumber(partNumber: string): Promise<Material|null> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM EddyPricelist WHERE PartNumber='${partNumber}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return resolve(null)
                }
                return resolve(result.recordset[0])
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    
    // #endregion    

}