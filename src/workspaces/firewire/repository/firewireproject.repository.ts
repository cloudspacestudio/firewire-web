import * as express from 'express'
import * as mssql from 'mssql'
import { v4 as uuidv4, validate as validateUuid } from 'uuid'
import { MsSqlServerDb } from '../../../core/databases/mssqldb'
import { FieldwireSDK } from '../../fieldwire/fieldwire'

export type ProjectSource = 'fieldwire' | 'firewire' | 'both'

export interface FirewireProjectRecord {
    uuid: string
    fieldwireId: string | null
    name: string
    projectNbr: string
    address: string
    bidDueDate: string
    projectStatus: string
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
}

export interface FirewireProjectInput {
    fieldwireId?: string | null
    name: string
    projectNbr: string
    address: string
    bidDueDate?: string | null
    projectStatus?: string | null
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number
}

export interface FirewireProjectFieldwireMapInput {
    fieldwireId?: string | null
}

export interface ProjectListItem {
    projectSource: ProjectSource
    fieldwireProjectId: string | null
    firewireProjectId: string | null
    fieldwireId: string | null
    mappedFieldwireProjectName: string | null
    name: string
    projectNbr: string
    address: string
    bidDueDate: string | null
    projectStatus: string | null
    salesman: string | null
    jobType: string | null
    scopeType: string | null
    projectScope: string | null
    difficulty: string | null
    totalSqFt: number | null
    createdAt: string | null
    createdBy: string | null
    updatedAt: string | null
    updatedBy: string | null
}

type SqlProjectRow = {
    uuid: string
    fieldwireId: string | null
    name: string
    projectNbr: string
    address: string
    bidDueDate: Date | string
    projectStatus: string
    salesman: string
    jobType: string
    scopeType: string
    projectScope: string
    difficulty: string
    totalSqFt: number
    createdAt: Date | string
    createdBy: string
    updatedAt: Date | string
    updatedBy: string
}

export class FirewireProjectRepository {
    constructor(private app: express.Application) {}

    async listCombined(): Promise<ProjectListItem[]> {
        await this.ensureTable()
        const firewireProjects = await this.listFirewireProjects()
        const fieldwire = this.app.locals.fieldwire as FieldwireSDK
        const fieldwireProjects = await fieldwire.accountProjects()
        const firewireByFieldwireId = new Map<string, FirewireProjectRecord>()
        const firewireByProjectNbr = new Map<string, FirewireProjectRecord>()
        const consumedFirewireIds = new Set<string>()
        const combined: ProjectListItem[] = []

        for (const firewireProject of firewireProjects) {
            if (firewireProject.fieldwireId) {
                firewireByFieldwireId.set(firewireProject.fieldwireId, firewireProject)
            }

            const normalizedProjectNbr = this.normalizeProjectNbr(firewireProject.projectNbr)
            if (normalizedProjectNbr && !firewireByProjectNbr.has(normalizedProjectNbr)) {
                firewireByProjectNbr.set(normalizedProjectNbr, firewireProject)
            }
        }

        for (const fieldwireProject of fieldwireProjects) {
            const fieldwireProjectId = fieldwireProject?.id ? String(fieldwireProject.id) : ''
            if (!fieldwireProjectId) {
                continue
            }

            const explicitFirewire = firewireByFieldwireId.get(fieldwireProjectId)
            if (explicitFirewire) {
                consumedFirewireIds.add(explicitFirewire.uuid)
                combined.push(this.mapMergedProjectToListItem(fieldwireProject, explicitFirewire))
                continue
            }

            const normalizedProjectNbr = this.normalizeProjectNbr(fieldwireProject?.code)
            const matchedByProjectNbr = normalizedProjectNbr ? firewireByProjectNbr.get(normalizedProjectNbr) : null
            if (matchedByProjectNbr && !consumedFirewireIds.has(matchedByProjectNbr.uuid)) {
                consumedFirewireIds.add(matchedByProjectNbr.uuid)
                combined.push(this.mapMergedProjectToListItem(fieldwireProject, matchedByProjectNbr))
                continue
            }

            combined.push(this.mapFieldwireProjectToListItem(fieldwireProject))
        }

        for (const firewireProject of firewireProjects) {
            if (consumedFirewireIds.has(firewireProject.uuid)) {
                continue
            }
            combined.push(this.mapFirewireProjectToListItem(firewireProject))
        }

        return combined.sort((left, right) => {
            const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0
            const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0
            if (leftTime !== rightTime) {
                return rightTime - leftTime
            }
            return left.name.localeCompare(right.name)
        })
    }

    async listFirewireProjects(): Promise<FirewireProjectRecord[]> {
        await this.ensureTable()
        const pool = await this.getPool()
        const query = [
            'SELECT',
            '    uuid,',
            '    fieldwireId,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    bidDueDate,',
            '    projectStatus,',
            '    salesman,',
            '    jobType,',
            '    scopeType,',
            '    projectScope,',
            '    difficulty,',
            '    totalSqFt,',
            '    createdAt,',
            '    createdBy,',
            '    updatedAt,',
            '    updatedBy',
            'FROM dbo.firewireProjects',
            'ORDER BY updatedAt DESC, name ASC;'
        ].join('\n')
        const result = await pool.request().query(query)
        return (result.recordset || []).map((row) => this.mapSqlRow(row))
    }

    async getFirewireProject(projectId: string): Promise<FirewireProjectRecord | null> {
        await this.ensureTable()
        if (!validateUuid(projectId)) {
            return null
        }

        const pool = await this.getPool()
        const query = [
            'SELECT',
            '    uuid,',
            '    fieldwireId,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    bidDueDate,',
            '    projectStatus,',
            '    salesman,',
            '    jobType,',
            '    scopeType,',
            '    projectScope,',
            '    difficulty,',
            '    totalSqFt,',
            '    createdAt,',
            '    createdBy,',
            '    updatedAt,',
            '    updatedBy',
            'FROM dbo.firewireProjects',
            'WHERE uuid = @uuid;'
        ].join('\n')
        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, projectId)
            .query(query)
        const row = (result.recordset || [])[0]
        return row ? this.mapSqlRow(row) : null
    }

    async createFirewireProject(input: FirewireProjectInput, userId: string): Promise<FirewireProjectRecord> {
        await this.ensureTable()

        const normalized = this.normalizeInput(input)
        const projectId = uuidv4()
        const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso()
        const pool = await this.getPool()
        const query = [
            'INSERT INTO dbo.firewireProjects (',
            '    uuid,',
            '    fieldwireId,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    bidDueDate,',
            '    projectStatus,',
            '    salesman,',
            '    jobType,',
            '    scopeType,',
            '    projectScope,',
            '    difficulty,',
            '    totalSqFt,',
            '    createdBy,',
            '    updatedBy',
            ')',
            'VALUES (',
            '    @uuid,',
            '    @fieldwireId,',
            '    @name,',
            '    @projectNbr,',
            '    @address,',
            '    @bidDueDate,',
            '    @projectStatus,',
            '    @salesman,',
            '    @jobType,',
            '    @scopeType,',
            '    @projectScope,',
            '    @difficulty,',
            '    @totalSqFt,',
            '    @createdBy,',
            '    @updatedBy',
            ');'
        ].join('\n')

        await pool.request()
            .input('uuid', mssql.UniqueIdentifier, projectId)
            .input('fieldwireId', mssql.NVarChar(64), normalized.fieldwireId)
            .input('name', mssql.NVarChar(200), normalized.name)
            .input('projectNbr', mssql.NVarChar(100), normalized.projectNbr)
            .input('address', mssql.NVarChar(500), normalized.address)
            .input('bidDueDate', mssql.DateTime2, new Date(bidDueDate))
            .input('projectStatus', mssql.NVarChar(100), normalized.projectStatus)
            .input('salesman', mssql.NVarChar(200), normalized.salesman)
            .input('jobType', mssql.NVarChar(100), normalized.jobType)
            .input('scopeType', mssql.NVarChar(100), normalized.scopeType)
            .input('projectScope', mssql.NVarChar(mssql.MAX), normalized.projectScope)
            .input('difficulty', mssql.NVarChar(100), normalized.difficulty)
            .input('totalSqFt', mssql.Decimal(18, 2), normalized.totalSqFt)
            .input('createdBy', mssql.NVarChar(256), userId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)

        const created = await this.getFirewireProject(projectId)
        if (!created) {
            throw new Error('Created project could not be reloaded.')
        }
        return created
    }

    async updateFirewireProject(projectId: string, input: FirewireProjectInput, userId: string): Promise<FirewireProjectRecord | null> {
        await this.ensureTable()
        if (!validateUuid(projectId)) {
            return null
        }

        const normalized = this.normalizeInput(input)
        const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso()
        const pool = await this.getPool()
        const query = [
            'UPDATE dbo.firewireProjects',
            'SET',
            '    fieldwireId = @fieldwireId,',
            '    name = @name,',
            '    projectNbr = @projectNbr,',
            '    address = @address,',
            '    bidDueDate = @bidDueDate,',
            '    projectStatus = @projectStatus,',
            '    salesman = @salesman,',
            '    jobType = @jobType,',
            '    scopeType = @scopeType,',
            '    projectScope = @projectScope,',
            '    difficulty = @difficulty,',
            '    totalSqFt = @totalSqFt,',
            '    updatedAt = SYSUTCDATETIME(),',
            '    updatedBy = @updatedBy',
            'WHERE uuid = @uuid;'
        ].join('\n')

        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, projectId)
            .input('fieldwireId', mssql.NVarChar(64), normalized.fieldwireId)
            .input('name', mssql.NVarChar(200), normalized.name)
            .input('projectNbr', mssql.NVarChar(100), normalized.projectNbr)
            .input('address', mssql.NVarChar(500), normalized.address)
            .input('bidDueDate', mssql.DateTime2, new Date(bidDueDate))
            .input('projectStatus', mssql.NVarChar(100), normalized.projectStatus)
            .input('salesman', mssql.NVarChar(200), normalized.salesman)
            .input('jobType', mssql.NVarChar(100), normalized.jobType)
            .input('scopeType', mssql.NVarChar(100), normalized.scopeType)
            .input('projectScope', mssql.NVarChar(mssql.MAX), normalized.projectScope)
            .input('difficulty', mssql.NVarChar(100), normalized.difficulty)
            .input('totalSqFt', mssql.Decimal(18, 2), normalized.totalSqFt)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)

        if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
            return null
        }

        return this.getFirewireProject(projectId)
    }

    async updateFieldwireMapping(projectId: string, input: FirewireProjectFieldwireMapInput, userId: string): Promise<FirewireProjectRecord | null> {
        await this.ensureTable()
        if (!validateUuid(projectId)) {
            return null
        }

        const normalizedFieldwireId = this.normalizeFieldwireId(input?.fieldwireId)
        const pool = await this.getPool()
        const query = [
            'UPDATE dbo.firewireProjects',
            'SET',
            '    fieldwireId = @fieldwireId,',
            '    updatedAt = SYSUTCDATETIME(),',
            '    updatedBy = @updatedBy',
            'WHERE uuid = @uuid;'
        ].join('\n')

        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, projectId)
            .input('fieldwireId', mssql.NVarChar(64), normalizedFieldwireId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)

        if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
            return null
        }

        return this.getFirewireProject(projectId)
    }

    async ensureTable(): Promise<void> {
        const pool = await this.getPool()
        const createQuery = [
            "IF OBJECT_ID(N'dbo.firewireProjects', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireProjects (',
            '        uuid UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjects PRIMARY KEY,',
            "        fieldwireId NVARCHAR(64) NULL,",
            '        name NVARCHAR(200) NOT NULL,',
            '        projectNbr NVARCHAR(100) NOT NULL,',
            "        address NVARCHAR(500) NOT NULL CONSTRAINT DF_firewireProjects_address DEFAULT N'',",
            '        bidDueDate DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjects_bidDueDate DEFAULT DATEADD(DAY, 30, SYSUTCDATETIME()),',
            "        projectStatus NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_projectStatus DEFAULT N'Estimation',",
            "        salesman NVARCHAR(200) NOT NULL CONSTRAINT DF_firewireProjects_salesman DEFAULT N'',",
            "        jobType NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_jobType DEFAULT N'',",
            "        scopeType NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_scopeType DEFAULT N'',",
            "        projectScope NVARCHAR(MAX) NOT NULL CONSTRAINT DF_firewireProjects_projectScope DEFAULT N'',",
            "        difficulty NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_difficulty DEFAULT N'',",
            '        totalSqFt DECIMAL(18, 2) NOT NULL CONSTRAINT DF_firewireProjects_totalSqFt DEFAULT 0,',
            '        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjects_createdAt DEFAULT SYSUTCDATETIME(),',
            '        createdBy NVARCHAR(256) NOT NULL,',
            '        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjects_updatedAt DEFAULT SYSUTCDATETIME(),',
            '        updatedBy NVARCHAR(256) NOT NULL',
            '    );',
            'END;'
        ].join('\n')
        const alterQuery = [
            "IF COL_LENGTH('dbo.firewireProjects', 'fieldwireId') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD fieldwireId NVARCHAR(64) NULL;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'projectStatus') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD projectStatus NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_projectStatus_existing DEFAULT N'Estimation';",
            'END;'
        ].join('\n')
        await pool.request().batch(createQuery)
        await pool.request().batch(alterQuery)
    }

    private async getPool(): Promise<mssql.ConnectionPool> {
        const sql = this.app.locals.sqlserver as MsSqlServerDb
        if (!sql) {
            throw new Error('Missing sqlserver app local.')
        }
        return sql.init()
    }

    private normalizeInput(input: FirewireProjectInput): FirewireProjectInput {
        return {
            fieldwireId: this.normalizeFieldwireId(input?.fieldwireId),
            name: this.requireString(input?.name, 'name', 200),
            projectNbr: this.requireString(input?.projectNbr, 'projectNbr', 100),
            address: this.optionalString(input?.address, 500),
            bidDueDate: this.normalizeDate(input?.bidDueDate),
            projectStatus: this.optionalString(input?.projectStatus, 100) || 'Estimation',
            salesman: this.optionalString(input?.salesman, 200),
            jobType: this.optionalString(input?.jobType, 100),
            scopeType: this.optionalString(input?.scopeType, 100),
            projectScope: this.optionalString(input?.projectScope, 4000),
            difficulty: this.optionalString(input?.difficulty, 100),
            totalSqFt: this.normalizeTotalSqFt(input?.totalSqFt)
        }
    }

    private normalizeFieldwireId(input?: string | null): string | null {
        if (typeof input !== 'string') {
            return null
        }
        const value = input.trim()
        return value ? value.slice(0, 64) : null
    }

    private normalizeProjectNbr(input?: string | null): string {
        if (typeof input !== 'string') {
            return ''
        }
        return input.trim().toLowerCase()
    }

    private normalizeDate(input?: string | null): string | null {
        if (!input) {
            return null
        }
        const parsed = new Date(input)
        if (Number.isNaN(parsed.getTime())) {
            throw new Error('Invalid bidDueDate value.')
        }
        return parsed.toISOString()
    }

    private normalizeTotalSqFt(input: number): number {
        const value = Number(input)
        if (!Number.isFinite(value) || value < 0) {
            throw new Error('totalSqFt must be a non-negative number.')
        }
        return Math.round(value * 100) / 100
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

    private defaultBidDueDateIso(): string {
        const value = new Date()
        value.setUTCDate(value.getUTCDate() + 30)
        return value.toISOString()
    }

    private mapSqlRow(row: SqlProjectRow): FirewireProjectRecord {
        return {
            uuid: row.uuid,
            fieldwireId: row.fieldwireId ? String(row.fieldwireId) : null,
            name: row.name,
            projectNbr: row.projectNbr,
            address: row.address,
            bidDueDate: this.toIso(row.bidDueDate) || this.defaultBidDueDateIso(),
            projectStatus: row.projectStatus || 'Estimation',
            salesman: row.salesman,
            jobType: row.jobType,
            scopeType: row.scopeType,
            projectScope: row.projectScope,
            difficulty: row.difficulty,
            totalSqFt: Number(row.totalSqFt || 0),
            createdAt: this.toIso(row.createdAt) || '',
            createdBy: row.createdBy,
            updatedAt: this.toIso(row.updatedAt) || '',
            updatedBy: row.updatedBy
        }
    }

    private mapFieldwireProjectToListItem(project: any): ProjectListItem {
        const fieldwireProjectId = project?.id ? String(project.id) : null
        return {
            projectSource: 'fieldwire',
            fieldwireProjectId,
            firewireProjectId: null,
            fieldwireId: fieldwireProjectId,
            mappedFieldwireProjectName: project?.name || '',
            name: project?.name || '',
            projectNbr: project?.code || '',
            address: project?.address || '',
            bidDueDate: null,
            projectStatus: null,
            salesman: null,
            jobType: null,
            scopeType: null,
            projectScope: null,
            difficulty: null,
            totalSqFt: null,
            createdAt: this.toIso(project?.created_at),
            createdBy: null,
            updatedAt: this.toIso(project?.updated_at),
            updatedBy: null
        }
    }

    private mapFirewireProjectToListItem(project: FirewireProjectRecord): ProjectListItem {
        return {
            projectSource: 'firewire',
            fieldwireProjectId: null,
            firewireProjectId: project.uuid,
            fieldwireId: project.fieldwireId,
            mappedFieldwireProjectName: null,
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            bidDueDate: project.bidDueDate,
            projectStatus: project.projectStatus,
            salesman: project.salesman,
            jobType: project.jobType,
            scopeType: project.scopeType,
            projectScope: project.projectScope,
            difficulty: project.difficulty,
            totalSqFt: project.totalSqFt,
            createdAt: project.createdAt,
            createdBy: project.createdBy,
            updatedAt: project.updatedAt,
            updatedBy: project.updatedBy
        }
    }

    private mapMergedProjectToListItem(fieldwireProject: any, firewireProject: FirewireProjectRecord): ProjectListItem {
        const fieldwireProjectId = fieldwireProject?.id ? String(fieldwireProject.id) : firewireProject.fieldwireId
        return {
            projectSource: 'both',
            fieldwireProjectId,
            firewireProjectId: firewireProject.uuid,
            fieldwireId: firewireProject.fieldwireId,
            mappedFieldwireProjectName: fieldwireProject?.name || firewireProject.name,
            name: firewireProject.name || fieldwireProject?.name || '',
            projectNbr: firewireProject.projectNbr || fieldwireProject?.code || '',
            address: firewireProject.address || fieldwireProject?.address || '',
            bidDueDate: firewireProject.bidDueDate,
            projectStatus: firewireProject.projectStatus,
            salesman: firewireProject.salesman,
            jobType: firewireProject.jobType,
            scopeType: firewireProject.scopeType,
            projectScope: firewireProject.projectScope,
            difficulty: firewireProject.difficulty,
            totalSqFt: firewireProject.totalSqFt,
            createdAt: firewireProject.createdAt || this.toIso(fieldwireProject?.created_at),
            createdBy: firewireProject.createdBy,
            updatedAt: firewireProject.updatedAt || this.toIso(fieldwireProject?.updated_at),
            updatedBy: firewireProject.updatedBy
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
