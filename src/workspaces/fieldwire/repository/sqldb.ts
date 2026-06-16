import * as express from 'express'
import * as mssql from 'mssql'
import { Device } from './device';
import { Category } from './category';
import { Vendor } from './vendor';
import { Material } from './material';
import { DeviceMaterial } from './devicematerial';
import { TestDevice } from './testdevice';
import { MaterialAttribute } from './materialattribute';
import { MaterialSubTask } from './materialsubtask';
import { DeviceResolutionStrategy } from './deviceResolutionStrategy';
import { DeviceAlias } from './devicealias';
import { VwDevice } from './vwdevice';
import { VwMaterial } from './vwmaterial';
import { VwDeviceMaterial } from './vwdevicematerial';
import { VwPart } from './vwpart';
import { Part } from './part';
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
        await this.ensureDeviceMaterialTextSchema()
        return this._getOne<VwDevice>('vwDevices', `deviceId='${deviceId}'`)
    }
    public async getVwDevices(): Promise<VwDevice[]> {
        await this.ensureDeviceMaterialTextSchema()
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
    public async getVendorByName(name: string): Promise<Vendor|null> {
        await this.ensureVendorImportSchema()
        return this._getOne<Vendor>('vendors', `[name]=N'${this._escapeSql(name)}'`)
    }
    public async createVendor(input: Partial<Vendor>): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureVendorImportSchema()
                const sql = this.app.locals.sqlserver
                const pool = await sql.init()
                const vendorId = input.vendorId || randomUUID()
                await pool.request()
                    .input('vendorId', mssql.NVarChar(40), vendorId)
                    .input('name', mssql.NVarChar(100), String(input.name || '').trim())
                    .input('desc', mssql.NVarChar(500), String(input.desc || '').trim())
                    .input('link', mssql.NVarChar(500), String(input.link || '').trim())
                    .input('importConfigJson', mssql.NVarChar(mssql.MAX), typeof input.importConfigJson === 'string' ? input.importConfigJson : null)
                    .query(`
                        INSERT INTO dbo.vendors([vendorId], [name], [desc], [link], [importConfigJson], [createby], [updateby])
                        VALUES(@vendorId, @name, @desc, @link, @importConfigJson, 'system', 'system')
                    `)
                this.app.locals.vendors = null
                return resolve(vendorId)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
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
    public async getParts(): Promise<VwPart[]> {
        await this.ensurePartsSchema()
        return this.normalizePartRows(await this._getMany<VwPart>('vwParts', `[productStatus] IS NULL OR [productStatus] = N''`, '[partNumber] ASC'))
    }
    public async getPartByPartNumber(partNumber: string): Promise<VwPart[]> {
        await this.ensurePartsSchema()
        return this.normalizePartRows(await this._getMany<VwPart>('vwParts', `[partNumber]=N'${this._escapeSql(partNumber)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`))
    }
    public async getPartsByVendor(vendorId: string): Promise<VwPart[]> {
        await this.ensurePartsSchema()
        return this.normalizePartRows(await this._getMany<VwPart>('vwParts', `[vendorId]='${this._escapeSql(vendorId)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`, '[partNumber] ASC'))
    }
    public async getPartByVendorAndPartNumber(vendorId: string, partNumber: string): Promise<VwPart[]> {
        await this.ensurePartsSchema()
        return this.normalizePartRows(await this._getMany<VwPart>('vwParts', `[vendorId]='${this._escapeSql(vendorId)}' AND [partNumber]=N'${this._escapeSql(partNumber)}' AND ([productStatus] IS NULL OR [productStatus] = N'')`))
    }
    public async getRawPartsByVendor(vendorId: string): Promise<Part[]> {
        await this.ensurePartsSchema()
        return this._getMany<Part>('parts', `[vendorId]='${this._escapeSql(vendorId)}'`, '[partNumber] ASC')
    }
    public async deletePartByVendorAndPartNumber(vendorId: string, partNumber: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensurePartsSchema()
                const sql = this.app.locals.sqlserver
                const pool = await sql.init()
                const result = await pool.request()
                    .input('vendorId', mssql.NVarChar(40), vendorId)
                    .input('partNumber', mssql.NVarChar(120), partNumber)
                    .query(`
                        DELETE FROM dbo.parts
                        WHERE vendorId = @vendorId
                            AND partNumber = @partNumber
                    `)
                this.app.locals.parts = null
                this.app.locals.vwParts = null
                const rowsAffected = Array.isArray(result.rowsAffected) ? Number(result.rowsAffected[0] || 0) : 0
                return resolve(rowsAffected > 0)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
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
                const pool = await sql.init()
                const request = pool.request()
                request.timeout = Math.max(Number(request.timeout || 0), 120000)
                await request
                    .input('workspaceStorageId', mssql.UniqueIdentifier, randomUUID())
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
                `)
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async deleteWorkspaceStorage(area: string, workspaceKey: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureWorkspaceStorageSchema()
                const sql = this.app.locals.sqlserver
                const pool = await sql.init()
                await pool.request()
                    .input('area', mssql.NVarChar(100), area)
                    .input('workspaceKey', mssql.NVarChar(200), workspaceKey)
                    .query(`
                    DELETE FROM dbo.workspaceStorage
                    WHERE [area] = @area AND [workspaceKey] = @workspaceKey;
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
                await this.ensureDeviceMaterialTextSchema()
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO materials(
                    name, shortName, vendorId, categoryName,
                    partNumber, link, msrp, cost, defaultLabor,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    ${this._toSqlValue(this._truncateSqlString(input.name, 500))}, ${this._toSqlValue(this._truncateSqlString(input.shortName || '', 200))}, '${this._escapeSql(input.vendorId)}', ${this._toSqlValue(this._truncateSqlString(input.categoryName || '', 500))},
                    ${this._toSqlValue(this._truncateSqlString(input.partNumber, 120))}, ${this._toSqlValue(this._truncateSqlString(input.link || '', 1000))}, ${this._toSqlValue(input.msrp ?? null, 'number')}, ${Number(input.cost || 0)}, ${Number(input.defaultLabor || 0)},
                    ${this._toSqlValue(this._truncateSqlString(input.slcAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.serialNumber || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.strobeAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.speakerAddress || '', 100))}
                )`)
                this.app.locals.materials = null
                this.app.locals.vwMaterials = null
                this.app.locals.vwDeviceMaterials = null
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
                await this.ensureDeviceMaterialTextSchema()
                const sql = this.app.locals.sqlserver
                await sql.query(`UPDATE devices
                    SET [name]=N'${this._escapeSql(this._truncateSqlString(input.name, 500))}',
                        [shortName]=N'${this._escapeSql(this._truncateSqlString(input.shortName || '', 200))}',
                        [vendorId]='${this._escapeSql(input.vendorId)}',
                        [categoryName]=N'${this._escapeSql(this._truncateSqlString(input.categoryName || '', 500))}',
                        [includeOnFloorplan]=${input.includeOnFloorplan ? 1 : 0},
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
    public async getDeviceMaterialMapCountByMaterialId(materialId: string): Promise<number> {
        const sql = this.app.locals.sqlserver
        const pool = await sql.init()
        const result = await pool.request()
            .input('materialId', mssql.NVarChar(50), materialId)
            .query('SELECT COUNT(1) AS mapCount FROM dbo.devicematerials WHERE materialId = @materialId')
        return Number((result.recordset || [])[0]?.mapCount || 0)
    }
    public async isDeviceOrMaterialReferencedByProjectWorksheet(input: {
        deviceId?: string | null
        partNumbers?: string[]
    }): Promise<boolean> {
        const needles = Array.from(new Set([
            String(input.deviceId || '').trim(),
            ...(Array.isArray(input.partNumbers) ? input.partNumbers : [])
        ].map((value) => String(value || '').trim()).filter(Boolean)))

        if (needles.length <= 0) {
            return false
        }

        const sql = this.app.locals.sqlserver
        const pool = await sql.init()
        const request = pool.request()
        const clauses = needles.map((needle, index) => {
            const parameterName = `needle${index}`
            request.input(parameterName, mssql.NVarChar(300), `%${this._escapeSqlLike(needle)}%`)
            return `worksheetJson LIKE @${parameterName} ESCAPE N'~'`
        })

        const result = await request.query(`
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
        `)
        return Number((result.recordset || [])[0]?.referenceCount || 0) > 0
    }
    public async deleteMaterial(materialId: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const sql = this.app.locals.sqlserver
                await sql.query(`DELETE FROM [materials] WHERE [materialId]='${this._escapeSql(materialId)}'`)
                this.app.locals.materials = null
                this.app.locals.vwMaterials = null
                this.app.locals.vwDeviceMaterials = null
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async createDevice(input: Device): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceMaterialTextSchema()
                const sql = this.app.locals.sqlserver
                const result = await sql.query(`INSERT INTO devices(
                    name, shortName, vendorId, categoryName, includeOnFloorplan,
                    partNumber, link, cost, defaultLabor, laborRate,
                    slcAddress, serialNumber, strobeAddress, speakerAddress
                )
                VALUES(
                    ${this._toSqlValue(this._truncateSqlString(input.name, 500))}, ${this._toSqlValue(this._truncateSqlString(input.shortName || '', 200))}, '${this._escapeSql(input.vendorId)}', ${this._toSqlValue(this._truncateSqlString(input.categoryName || '', 500))}, ${input.includeOnFloorplan ? 1 : 0},
                    ${this._toSqlValue(this._truncateSqlString(input.partNumber, 120))}, ${this._toSqlValue(this._truncateSqlString(input.link || '', 1000))}, ${Number(input.cost || 0)}, ${Number(input.defaultLabor || 0)}, ${Number(input.laborRate || 56)},
                    ${this._toSqlValue(this._truncateSqlString(input.slcAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.serialNumber || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.strobeAddress || '', 100))}, ${this._toSqlValue(this._truncateSqlString(input.speakerAddress || '', 100))}
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
        visibility?: string[]
        ownerUserId?: string
        createdBy?: string
    }): Promise<string> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                const deviceSetId = randomUUID()
                const createdBy = this._escapeSql(input.createdBy || 'system')
                const visibilityJson = this._escapeSql(JSON.stringify(Array.isArray(input.visibility) ? input.visibility : []))
                const ownerUserId = this._escapeSql(input.ownerUserId || '')
                await sql.query(`INSERT INTO [deviceSets](
                    [deviceSetId], [name], [visibilityJson], [ownerUserId], [createat], [createby], [updateat], [updateby]
                ) VALUES (
                    '${this._escapeSql(deviceSetId)}',
                    N'${this._escapeSql(input.name)}',
                    N'${visibilityJson}',
                    N'${ownerUserId}',
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
        visibility?: string[]
        ownerUserId?: string
        updatedBy?: string
    }): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensureDeviceSetSchema()
                const sql = this.app.locals.sqlserver
                const assignments = [
                    `[name]=N'${this._escapeSql(input.name)}'`
                ]
                if (Array.isArray(input.visibility)) {
                    assignments.push(`[visibilityJson]=N'${this._escapeSql(JSON.stringify(input.visibility))}'`)
                }
                if (input.ownerUserId !== undefined) {
                    assignments.push(`[ownerUserId]=N'${this._escapeSql(input.ownerUserId || '')}'`)
                }
                assignments.push('[updateat]=GETDATE()')
                assignments.push(`[updateby]='${this._escapeSql(input.updatedBy || 'system')}'`)
                await sql.query(`UPDATE [deviceSets]
                    SET ${assignments.join(',\n                        ')}
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
                    '${this._escapeSql(deviceId)}', '${this._escapeSql(materialId)}'
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
        return this._getMany<VwDeviceMaterial>('vwDeviceMaterials', `deviceId='${this._escapeSql(deviceId)}'`)
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
    public async replacePartsForVendor(vendorId: string, rows: Part[]): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                await this.ensurePartsSchema()
                const sql = this.app.locals.sqlserver
                const batches: string[] = []
                const chunkSize = 150
                for (let i = 0; i < rows.length; i += chunkSize) {
                    const batch = rows.slice(i, i + chunkSize)
                    if (batch.length <= 0) {
                        continue
                    }
                    const values = batch.map((row) => `(
                        ${this._toSqlValue(vendorId)},
                        ${this._toSqlValue(row.sourceVendorName)},
                        ${this._toSqlValue(row.brand)},
                        ${this._toSqlValue(row.parentCategory || row.ParentCategory || '')},
                        ${this._toSqlValue(row.category || row.Category || '')},
                        ${this._toSqlValue(row.partNumber || row.PartNumber || '')},
                        ${this._toSqlValue(row.description || row.LongDescription || '')},
                        ${this._toSqlValue(row.msrp ?? row.MSRPPrice, 'number')},
                        ${this._toSqlValue(row.cost ?? row.SalesPrice ?? row.MSRPPrice, 'number')},
                        ${this._toSqlValue(row.minQty ?? row.MinOrderQuantity, 'number')},
                        ${this._toSqlValue(row.productStatus || row.ProductStatus || '')},
                        ${this._toSqlValue(row.agency || row.Agency || '')},
                        ${this._toSqlValue(row.countryOfOrigin || row.CountryOfOrigin || '')},
                        ${this._toSqlValue(row.upc || row.UPC || '')},
                        ${this._toSqlValue(row.rawJson || row.RawJson || null)}
                    )`).join(',\n')
                    batches.push(`INSERT INTO dbo.parts(
                        vendorId, sourceVendorName, brand, parentCategory, category, partNumber,
                        description, msrp, cost, minQty, productStatus, agency, countryOfOrigin,
                        upc, rawJson
                    ) VALUES ${values}`)
                }

                const statements = [
                    'BEGIN TRANSACTION',
                    `DELETE FROM dbo.parts WHERE vendorId=N'${this._escapeSql(vendorId)}'`,
                    ...batches,
                    'COMMIT TRANSACTION'
                ].join(';\n')

                await sql.query(statements)
                this.app.locals.parts = null
                this.app.locals.vwParts = null
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

    public async ensurePartsSchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await this.ensureVendorImportSchema()
        await sql.query(`
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
        `)
    }

    private normalizePartRows(rows: VwPart[]): VwPart[] {
        return rows.map((row: VwPart | any) => ({
            ...row,
            ParentCategory: row.ParentCategory ?? row.parentCategory ?? '',
            Category: row.Category ?? row.category ?? '',
            PartNumber: row.PartNumber ?? row.partNumber ?? '',
            LongDescription: row.LongDescription ?? row.description ?? '',
            MSRPPrice: Number(row.MSRPPrice ?? row.msrp ?? 0),
            SalesPrice: Number(row.SalesPrice ?? row.cost ?? 0),
            FuturePrice: row.FuturePrice ?? null,
            FutureEffectiveDate: row.FutureEffectiveDate ?? null,
            FutureSalesPrice: row.FutureSalesPrice ?? null,
            FutureSalesEffectiveDate: row.FutureSalesEffectiveDate ?? null,
            MinOrderQuantity: Number(row.MinOrderQuantity ?? row.minQty ?? 0),
            ProductStatus: row.ProductStatus ?? row.productStatus ?? null,
            Agency: row.Agency ?? row.agency ?? null,
            CountryOfOrigin: row.CountryOfOrigin ?? row.countryOfOrigin ?? null,
            UPC: row.UPC ?? row.upc ?? '',
            ProductID: row.ProductID ?? row.partId,
            PrimaryImage: row.PrimaryImage ?? null,
            QuantityAvailable: row.QuantityAvailable ?? null
        }))
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
                    [visibilityJson] NVARCHAR(MAX) NULL,
                    [ownerUserId] NVARCHAR(256) NULL,
                    [createat] DATETIME NOT NULL CONSTRAINT [DF_deviceSets_createat_runtime] DEFAULT (GETDATE()),
                    [createby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceSets_createby_runtime] DEFAULT ('system'),
                    [updateat] DATETIME NOT NULL CONSTRAINT [DF_deviceSets_updateat_runtime] DEFAULT (GETDATE()),
                    [updateby] NVARCHAR(40) NOT NULL CONSTRAINT [DF_deviceSets_updateby_runtime] DEFAULT ('system')
                )
            END

            IF OBJECT_ID('dbo.deviceSets', 'U') IS NOT NULL AND COL_LENGTH('dbo.deviceSets', 'visibilityJson') IS NULL
            BEGIN
                ALTER TABLE dbo.deviceSets ADD [visibilityJson] NVARCHAR(MAX) NULL
            END

            IF OBJECT_ID('dbo.deviceSets', 'U') IS NOT NULL AND COL_LENGTH('dbo.deviceSets', 'ownerUserId') IS NULL
            BEGIN
                ALTER TABLE dbo.deviceSets ADD [ownerUserId] NVARCHAR(256) NULL
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
    public async ensureDeviceMaterialTextSchema(): Promise<void> {
        if (this.app.locals.deviceMaterialTextSchemaEnsured) {
            return
        }

        const sql = this.app.locals.sqlserver
        await sql.query(`
            IF OBJECT_ID('dbo.devices', 'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('dbo.devices', 'laborRate') IS NULL
                BEGIN
                    ALTER TABLE dbo.devices ADD [laborRate] DECIMAL(18, 2) NOT NULL CONSTRAINT [DF_devices_laborRate_runtime] DEFAULT ((56))
                END
                IF COL_LENGTH('dbo.devices', 'categoryName') IS NULL
                BEGIN
                    ALTER TABLE dbo.devices ADD [categoryName] NVARCHAR(500) NULL
                END
                IF COL_LENGTH('dbo.devices', 'includeOnFloorplan') IS NULL
                BEGIN
                    ALTER TABLE dbo.devices ADD [includeOnFloorplan] BIT NOT NULL CONSTRAINT [DF_devices_includeOnFloorplan_runtime] DEFAULT ((0))
                END
                IF COL_LENGTH('dbo.devices', 'categoryId') IS NOT NULL AND OBJECT_ID('dbo.categories', 'U') IS NOT NULL
                BEGIN
                    EXEC(N'UPDATE dbo.devices
                        SET categoryName = COALESCE(NULLIF(dbo.devices.categoryName, ''''), dbo.categories.shortName, dbo.categories.name)
                        FROM dbo.devices
                        INNER JOIN dbo.categories ON dbo.devices.categoryId = dbo.categories.categoryId
                        WHERE NULLIF(dbo.devices.categoryName, '''') IS NULL')
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
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.devices') AND name = 'categoryId' AND is_nullable = 0)
                    ALTER TABLE dbo.devices ALTER COLUMN [categoryId] NVARCHAR(40) NULL
            END

            IF OBJECT_ID('dbo.materials', 'U') IS NOT NULL
            BEGIN
                IF COL_LENGTH('dbo.materials', 'msrp') IS NULL
                    ALTER TABLE dbo.materials ADD [msrp] MONEY NULL
                IF COL_LENGTH('dbo.materials', 'categoryName') IS NULL
                    ALTER TABLE dbo.materials ADD [categoryName] NVARCHAR(500) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'name' AND max_length < 1000)
                    ALTER TABLE dbo.materials ALTER COLUMN [name] NVARCHAR(500) NOT NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'shortName' AND max_length < 400)
                    ALTER TABLE dbo.materials ALTER COLUMN [shortName] NVARCHAR(200) NULL
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'categoryName' AND max_length < 1000)
                    ALTER TABLE dbo.materials ALTER COLUMN [categoryName] NVARCHAR(500) NULL
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
                IF EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.materials') AND name = 'categoryId' AND is_nullable = 0)
                    ALTER TABLE dbo.materials ALTER COLUMN [categoryId] NVARCHAR(40) NULL

                IF OBJECT_ID('dbo.parts', 'U') IS NOT NULL
                BEGIN
                    EXEC(N'UPDATE m
                        SET m.msrp = COALESCE(m.msrp, p.msrp),
                            m.categoryName = COALESCE(NULLIF(m.categoryName, ''''), p.category),
                            m.name = CASE
                                WHEN NULLIF(p.description, '''') IS NOT NULL
                                    AND (NULLIF(m.name, '''') IS NULL OR m.name = m.partNumber OR m.name = m.shortName)
                                    THEN p.description
                                ELSE m.name
                            END
                        FROM dbo.materials m
                        INNER JOIN dbo.parts p ON m.vendorId = p.vendorId
                            AND m.partNumber = p.partNumber
                        WHERE (m.msrp IS NULL AND p.msrp IS NOT NULL)
                            OR (NULLIF(m.categoryName, '''') IS NULL AND NULLIF(p.category, '''') IS NOT NULL)
                            OR (NULLIF(p.description, '''') IS NOT NULL
                                AND (NULLIF(m.name, '''') IS NULL OR m.name = m.partNumber OR m.name = m.shortName))')
                END
            END
        `)
        await sql.query(`
            EXEC(N'CREATE OR ALTER VIEW [dbo].[vwDevices]
                AS
                SELECT dbo.devices.deviceId, dbo.devices.name, dbo.devices.shortName, dbo.devices.categoryName, dbo.devices.includeOnFloorplan, dbo.devices.vendorId, dbo.vendors.name AS vendorName, dbo.devices.partNumber, dbo.devices.cost,
                    dbo.devices.defaultLabor, dbo.devices.laborRate, dbo.devices.slcAddress, dbo.devices.serialNumber, dbo.devices.strobeAddress, dbo.devices.speakerAddress, dbo.devices.createat, dbo.devices.createby, dbo.devices.updateat, dbo.devices.updateby,
                    ISNULL(attributeCounts.attributeCount, 0) AS attributeCount,
                    ISNULL(subTaskCounts.subTaskCount, 0) AS subTaskCount
                FROM dbo.devices INNER JOIN
                    dbo.vendors ON dbo.devices.vendorId = dbo.vendors.vendorId LEFT OUTER JOIN
                    (SELECT materialId, COUNT(*) AS attributeCount FROM dbo.materialAttributes GROUP BY materialId) AS attributeCounts ON dbo.devices.deviceId = attributeCounts.materialId LEFT OUTER JOIN
                    (SELECT materialId, COUNT(*) AS subTaskCount FROM dbo.materialSubTasks GROUP BY materialId) AS subTaskCounts ON dbo.devices.deviceId = subTaskCounts.materialId')

            EXEC(N'CREATE OR ALTER VIEW [dbo].[vwMaterials]
                AS
                SELECT dbo.materials.*, dbo.vendors.name AS vendorName
                FROM dbo.materials INNER JOIN
                    dbo.vendors ON dbo.materials.vendorId = dbo.vendors.vendorId')

            EXEC(N'CREATE OR ALTER VIEW [dbo].[vwDeviceMaterials]
                AS
                SELECT dbo.devices.deviceId,
                    dbo.devices.name AS deviceName,
                    dbo.devices.shortName AS deviceShortName,
                    dbo.devices.partNumber,
                    dbo.devices.link,
                    dbo.devices.cost,
                    dbo.devices.defaultLabor,
                    dbo.vendors.name AS org,
                    dbo.materials.materialId,
                    dbo.materials.name AS materialName,
                    dbo.materials.shortName AS materialShortName,
                    dbo.materials.categoryName AS materialCategoryName,
                    dbo.materials.partNumber AS materialPartNumber,
                    dbo.materials.link AS materialLink,
                    dbo.materials.msrp AS materialMsrp,
                    dbo.materials.cost AS materialCost,
                    dbo.materials.defaultLabor AS materialDefaultLabor,
                    dbo.devices.categoryName AS deviceCategoryName,
                    dbo.devices.categoryName AS deviceCategoryShortName
                FROM dbo.devicematerials INNER JOIN
                    dbo.devices ON dbo.devicematerials.deviceId = dbo.devices.deviceId INNER JOIN
                    dbo.materials ON dbo.devicematerials.materialId = dbo.materials.materialId INNER JOIN
                    dbo.vendors ON dbo.devices.vendorId = dbo.vendors.vendorId')
        `)
        this.app.locals.deviceMaterialTextSchemaEnsured = true
    }
    public async ensureCategorySchema(): Promise<void> {
        const sql = this.app.locals.sqlserver
        await sql.query(`
            IF OBJECT_ID('dbo.categories', 'U') IS NULL
                RETURN

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
    private _escapeSqlLike(value: string): string {
        return String(value || '')
            .replace(/~/g, '~~')
            .replace(/%/g, '~%')
            .replace(/_/g, '~_')
            .replace(/\[/g, '[[]')
    }
    private _truncateSqlString(value: unknown, maxLength: number): string {
        const text = String(value || '')
        return text.length > maxLength ? text.slice(0, maxLength) : text
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
