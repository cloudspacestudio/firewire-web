import * as express from 'express'
import * as mssql from 'mssql'
import { v4 as uuidv4, validate as validateUuid } from 'uuid'
import { MsSqlServerDb } from '../../../core/databases/mssqldb'

export type FirewireProjectSettingListKey = 'jobType' | 'scopeType' | 'projectScope' | 'difficulty' | 'projectStatus'

export interface FirewireProjectSettingRecord {
    uuid: string
    listKey: FirewireProjectSettingListKey
    label: string
    description: string
    sortOrder: number
    isActive: boolean
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
}

export interface FirewireProjectSettingInput {
    listKey: FirewireProjectSettingListKey
    label: string
    description?: string | null
    sortOrder?: number | null
    isActive?: boolean | null
}

type SqlProjectSettingRow = {
    uuid: string
    listKey: FirewireProjectSettingListKey
    label: string
    description: string
    sortOrder: number
    isActive: boolean
    createdAt: Date | string
    createdBy: string
    updatedAt: Date | string
    updatedBy: string
}

const DEFAULT_SETTINGS: Array<Pick<FirewireProjectSettingRecord, 'listKey' | 'label' | 'description' | 'sortOrder'>> = [
    { listKey: 'jobType', label: 'Assembly', description: '', sortOrder: 10 },
    { listKey: 'jobType', label: 'High-Rise', description: '', sortOrder: 20 },
    { listKey: 'jobType', label: 'Educational', description: '', sortOrder: 30 },
    { listKey: 'jobType', label: 'Day-Care', description: '', sortOrder: 40 },
    { listKey: 'jobType', label: 'Health-Care', description: '', sortOrder: 50 },
    { listKey: 'jobType', label: 'Ambulatory', description: '', sortOrder: 60 },
    { listKey: 'jobType', label: 'Detention & Correctional', description: '', sortOrder: 70 },
    { listKey: 'jobType', label: 'One & Two Family Dwelling', description: '', sortOrder: 80 },
    { listKey: 'jobType', label: 'Lodging or Rooming Houses', description: '', sortOrder: 90 },
    { listKey: 'jobType', label: 'Hotel & Dormitories', description: '', sortOrder: 100 },
    { listKey: 'jobType', label: 'Apartment Buildings', description: '', sortOrder: 110 },
    { listKey: 'jobType', label: 'Residential Board & Care', description: '', sortOrder: 120 },
    { listKey: 'jobType', label: 'Mercantile', description: '', sortOrder: 130 },
    { listKey: 'jobType', label: 'Business', description: '', sortOrder: 140 },
    { listKey: 'jobType', label: 'Industrial', description: '', sortOrder: 150 },
    { listKey: 'jobType', label: 'Storage', description: '', sortOrder: 160 },
    { listKey: 'jobType', label: 'Supermarket', description: '', sortOrder: 170 },
    { listKey: 'jobType', label: 'Hangar', description: '', sortOrder: 180 },
    { listKey: 'jobType', label: 'Mall', description: '', sortOrder: 190 },
    { listKey: 'jobType', label: 'Shopping Center', description: '', sortOrder: 200 },
    { listKey: 'scopeType', label: 'New', description: '', sortOrder: 10 },
    { listKey: 'scopeType', label: 'Retro-Fit', description: '', sortOrder: 20 },
    { listKey: 'scopeType', label: 'Network Add', description: '', sortOrder: 30 },
    { listKey: 'scopeType', label: 'Add to Existing', description: '', sortOrder: 40 },
    { listKey: 'scopeType', label: 'Change Order', description: '', sortOrder: 50 },
    { listKey: 'projectScope', label: 'Turnkey', description: '', sortOrder: 10 },
    { listKey: 'projectScope', label: 'Smarts & Parts', description: '', sortOrder: 20 },
    { listKey: 'projectStatus', label: 'Estimation', description: '', sortOrder: 10 },
    { listKey: 'projectStatus', label: 'Proposal', description: '', sortOrder: 20 },
    { listKey: 'projectStatus', label: 'Booking', description: '', sortOrder: 30 },
    { listKey: 'projectStatus', label: 'Design', description: '', sortOrder: 40 },
    { listKey: 'projectStatus', label: 'Install', description: '', sortOrder: 50 },
    { listKey: 'projectStatus', label: 'Service', description: '', sortOrder: 60 },
    { listKey: 'projectStatus', label: 'Closed', description: '', sortOrder: 70 },
    {
        listKey: 'difficulty',
        label: 'Level 1',
        description: 'New construction easy install or smarts & parts. Complete access, minimal heights, minimal mobilization.',
        sortOrder: 10
    },
    {
        listKey: 'difficulty',
        label: 'Level 2',
        description: 'Retrofit, multiple mobilization or phasing, working heights.',
        sortOrder: 20
    },
    {
        listKey: 'difficulty',
        label: 'Level 3',
        description: 'Complete retrofit with limited access, historic, GSA/GOV/COE.',
        sortOrder: 30
    }
]

export class FirewireProjectSettingsRepository {
    constructor(private app: express.Application) {}

    async listAll(): Promise<Record<FirewireProjectSettingListKey, FirewireProjectSettingRecord[]>> {
        await this.ensureTable()
        const pool = await this.getPool()
        const query = [
            'SELECT',
            '    uuid,',
            '    listKey,',
            '    label,',
            '    description,',
            '    sortOrder,',
            '    isActive,',
            '    createdAt,',
            '    createdBy,',
            '    updatedAt,',
            '    updatedBy',
            'FROM dbo.firewireProjectSettings',
            'ORDER BY listKey ASC, sortOrder ASC, label ASC;'
        ].join('\n')
        const result = await pool.request().query(query)
        const rows = (result.recordset || []).map((row) => this.mapSqlRow(row))
        return {
            jobType: rows.filter((row) => row.listKey === 'jobType'),
            scopeType: rows.filter((row) => row.listKey === 'scopeType'),
            projectScope: rows.filter((row) => row.listKey === 'projectScope'),
            difficulty: rows.filter((row) => row.listKey === 'difficulty'),
            projectStatus: rows.filter((row) => row.listKey === 'projectStatus')
        }
    }

    async create(input: FirewireProjectSettingInput, userId: string): Promise<FirewireProjectSettingRecord> {
        await this.ensureTable()
        const normalized = this.normalizeInput(input, false)
        const uuid = uuidv4()
        const pool = await this.getPool()
        const query = [
            'INSERT INTO dbo.firewireProjectSettings (',
            '    uuid, listKey, label, description, sortOrder, isActive, createdBy, updatedBy',
            ') VALUES (',
            '    @uuid, @listKey, @label, @description, @sortOrder, @isActive, @createdBy, @updatedBy',
            ');'
        ].join('\n')
        await pool.request()
            .input('uuid', mssql.UniqueIdentifier, uuid)
            .input('listKey', mssql.NVarChar(50), normalized.listKey)
            .input('label', mssql.NVarChar(200), normalized.label)
            .input('description', mssql.NVarChar(1000), normalized.description)
            .input('sortOrder', mssql.Int, normalized.sortOrder)
            .input('isActive', mssql.Bit, normalized.isActive)
            .input('createdBy', mssql.NVarChar(256), userId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)
        const created = await this.getById(uuid)
        if (!created) {
            throw new Error('Created setting could not be reloaded.')
        }
        return created
    }

    async update(settingId: string, input: FirewireProjectSettingInput, userId: string): Promise<FirewireProjectSettingRecord | null> {
        await this.ensureTable()
        if (!validateUuid(settingId)) {
            return null
        }
        const normalized = this.normalizeInput(input, true)
        const pool = await this.getPool()
        const query = [
            'UPDATE dbo.firewireProjectSettings',
            'SET',
            '    listKey = @listKey,',
            '    label = @label,',
            '    description = @description,',
            '    sortOrder = @sortOrder,',
            '    isActive = @isActive,',
            '    updatedAt = SYSUTCDATETIME(),',
            '    updatedBy = @updatedBy',
            'WHERE uuid = @uuid;'
        ].join('\n')
        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, settingId)
            .input('listKey', mssql.NVarChar(50), normalized.listKey)
            .input('label', mssql.NVarChar(200), normalized.label)
            .input('description', mssql.NVarChar(1000), normalized.description)
            .input('sortOrder', mssql.Int, normalized.sortOrder)
            .input('isActive', mssql.Bit, normalized.isActive)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)
        if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
            return null
        }
        return this.getById(settingId)
    }

    async remove(settingId: string): Promise<boolean> {
        await this.ensureTable()
        if (!validateUuid(settingId)) {
            return false
        }
        const pool = await this.getPool()
        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, settingId)
            .query('DELETE FROM dbo.firewireProjectSettings WHERE uuid = @uuid;')
        return !!result.rowsAffected && result.rowsAffected[0] > 0
    }

    async ensureTable(): Promise<void> {
        const pool = await this.getPool()
        const createQuery = [
            "IF OBJECT_ID(N'dbo.firewireProjectSettings', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireProjectSettings (',
            '        uuid UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjectSettings PRIMARY KEY,',
            '        listKey NVARCHAR(50) NOT NULL,',
            '        label NVARCHAR(200) NOT NULL,',
            "        description NVARCHAR(1000) NOT NULL CONSTRAINT DF_firewireProjectSettings_description DEFAULT N'',",
            '        sortOrder INT NOT NULL CONSTRAINT DF_firewireProjectSettings_sortOrder DEFAULT 0,',
            '        isActive BIT NOT NULL CONSTRAINT DF_firewireProjectSettings_isActive DEFAULT 1,',
            '        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectSettings_createdAt DEFAULT SYSUTCDATETIME(),',
            '        createdBy NVARCHAR(256) NOT NULL,',
            '        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectSettings_updatedAt DEFAULT SYSUTCDATETIME(),',
            '        updatedBy NVARCHAR(256) NOT NULL',
            '    );',
            '    CREATE UNIQUE INDEX UX_firewireProjectSettings_list_label ON dbo.firewireProjectSettings(listKey, label);',
            'END;'
        ].join('\n')
        await pool.request().batch(createQuery)
        for (const item of DEFAULT_SETTINGS) {
            const seedQuery = [
                'IF NOT EXISTS (',
                '    SELECT 1 FROM dbo.firewireProjectSettings WHERE listKey = @listKey AND label = @label',
                ')',
                'BEGIN',
                '    INSERT INTO dbo.firewireProjectSettings (uuid, listKey, label, description, sortOrder, isActive, createdBy, updatedBy)',
                '    VALUES (@uuid, @listKey, @label, @description, @sortOrder, 1, @createdBy, @updatedBy);',
                'END;'
            ].join('\n')
            await pool.request()
                .input('uuid', mssql.UniqueIdentifier, uuidv4())
                .input('listKey', mssql.NVarChar(50), item.listKey)
                .input('label', mssql.NVarChar(200), item.label)
                .input('description', mssql.NVarChar(1000), item.description)
                .input('sortOrder', mssql.Int, item.sortOrder)
                .input('createdBy', mssql.NVarChar(256), 'system')
                .input('updatedBy', mssql.NVarChar(256), 'system')
                .query(seedQuery)
        }
    }

    private async getById(settingId: string): Promise<FirewireProjectSettingRecord | null> {
        const pool = await this.getPool()
        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, settingId)
            .query([
                'SELECT',
                '    uuid, listKey, label, description, sortOrder, isActive, createdAt, createdBy, updatedAt, updatedBy',
                'FROM dbo.firewireProjectSettings',
                'WHERE uuid = @uuid;'
            ].join('\n'))
        const row = (result.recordset || [])[0]
        return row ? this.mapSqlRow(row) : null
    }

    private async getPool(): Promise<mssql.ConnectionPool> {
        const sql = this.app.locals.sqlserver as MsSqlServerDb
        if (!sql) {
            throw new Error('Missing sqlserver app local.')
        }
        return sql.init()
    }

    private normalizeInput(input: FirewireProjectSettingInput, allowInactiveDefault: boolean): FirewireProjectSettingInput & { description: string; sortOrder: number; isActive: boolean } {
        const listKey = this.normalizeListKey(input?.listKey)
        const label = this.requireString(input?.label, 'label', 200)
        const description = this.optionalString(input?.description, 1000)
        const sortOrder = this.normalizeSortOrder(input?.sortOrder)
        const isActive = typeof input?.isActive === 'boolean' ? input.isActive : allowInactiveDefault ? true : true
        return {
            listKey,
            label,
            description,
            sortOrder,
            isActive
        }
    }

    private normalizeListKey(input: unknown): FirewireProjectSettingListKey {
        if (input === 'jobType' || input === 'scopeType' || input === 'projectScope' || input === 'difficulty' || input === 'projectStatus') {
            return input
        }
        throw new Error('Invalid listKey value.')
    }

    private normalizeSortOrder(input: unknown): number {
        const value = Number(input)
        if (!Number.isFinite(value)) {
            return 0
        }
        return Math.trunc(value)
    }

    private requireString(input: unknown, fieldName: string, maxLength: number): string {
        const value = this.optionalString(input, maxLength)
        if (!value) {
            throw new Error('Missing ' + fieldName + '.')
        }
        return value
    }

    private optionalString(input: unknown, maxLength: number): string {
        if (typeof input !== 'string') {
            return ''
        }
        return input.trim().slice(0, maxLength)
    }

    private mapSqlRow(row: SqlProjectSettingRow): FirewireProjectSettingRecord {
        return {
            uuid: row.uuid,
            listKey: row.listKey,
            label: row.label,
            description: row.description || '',
            sortOrder: Number(row.sortOrder || 0),
            isActive: !!row.isActive,
            createdAt: this.toIso(row.createdAt) || '',
            createdBy: row.createdBy,
            updatedAt: this.toIso(row.updatedAt) || '',
            updatedBy: row.updatedBy
        }
    }

    private toIso(input: unknown): string | null {
        if (!input) {
            return null
        }
        const value = input instanceof Date ? input : new Date(String(input))
        if (Number.isNaN(value.getTime())) {
            return null
        }
        return value.toISOString()
    }
}
