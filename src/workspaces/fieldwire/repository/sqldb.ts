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
import { CategoryLaborSchema } from '../schemas/categorylabor.schema';
import { VendorImportSnapshot } from './vendorImportSnapshot';
import { VendorImportRun } from './vendorImportRun';
import { DeviceVendorLinkIgnore } from './deviceVendorLinkIgnore';
import { DeviceSet } from './deviceSet';
import { DeviceSetDevice } from './deviceSetDevice';
import { WorkspaceStorageRecord } from './workspaceStorage';
import { randomUUID } from 'node:crypto';

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
        await this.ensureCategorySchema()
        return this._getMany<Category>('categories')
    }
    public async getVendors(): Promise<Vendor[]> {
        await this.ensureVendorImportSchema()
        return this._getMany<Vendor>('vendors')
    }
    public async getVendorById(vendorId: string): Promise<Vendor|null> {
        await this.ensureVendorImportSchema()
        return this._getOne<Vendor>('vendors', `[vendorId]='${this._escapeSql(vendorId)}'`)
    }
    public async updateVendor(input: Vendor): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                const escape = (value: string) => String(value || '').replace(/'/g, "''")
                const importConfigSql = typeof input.importConfigJson === 'string'
                    ? `N'${escape(input.importConfigJson)}'`
                    : '[importConfigJson]'
                const logoFileNameSql = typeof input.logoFileName === 'string'
                    ? `N'${escape(input.logoFileName)}'`
                    : '[logoFileName]'
                const logoDataUrlSql = typeof input.logoDataUrl === 'string'
                    ? `N'${escape(input.logoDataUrl)}'`
                    : '[logoDataUrl]'
                await sql.query(`UPDATE vendors
                    SET [name]='${escape(input.name)}',
                        [desc]='${escape(input.desc)}',
                        [link]='${escape(input.link)}',
                        [importConfigJson]=${importConfigSql},
                        [logoFileName]=${logoFileNameSql},
                        [logoDataUrl]=${logoDataUrlSql},
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${escape(input.vendorId)}'`)
                this.app.locals.vendors = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async updateVendorImportConfig(vendorId: string, importConfigJson: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE vendors
                    SET [importConfigJson]=N'${this._escapeSql(importConfigJson)}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${this._escapeSql(vendorId)}'`)
                this.app.locals.vendors = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async updateVendorLogo(vendorId: string, logoFileName: string, logoDataUrl: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE vendors
                    SET [logoFileName]=N'${this._escapeSql(logoFileName)}',
                        [logoDataUrl]=N'${this._escapeSql(logoDataUrl)}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [vendorId]='${this._escapeSql(vendorId)}'`)
                this.app.locals.vendors = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getCategoryLabors(): Promise<CategoryLaborSchema[]> {
        return this._getMany<CategoryLaborSchema>('categoryLabors')
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
    public async getDeviceSets(): Promise<DeviceSet[]> {
        await this.ensureDeviceSetSchema()
        return this._getMany<DeviceSet>('deviceSets', undefined, '[name] ASC')
    }
    public async getDeviceSet(deviceSetId: string): Promise<DeviceSet|null> {
        await this.ensureDeviceSetSchema()
        return this._getOne<DeviceSet>('deviceSets', `[deviceSetId]='${this._escapeSql(deviceSetId)}'`)
    }
    public async getDeviceSetDevices(deviceSetId?: string): Promise<DeviceSetDevice[]> {
        await this.ensureDeviceSetSchema()
        const filter = deviceSetId ? `[deviceSetId]='${this._escapeSql(deviceSetId)}'` : undefined
        return this._getMany<DeviceSetDevice>('deviceSetDevices', filter, '[createat] ASC')
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
    public async getAllEddyPricelist(): Promise<EddyPricelist[]> {
        return this._getMany<EddyPricelist>('EddyPricelist')
    }
    public async getVwEddyPricelist(): Promise<VwEddyPricelist[]> {
        return this._getMany<VwEddyPricelist>('VwEddyPricelist', `ProductStatus IS NULL`)
    }
    public async getVwEddyPricelistByPartNumber(partNumber: string): Promise<VwEddyPricelist[]> {
        return this._getMany<VwEddyPricelist>('VwEddyPricelist', `PartNumber='${partNumber}' AND ProductStatus IS NULL`)
    }
    public async getWorkspaceStorage(area: string, workspaceKey: string): Promise<WorkspaceStorageRecord|null> {
        await this.ensureWorkspaceStorageSchema()
        return this._getOne<WorkspaceStorageRecord>(
            'workspaceStorage',
            `[area]=N'${this._escapeSql(area)}' AND [workspaceKey]=N'${this._escapeSql(workspaceKey)}'`
        )
    }
    public async saveWorkspaceStorage(area: string, workspaceKey: string, payloadJson: string, updatedBy: string = 'system'): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureWorkspaceStorageSchema()
                const sql = this.app.locals.sqlserver
                const escapedArea = this._escapeSql(area)
                const escapedKey = this._escapeSql(workspaceKey)
                const escapedPayload = this._escapeSql(payloadJson)
                const escapedUpdatedBy = this._escapeSql(updatedBy)
                await sql.query(`
                    MERGE dbo.workspaceStorage AS target
                    USING (SELECT N'${escapedArea}' AS [area], N'${escapedKey}' AS [workspaceKey]) AS source
                    ON target.[area] = source.[area] AND target.[workspaceKey] = source.[workspaceKey]
                    WHEN MATCHED THEN
                        UPDATE SET
                            [payloadJson] = N'${escapedPayload}',
                            [updateat] = GETDATE(),
                            [updateby] = N'${escapedUpdatedBy}'
                    WHEN NOT MATCHED THEN
                        INSERT ([workspaceStorageId], [area], [workspaceKey], [payloadJson], [createby], [updateby])
                        VALUES ('${randomUUID()}', N'${escapedArea}', N'${escapedKey}', N'${escapedPayload}', N'${escapedUpdatedBy}', N'${escapedUpdatedBy}');
                `)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async createCategory(input: Category): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureCategorySchema()
                const sql = this.app.locals.sqlserver
                const createBy = this._escapeSql(String(input.createby || 'system'))
                const updateBy = this._escapeSql(String(input.updateby || input.createby || 'system'))
                const result = await sql.query(`INSERT INTO categories(
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
                )`)
                this.app.locals.categories = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async updateCategory(input: Category): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureCategorySchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE categories
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
                    WHERE [categoryId]='${this._escapeSql(input.categoryId)}'`)
                this.app.locals.categories = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteCategory(categoryId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM categories WHERE [categoryId]='${this._escapeSql(categoryId)}'`)
                this.app.locals.categories = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getCategoryByHandle(handle: string): Promise<Category|null> {
        await this.ensureCategorySchema()
        return this._getOne<Category>('categories', `handle='${handle}'`)
    }
    public async getCategoryById(categoryId: string): Promise<Category|null> {
        await this.ensureCategorySchema()
        return this._getOne<Category>('categories', `[categoryId]='${this._escapeSql(categoryId)}'`)
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
                this.app.locals.materials = null
                this.app.locals.vwMaterials = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async updateDevice(input: Device): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE devices
                    SET [name]=N'${this._escapeSql(input.name)}',
                        [shortName]=N'${this._escapeSql(input.shortName || '')}',
                        [vendorId]='${this._escapeSql(input.vendorId)}',
                        [categoryId]='${this._escapeSql(input.categoryId)}',
                        [partNumber]=N'${this._escapeSql(input.partNumber)}',
                        [link]=N'${this._escapeSql(input.link || '')}',
                        [cost]=${Number(input.cost || 0)},
                        [defaultLabor]=${Number(input.defaultLabor || 0)},
                        [slcAddress]=N'${this._escapeSql(input.slcAddress || '')}',
                        [serialNumber]=N'${this._escapeSql(input.serialNumber || '')}',
                        [strobeAddress]=N'${this._escapeSql(input.strobeAddress || '')}',
                        [speakerAddress]=N'${this._escapeSql(input.speakerAddress || '')}',
                        [updateat]=GETDATE(),
                        [updateby]='system'
                    WHERE [deviceId]='${this._escapeSql(input.deviceId)}'`)
                this.app.locals.devices = null
                this.app.locals.vwDevices = null
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
    public async getMaterialByVendorAndPartNumber(vendorId: string, partNumber: string): Promise<Material|null> {
        return this._getOne<Material>('materials', `vendorId='${this._escapeSql(vendorId)}' AND partNumber='${this._escapeSql(partNumber)}'`)
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
                this.app.locals.devices = null
                this.app.locals.vwDevices = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async createDeviceSet(input: {
        name: string
        createdBy?: string
    }): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                const deviceSetId = randomUUID()
                const createdBy = this._escapeSql(input.createdBy || 'system')
                await sql.query(`INSERT INTO [deviceSets](
                    [deviceSetId], [name], [createat], [createby], [updateat], [updateby]
                ) VALUES (
                    '${this._escapeSql(deviceSetId)}',
                    N'${this._escapeSql(input.name)}',
                    GETDATE(),
                    '${createdBy}',
                    GETDATE(),
                    '${createdBy}'
                )`)
                this.app.locals.deviceSets = null
                return resolve(deviceSetId)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async updateDeviceSet(input: {
        deviceSetId: string
        name: string
        updatedBy?: string
    }): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE [deviceSets]
                    SET [name]=N'${this._escapeSql(input.name)}',
                        [updateat]=GETDATE(),
                        [updateby]='${this._escapeSql(input.updatedBy || 'system')}'
                    WHERE [deviceSetId]='${this._escapeSql(input.deviceSetId)}'`)
                this.app.locals.deviceSets = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteDeviceSet(deviceSetId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`)
                await sql.query(`DELETE FROM [deviceSets] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`)
                this.app.locals.deviceSets = null
                this.app.locals.deviceSetDevices = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async replaceDeviceSetDevices(deviceSetId: string, deviceIds: string[], createdBy?: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceSetId]='${this._escapeSql(deviceSetId)}'`)
                for (const deviceId of deviceIds) {
                    await sql.query(`INSERT INTO [deviceSetDevices](
                        [deviceSetDeviceId], [deviceSetId], [deviceId], [createat], [createby]
                    ) VALUES (
                        '${this._escapeSql(randomUUID())}',
                        '${this._escapeSql(deviceSetId)}',
                        '${this._escapeSql(deviceId)}',
                        GETDATE(),
                        '${this._escapeSql(createdBy || 'system')}'
                    )`)
                }
                this.app.locals.deviceSetDevices = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteDeviceSetDevicesByDeviceId(deviceId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [deviceSetDevices] WHERE [deviceId]='${this._escapeSql(deviceId)}'`)
                this.app.locals.deviceSetDevices = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteDevice(deviceId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [devices] WHERE [deviceId]='${this._escapeSql(deviceId)}'`)
                this.app.locals.devices = null
                this.app.locals.vwDevices = null
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
    public async getDeviceByVendorAndPartNumber(vendorId: string, partNumber: string): Promise<Device|null> {
        return this._getOne<Device>('devices', `vendorId='${this._escapeSql(vendorId)}' AND partNumber='${this._escapeSql(partNumber)}'`)
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
                this.app.locals.devicematerials = null
                this.app.locals.vwDeviceMaterials = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }
    public async deleteDeviceMaterialMapsByDeviceId(deviceId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [devicematerials] WHERE [deviceId]='${this._escapeSql(deviceId)}'`)
                this.app.locals.devicematerials = null
                this.app.locals.vwDeviceMaterials = null
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
        return this._getOne<DeviceMaterial>('devicematerials', `deviceId='${this._escapeSql(deviceId)}' AND materialId='${this._escapeSql(materialId)}'`)
    }
    public async getDeviceVendorLinkIgnores(): Promise<DeviceVendorLinkIgnore[]> {
        await this.ensureDeviceVendorLinkIgnoreSchema()
        return this._getMany<DeviceVendorLinkIgnore>('deviceVendorLinkIgnores')
    }
    public async createDeviceVendorLinkIgnore(input: {
        deviceId: string
        vendorId: string
        partNumber: string
        sourceKind: string
        reason?: string | null
        createdBy?: string
    }): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceVendorLinkIgnoreSchema()
                const sql = this.app.locals.sqlserver
                const existing = await this._getOne<DeviceVendorLinkIgnore>('deviceVendorLinkIgnores', `[deviceId]='${this._escapeSql(input.deviceId)}' AND [vendorId]='${this._escapeSql(input.vendorId)}' AND [partNumber]='${this._escapeSql(input.partNumber)}' AND [sourceKind]='${this._escapeSql(input.sourceKind)}'`)
                if (existing?.ignoreId) {
                    return resolve(existing.ignoreId)
                }
                const ignoreId = randomUUID()
                await sql.query(`INSERT INTO [deviceVendorLinkIgnores](
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
                )`)
                return resolve(ignoreId)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async removeDeviceVendorLinkIgnore(input: {
        deviceId: string
        vendorId: string
        partNumber: string
        sourceKind: string
    }): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceVendorLinkIgnoreSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [deviceVendorLinkIgnores]
                    WHERE [deviceId]='${this._escapeSql(input.deviceId)}'
                      AND [vendorId]='${this._escapeSql(input.vendorId)}'
                      AND [partNumber]='${this._escapeSql(input.partNumber)}'
                      AND [sourceKind]='${this._escapeSql(input.sourceKind)}'`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteDeviceVendorLinkIgnoresByDeviceId(deviceId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceVendorLinkIgnoreSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [deviceVendorLinkIgnores] WHERE [deviceId]='${this._escapeSql(deviceId)}'`)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getEddyProductByPartNumber(partNumber: string): Promise<Material|null> {
        return await this._getOne<Material>('EddyPriceList', `PartNumber='${partNumber}'`)
    }
    public async createMaterialAttribute(input: MaterialAttribute): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`INSERT INTO materialAttributes(
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
                )`)
                this.app.locals.materialAttributes = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteMaterialAttributesByMaterialId(materialId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [materialAttributes] WHERE [materialId]='${this._escapeSql(materialId)}'`)
                this.app.locals.materialAttributes = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async createMaterialSubTask(input: MaterialSubTask): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`INSERT INTO materialSubTasks(
                    [materialId], [statusName], [taskNameFormat], [laborHours], [ordinal], [projectId], [org]
                ) VALUES (
                    '${this._escapeSql(input.materialId)}',
                    N'${this._escapeSql(input.statusName)}',
                    ${input.taskNameFormat ? `N'${this._escapeSql(input.taskNameFormat)}'` : 'NULL'},
                    ${Number(input.laborHours || 0)},
                    ${Number(input.ordinal || 0)},
                    ${input.projectId ? `'${this._escapeSql(input.projectId)}'` : 'NULL'},
                    NULL
                )`)
                this.app.locals.materialSubTasks = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteMaterialSubTasksByMaterialId(materialId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [materialSubTasks] WHERE [materialId]='${this._escapeSql(materialId)}'`)
                this.app.locals.materialSubTasks = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async createVendorImportSnapshot(input: {
        vendorId: string
        targetTable: string
        fileName: string
        summaryJson: string
        rowsJson: string
        rowCount: number
        createdBy?: string
    }): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                const snapshotId = randomUUID()
                const createdBy = this._escapeSql(input.createdBy || 'system')
                await sql.query(`INSERT INTO [vendorImportSnapshots](
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
                )`)
                return resolve(snapshotId)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getVendorImportSnapshots(vendorId: string, targetTable?: string): Promise<VendorImportSnapshot[]> {
        await this.ensureVendorImportSchema()
        const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`]
        if (targetTable) {
            filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`)
        }
        return this._getMany<VendorImportSnapshot>('vendorImportSnapshots', filters.join(' AND '), '[createdAt] DESC')
    }
    public async getVendorImportSnapshot(snapshotId: string): Promise<VendorImportSnapshot|null> {
        await this.ensureVendorImportSchema()
        return this._getOne<VendorImportSnapshot>('vendorImportSnapshots', `[snapshotId]='${this._escapeSql(snapshotId)}'`)
    }
    public async createVendorImportRun(input: {
        vendorId: string
        targetTable: string
        fileName: string
        snapshotId?: string | null
        action: string
        rowCount: number
        createdBy?: string
        notesJson?: string | null
    }): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                const runId = randomUUID()
                await sql.query(`INSERT INTO [vendorImportRuns](
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
                )`)
                return resolve(runId)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getVendorImportRuns(vendorId: string, targetTable?: string): Promise<VendorImportRun[]> {
        await this.ensureVendorImportSchema()
        const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`]
        if (targetTable) {
            filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`)
        }
        return this._getMany<VendorImportRun>('vendorImportRuns', filters.join(' AND '), '[importedAt] DESC')
    }
    public async getLatestVendorImportRun(vendorId: string, targetTable?: string): Promise<VendorImportRun|null> {
        await this.ensureVendorImportSchema()
        const filters = [`[vendorId]='${this._escapeSql(vendorId)}'`]
        if (targetTable) {
            filters.push(`[targetTable]='${this._escapeSql(targetTable)}'`)
        }
        return this._getOne<VendorImportRun>('vendorImportRuns', filters.join(' AND '), '[importedAt] DESC')
    }
    public async replaceEddyPricelist(rows: EddyPricelist[]): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                const batches: string[] = []
                const chunkSize = 250
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const batch = rows.slice(i, i + chunkSize)
                    if (batch.length <= 0) {
                        continue
                    }
                    const values = batch.map((row) => `(
                        ${this._toSqlValue(row.ParentCategory)},
                        ${this._toSqlValue(row.Category)},
                        ${this._toSqlValue(row.PartNumber)},
                        ${this._toSqlValue(row.LongDescription)},
                        ${this._toSqlValue(row.MSRPPrice, 'number')},
                        ${this._toSqlValue(row.SalesPrice, 'number')},
                        ${this._toSqlValue(row.FuturePrice, 'number')},
                        ${this._toSqlValue(row.FutureEffectiveDate, 'date')},
                        ${this._toSqlValue(row.FutureSalesPrice, 'number')},
                        ${this._toSqlValue(row.FutureSalesEffectiveDate, 'date')},
                        ${this._toSqlValue(row.MinOrderQuantity, 'number')},
                        ${this._toSqlValue(row.ProductStatus)},
                        ${this._toSqlValue(row.Agency)},
                        ${this._toSqlValue(row.CountryOfOrigin)},
                        ${this._toSqlValue(row.UPC)}
                    )`).join(',\n')
                    batches.push(`INSERT INTO EddyPricelist(
                        ParentCategory, Category, PartNumber, LongDescription,
                        MSRPPrice, SalesPrice, FuturePrice, FutureEffectiveDate,
                        FutureSalesPrice, FutureSalesEffectiveDate, MinOrderQuantity,
                        ProductStatus, Agency, CountryOfOrigin, UPC
                    ) VALUES ${values}`)
                }

                const statements = [
                    'BEGIN TRANSACTION',
                    'TRUNCATE TABLE EddyPricelist',
                    ...batches,
                    'COMMIT TRANSACTION'
                ].join(';\n')

                await sql.query(statements)
                this.app.locals.EddyPricelist = null
                this.app.locals.VwEddyPricelist = null
                return resolve(true)
            } catch (err) {
                try {
                    const sql = this.app.locals.sqlserver
                    await sql.query(`IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION`)
                } catch {}
                console.error(err)
                return reject(err)
            }
        })
    }
    public async getDeviceResolutionStrategies(): Promise<DeviceResolutionStrategy[]> {
        return this._getMany<DeviceResolutionStrategy>('deviceResolutionStrategies')
    }

    public async ensureVendorImportSchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
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
        `)
    }
    public async ensureDeviceVendorLinkIgnoreSchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
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
        `)
    }
    public async ensureDeviceSetSchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
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
        `)
    }
    public async ensureCategorySchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
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
        `)
    }
    public async ensureWorkspaceStorageSchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
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
        `)
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
    private _escapeSql(value: string): string {
        return String(value || '').replace(/'/g, "''")
    }
    private _toSqlValue(value: unknown, type: 'string' | 'number' | 'date' = 'string'): string {
        if (value === null || typeof value === 'undefined' || value === '') {
            return 'NULL'
        }
        if (type === 'number') {
            const parsed = Number(value)
            return Number.isFinite(parsed) ? `${parsed}` : 'NULL'
        }
        if (type === 'date') {
            const normalized = this._normalizeDateValue(value)
            return normalized ? `'${this._escapeSql(normalized)}'` : 'NULL'
        }
        return `N'${this._escapeSql(String(value))}'`
    }
    private _normalizeDateValue(value: unknown): string | null {
        if (!value) {
            return null
        }
        if (value instanceof Date && !Number.isNaN(value.getTime())) {
            return value.toISOString().slice(0, 10)
        }
        const raw = String(value).trim()
        if (!raw) {
            return null
        }
        const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
        if (dateOnlyMatch) {
            return `${dateOnlyMatch[1]}-${dateOnlyMatch[2]}-${dateOnlyMatch[3]}`
        }
        const usMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
        if (usMatch) {
            const month = usMatch[1].padStart(2, '0')
            const day = usMatch[2].padStart(2, '0')
            return `${usMatch[3]}-${month}-${day}`
        }
        const parsed = new Date(raw)
        if (!Number.isNaN(parsed.getTime())) {
            return parsed.toISOString().slice(0, 10)
        }
        return null
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
