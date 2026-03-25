import * as express from 'express'
import * as mssql from 'mssql'
import { v4 as uuidv4, validate as validateUuid } from 'uuid'
import { MsSqlServerDb } from '../../../core/databases/mssqldb'
import { FieldwireSDK } from '../../fieldwire/fieldwire'

export type ProjectSource = 'fieldwire' | 'firewire' | 'both'
export type FirewireProjectType = 'Fire Alarm' | 'Sprinkler' | 'Security'

const FIREWIRE_PROJECT_TYPES: FirewireProjectType[] = ['Fire Alarm', 'Sprinkler', 'Security']
const DEFAULT_FIREWIRE_PROJECT_TYPE: FirewireProjectType = 'Fire Alarm'
const DEFAULT_GEOCODE_STATUS = 'Not Configured'

type ProjectGeocodeResult = {
    address: string | null
    latitude: number | null
    longitude: number | null
    geocodeStatus: string
    geocodedAt: string | null
}

export interface FirewireProjectRecord {
    uuid: string
    fieldwireId: string | null
    worksheetData?: any | null
    isManualLocked: boolean
    manualLockedAt: string | null
    manualLockedBy: string | null
    name: string
    projectNbr: string
    address: string
    addressNeedsVerification: boolean
    latitude: number | null
    longitude: number | null
    geocodeStatus: string | null
    geocodedAt: string | null
    bidDueDate: string
    projectStatus: string
    projectType: FirewireProjectType
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
    worksheetData?: any
    name: string
    projectNbr: string
    address: string
    bidDueDate?: string | null
    projectStatus?: string | null
    projectType?: string | null
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

export type FirewireProjectTemplateVisibility = 'Private' | 'Public'

export interface FirewireProjectTemplateRecord {
    templateId: string
    name: string
    visibility: FirewireProjectTemplateVisibility
    ownerUserId: string
    templateData: {
        firewireForm: Partial<FirewireProjectInput>
        worksheetData: any
    }
    createdAt: string
    createdBy: string
    updatedAt: string
    updatedBy: string
}

export interface FirewireProjectTemplateInput {
    templateId?: string | null
    name: string
    visibility: FirewireProjectTemplateVisibility
    firewireForm?: Partial<FirewireProjectInput> | null
    worksheetData?: any
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
    addressNeedsVerification: boolean
    latitude: number | null
    longitude: number | null
    geocodeStatus: string | null
    geocodedAt: string | null
    bidDueDate: string | null
    projectStatus: string | null
    projectType: FirewireProjectType | null
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
    isManualLocked: boolean | number | null
    manualLockedAt: Date | string | null
    manualLockedBy: string | null
    name: string
    projectNbr: string
    address: string
    latitude: number | string | null
    longitude: number | string | null
    geocodeStatus: string | null
    geocodedAt: Date | string | null
    bidDueDate: Date | string
    projectStatus: string
    projectType: string
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

type SqlWorksheetRow = {
    projectId: string
    worksheetJson: string | null
}

type SqlTemplateRow = {
    templateId: string
    name: string
    visibility: FirewireProjectTemplateVisibility
    ownerUserId: string
    templateJson: string | null
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
            '    isManualLocked,',
            '    manualLockedAt,',
            '    manualLockedBy,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    latitude,',
            '    longitude,',
            '    geocodeStatus,',
            '    geocodedAt,',
            '    bidDueDate,',
            '    projectStatus,',
            '    projectType,',
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
            '    isManualLocked,',
            '    manualLockedAt,',
            '    manualLockedBy,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    latitude,',
            '    longitude,',
            '    geocodeStatus,',
            '    geocodedAt,',
            '    bidDueDate,',
            '    projectStatus,',
            '    projectType,',
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
        if (!row) {
            return null
        }

        const project = this.mapSqlRow(row)
        project.worksheetData = await this.getWorksheetData(projectId)
        return project
    }

    async createFirewireProject(input: FirewireProjectInput, userId: string): Promise<FirewireProjectRecord> {
        await this.ensureTable()

        const normalized = this.normalizeInput(input)
        const projectId = uuidv4()
        const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso()
        const geocode = await this.resolveProjectGeocode(normalized.address)
        const resolvedAddress = geocode.address || normalized.address
        const pool = await this.getPool()
        const query = [
            'INSERT INTO dbo.firewireProjects (',
            '    uuid,',
            '    fieldwireId,',
            '    name,',
            '    projectNbr,',
            '    address,',
            '    latitude,',
            '    longitude,',
            '    geocodeStatus,',
            '    geocodedAt,',
            '    bidDueDate,',
            '    projectStatus,',
            '    projectType,',
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
            '    @latitude,',
            '    @longitude,',
            '    @geocodeStatus,',
            '    @geocodedAt,',
            '    @bidDueDate,',
            '    @projectStatus,',
            '    @projectType,',
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
            .input('address', mssql.NVarChar(500), resolvedAddress)
            .input('latitude', mssql.Decimal(10, 7), geocode.latitude)
            .input('longitude', mssql.Decimal(10, 7), geocode.longitude)
            .input('geocodeStatus', mssql.NVarChar(50), geocode.geocodeStatus)
            .input('geocodedAt', mssql.DateTime2, geocode.geocodedAt ? new Date(geocode.geocodedAt) : null)
            .input('bidDueDate', mssql.DateTime2, new Date(bidDueDate))
            .input('projectStatus', mssql.NVarChar(100), normalized.projectStatus)
            .input('projectType', mssql.NVarChar(50), normalized.projectType)
            .input('salesman', mssql.NVarChar(200), normalized.salesman)
            .input('jobType', mssql.NVarChar(100), normalized.jobType)
            .input('scopeType', mssql.NVarChar(100), normalized.scopeType)
            .input('projectScope', mssql.NVarChar(mssql.MAX), normalized.projectScope)
            .input('difficulty', mssql.NVarChar(100), normalized.difficulty)
            .input('totalSqFt', mssql.Decimal(18, 2), normalized.totalSqFt)
            .input('createdBy', mssql.NVarChar(256), userId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)

        if (typeof normalized.worksheetData !== 'undefined') {
            await this.upsertWorksheetData(projectId, normalized.worksheetData, userId)
        }

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
        const existingProject = await this.getFirewireProject(projectId)
        if (!existingProject) {
            return null
        }
        if (existingProject.projectStatus !== 'Estimation' && normalized.projectType !== existingProject.projectType) {
            throw new Error('projectType cannot be changed after a project leaves Estimation.')
        }
        const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso()
        const geocode = await this.resolveProjectGeocode(normalized.address, existingProject)
        const resolvedAddress = geocode.address || normalized.address
        const pool = await this.getPool()
        const query = [
            'UPDATE dbo.firewireProjects',
            'SET',
            '    fieldwireId = @fieldwireId,',
            '    name = @name,',
            '    projectNbr = @projectNbr,',
            '    address = @address,',
            '    latitude = @latitude,',
            '    longitude = @longitude,',
            '    geocodeStatus = @geocodeStatus,',
            '    geocodedAt = @geocodedAt,',
            '    bidDueDate = @bidDueDate,',
            '    projectStatus = @projectStatus,',
            '    projectType = @projectType,',
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
            .input('address', mssql.NVarChar(500), resolvedAddress)
            .input('latitude', mssql.Decimal(10, 7), geocode.latitude)
            .input('longitude', mssql.Decimal(10, 7), geocode.longitude)
            .input('geocodeStatus', mssql.NVarChar(50), geocode.geocodeStatus)
            .input('geocodedAt', mssql.DateTime2, geocode.geocodedAt ? new Date(geocode.geocodedAt) : null)
            .input('bidDueDate', mssql.DateTime2, new Date(bidDueDate))
            .input('projectStatus', mssql.NVarChar(100), normalized.projectStatus)
            .input('projectType', mssql.NVarChar(50), normalized.projectType)
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

        if (typeof normalized.worksheetData !== 'undefined') {
            await this.upsertWorksheetData(projectId, normalized.worksheetData, userId)
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

    async updateManualLock(projectId: string, isLocked: boolean, userId: string): Promise<FirewireProjectRecord | null> {
        await this.ensureTable()
        if (!validateUuid(projectId)) {
            return null
        }

        const pool = await this.getPool()
        const query = [
            'UPDATE dbo.firewireProjects',
            'SET',
            '    isManualLocked = @isManualLocked,',
            '    manualLockedAt = CASE WHEN @isManualLocked = 1 THEN SYSUTCDATETIME() ELSE NULL END,',
            '    manualLockedBy = CASE WHEN @isManualLocked = 1 THEN @manualLockedBy ELSE NULL END,',
            '    updatedAt = SYSUTCDATETIME(),',
            '    updatedBy = @updatedBy',
            'WHERE uuid = @uuid;'
        ].join('\n')

        const result = await pool.request()
            .input('uuid', mssql.UniqueIdentifier, projectId)
            .input('isManualLocked', mssql.Bit, isLocked ? 1 : 0)
            .input('manualLockedBy', mssql.NVarChar(256), isLocked ? userId : null)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)

        if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
            return null
        }

        return this.getFirewireProject(projectId)
    }

    async listProjectTemplates(userId: string): Promise<FirewireProjectTemplateRecord[]> {
        await this.ensureTable()
        const pool = await this.getPool()
        const query = [
            'SELECT',
            '    templateId,',
            '    name,',
            '    visibility,',
            '    ownerUserId,',
            '    templateJson,',
            '    createdAt,',
            '    createdBy,',
            '    updatedAt,',
            '    updatedBy',
            'FROM dbo.firewireProjectTemplates',
            'WHERE visibility = @publicVisibility',
            '   OR ownerUserId = @ownerUserId',
            'ORDER BY visibility ASC, name ASC, updatedAt DESC;'
        ].join('\n')
        const result = await pool.request()
            .input('publicVisibility', mssql.NVarChar(20), 'Public')
            .input('ownerUserId', mssql.NVarChar(256), userId)
            .query(query)
        return (result.recordset || []).map((row) => this.mapTemplateRow(row))
    }

    async saveProjectTemplate(input: FirewireProjectTemplateInput, userId: string): Promise<FirewireProjectTemplateRecord> {
        await this.ensureTable()
        const normalized = this.normalizeTemplateInput(input)
        const pool = await this.getPool()
        const templateId = normalized.templateId && validateUuid(normalized.templateId)
            ? normalized.templateId
            : uuidv4()
        const templateJson = JSON.stringify({
            firewireForm: normalized.firewireForm || {},
            worksheetData: typeof normalized.worksheetData === 'undefined' ? null : normalized.worksheetData
        })
        const query = [
            'DECLARE @resolvedTemplateId UNIQUEIDENTIFIER = @templateId;',
            '',
            'SELECT TOP 1 @resolvedTemplateId = templateId',
            'FROM dbo.firewireProjectTemplates',
            'WHERE name = @name',
            '  AND visibility = @visibility',
            '  AND ownerUserId = @ownerUserId;',
            '',
            'MERGE dbo.firewireProjectTemplates AS target',
            'USING (SELECT @resolvedTemplateId AS templateId) AS source',
            'ON target.templateId = source.templateId',
            'WHEN MATCHED THEN',
            '    UPDATE SET',
            '        name = @name,',
            '        visibility = @visibility,',
            '        ownerUserId = @ownerUserId,',
            '        templateJson = @templateJson,',
            '        updatedAt = SYSUTCDATETIME(),',
            '        updatedBy = @updatedBy',
            'WHEN NOT MATCHED THEN',
            '    INSERT (templateId, name, visibility, ownerUserId, templateJson, createdBy, updatedBy)',
            '    VALUES (@resolvedTemplateId, @name, @visibility, @ownerUserId, @templateJson, @createdBy, @updatedBy);',
            '',
            'SELECT',
            '    templateId,',
            '    name,',
            '    visibility,',
            '    ownerUserId,',
            '    templateJson,',
            '    createdAt,',
            '    createdBy,',
            '    updatedAt,',
            '    updatedBy',
            'FROM dbo.firewireProjectTemplates',
            'WHERE templateId = @resolvedTemplateId;'
        ].join('\n')
        const result = await pool.request()
            .input('templateId', mssql.UniqueIdentifier, templateId)
            .input('name', mssql.NVarChar(200), normalized.name)
            .input('visibility', mssql.NVarChar(20), normalized.visibility)
            .input('ownerUserId', mssql.NVarChar(256), userId)
            .input('templateJson', mssql.NVarChar(mssql.MAX), templateJson)
            .input('createdBy', mssql.NVarChar(256), userId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)
        const row = (result.recordset || [])[0] as SqlTemplateRow | undefined
        if (!row) {
            throw new Error('Template save failed.')
        }
        return this.mapTemplateRow(row)
    }

    async ensureTable(): Promise<void> {
        const pool = await this.getPool()
        const createQuery = [
            "IF OBJECT_ID(N'dbo.firewireProjects', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireProjects (',
            '        uuid UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjects PRIMARY KEY,',
            "        fieldwireId NVARCHAR(64) NULL,",
            '        isManualLocked BIT NOT NULL CONSTRAINT DF_firewireProjects_isManualLocked DEFAULT 0,',
            '        manualLockedAt DATETIME2(7) NULL,',
            '        manualLockedBy NVARCHAR(256) NULL,',
            '        name NVARCHAR(200) NOT NULL,',
            '        projectNbr NVARCHAR(100) NOT NULL,',
            "        address NVARCHAR(500) NOT NULL CONSTRAINT DF_firewireProjects_address DEFAULT N'',",
            '        latitude DECIMAL(10, 7) NULL,',
            '        longitude DECIMAL(10, 7) NULL,',
            "        geocodeStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_firewireProjects_geocodeStatus DEFAULT N'',",
            '        geocodedAt DATETIME2(7) NULL,',
            '        bidDueDate DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjects_bidDueDate DEFAULT DATEADD(DAY, 30, SYSUTCDATETIME()),',
            "        projectStatus NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_projectStatus DEFAULT N'Estimation',",
            `        projectType NVARCHAR(50) NOT NULL CONSTRAINT DF_firewireProjects_projectType DEFAULT N'${DEFAULT_FIREWIRE_PROJECT_TYPE}',`,
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
        const worksheetQuery = [
            "IF OBJECT_ID(N'dbo.firewireProjectWorksheets', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireProjectWorksheets (',
            '        projectId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjectWorksheets PRIMARY KEY,',
            '        worksheetJson NVARCHAR(MAX) NULL,',
            '        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectWorksheets_createdAt DEFAULT SYSUTCDATETIME(),',
            '        createdBy NVARCHAR(256) NOT NULL,',
            '        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectWorksheets_updatedAt DEFAULT SYSUTCDATETIME(),',
            '        updatedBy NVARCHAR(256) NOT NULL',
            '    );',
            'END;'
        ].join('\n')
        const templateQuery = [
            "IF OBJECT_ID(N'dbo.firewireProjectTemplates', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireProjectTemplates (',
            '        templateId UNIQUEIDENTIFIER NOT NULL CONSTRAINT PK_firewireProjectTemplates PRIMARY KEY,',
            '        name NVARCHAR(200) NOT NULL,',
            "        visibility NVARCHAR(20) NOT NULL CONSTRAINT DF_firewireProjectTemplates_visibility DEFAULT N'Private',",
            '        ownerUserId NVARCHAR(256) NOT NULL,',
            '        templateJson NVARCHAR(MAX) NOT NULL,',
            '        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectTemplates_createdAt DEFAULT SYSUTCDATETIME(),',
            '        createdBy NVARCHAR(256) NOT NULL,',
            '        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireProjectTemplates_updatedAt DEFAULT SYSUTCDATETIME(),',
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
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'isManualLocked') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD isManualLocked BIT NOT NULL CONSTRAINT DF_firewireProjects_isManualLocked_existing DEFAULT 0;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'projectType') IS NULL",
            'BEGIN',
            `    ALTER TABLE dbo.firewireProjects ADD projectType NVARCHAR(50) NOT NULL CONSTRAINT DF_firewireProjects_projectType_existing DEFAULT N'${DEFAULT_FIREWIRE_PROJECT_TYPE}';`,
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'manualLockedAt') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD manualLockedAt DATETIME2(7) NULL;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'manualLockedBy') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD manualLockedBy NVARCHAR(256) NULL;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'latitude') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD latitude DECIMAL(10, 7) NULL;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'longitude') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD longitude DECIMAL(10, 7) NULL;",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'geocodeStatus') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD geocodeStatus NVARCHAR(50) NOT NULL CONSTRAINT DF_firewireProjects_geocodeStatus_existing DEFAULT N'';",
            'END;',
            "IF COL_LENGTH('dbo.firewireProjects', 'geocodedAt') IS NULL",
            'BEGIN',
            "    ALTER TABLE dbo.firewireProjects ADD geocodedAt DATETIME2(7) NULL;",
            'END;'
        ].join('\n')
        const backfillProjectTypeQuery = [
            "IF COL_LENGTH('dbo.firewireProjects', 'projectType') IS NOT NULL",
            'BEGIN',
            `    EXEC(N'UPDATE dbo.firewireProjects SET projectType = N''${DEFAULT_FIREWIRE_PROJECT_TYPE}'' WHERE projectType IS NULL OR LTRIM(RTRIM(projectType)) = N'''';');`,
            'END;'
        ].join('\n')
        await pool.request().batch(createQuery)
        await pool.request().batch(worksheetQuery)
        await pool.request().batch(templateQuery)
        await pool.request().batch(alterQuery)
        await pool.request().batch(backfillProjectTypeQuery)
    }

    private async getPool(): Promise<mssql.ConnectionPool> {
        const sql = this.app.locals.sqlserver as MsSqlServerDb
        if (!sql) {
            throw new Error('Missing sqlserver app local.')
        }
        return sql.init()
    }

    private normalizeInput(input: FirewireProjectInput): FirewireProjectInput {
        const normalizedProjectStatus = this.optionalString(input?.projectStatus, 100) || 'Estimation'
        return {
            fieldwireId: this.normalizeFieldwireId(input?.fieldwireId),
            worksheetData: this.normalizeWorksheetData(input?.worksheetData),
            name: this.requireString(input?.name, 'name', 200),
            projectNbr: this.normalizeProjectNbrInput(input?.projectNbr, normalizedProjectStatus),
            address: this.optionalString(input?.address, 500),
            bidDueDate: this.normalizeDate(input?.bidDueDate),
            projectStatus: normalizedProjectStatus,
            projectType: this.normalizeProjectType(input?.projectType),
            salesman: this.optionalString(input?.salesman, 200),
            jobType: this.optionalString(input?.jobType, 100),
            scopeType: this.optionalString(input?.scopeType, 100),
            projectScope: this.optionalString(input?.projectScope, 4000),
            difficulty: this.optionalString(input?.difficulty, 100),
            totalSqFt: this.normalizeTotalSqFt(input?.totalSqFt)
        }
    }

    private normalizeProjectNbrInput(input?: string | null, projectStatus?: string | null): string {
        const value = this.optionalString(input, 100)
        const normalizedStatus = this.optionalString(projectStatus, 100)
        if (normalizedStatus === 'Install' && !value) {
            throw new Error('projectNbr is required when projectStatus is Install.')
        }
        return value
    }

    private async resolveProjectGeocode(address: string, existingProject?: FirewireProjectRecord | null): Promise<ProjectGeocodeResult> {
        const normalizedAddress = this.optionalString(address, 500)
        const existingAddress = this.optionalString(existingProject?.address, 500)
        const addressChanged = normalizedAddress.toLowerCase() !== existingAddress.toLowerCase()
        const hasExistingMappedCoordinates = typeof existingProject?.latitude === 'number' && typeof existingProject?.longitude === 'number'

        if (!normalizedAddress) {
            return {
                address: null,
                latitude: null,
                longitude: null,
                geocodeStatus: 'Missing Address',
                geocodedAt: null
            }
        }

        if (existingProject && !addressChanged && hasExistingMappedCoordinates && existingProject.geocodeStatus === 'Mapped') {
            return {
                address: existingProject.address || normalizedAddress,
                latitude: existingProject.latitude,
                longitude: existingProject.longitude,
                geocodeStatus: existingProject.geocodeStatus || 'Mapped',
                geocodedAt: existingProject.geocodedAt || null
            }
        }

        const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim()
        if (!subscriptionKey) {
            return {
                address: existingProject?.address || normalizedAddress,
                latitude: existingProject?.latitude ?? null,
                longitude: existingProject?.longitude ?? null,
                geocodeStatus: DEFAULT_GEOCODE_STATUS,
                geocodedAt: existingProject?.geocodedAt || null
            }
        }

        const apiVersion = (process.env.AZURE_MAPS_API_VERSION || '1.0').trim()
        const baseUrl = (process.env.AZURE_MAPS_BASE_URL || 'https://atlas.microsoft.com').trim().replace(/\/$/, '')
        const url = `${baseUrl}/search/address/json?api-version=${encodeURIComponent(apiVersion)}&subscription-key=${encodeURIComponent(subscriptionKey)}&query=${encodeURIComponent(normalizedAddress)}&limit=1`

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    Accept: 'application/json'
                }
            })

            if (!response.ok) {
                return {
                    address: existingProject?.address || normalizedAddress,
                    latitude: existingProject?.latitude ?? null,
                    longitude: existingProject?.longitude ?? null,
                    geocodeStatus: 'Error',
                    geocodedAt: existingProject?.geocodedAt || null
                }
            }

            const payload = await response.json() as any
            const bestResult = Array.isArray(payload?.results) ? payload.results[0] : null
            const standardizedAddress =
                this.optionalString(bestResult?.address?.freeformAddress, 500)
                || this.buildStandardizedAddress(bestResult?.address)
                || normalizedAddress
            const latitude = bestResult?.position?.lat
            const longitude = bestResult?.position?.lon
            if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                return {
                    address: normalizedAddress,
                    latitude: null,
                    longitude: null,
                    geocodeStatus: 'Not Found',
                    geocodedAt: new Date().toISOString()
                }
            }

            if (this.requiresAddressVerification(normalizedAddress, bestResult?.address, standardizedAddress)) {
                return {
                    address: normalizedAddress,
                    latitude: null,
                    longitude: null,
                    geocodeStatus: 'Needs Verification',
                    geocodedAt: new Date().toISOString()
                }
            }

            return {
                address: standardizedAddress,
                latitude,
                longitude,
                geocodeStatus: 'Mapped',
                geocodedAt: new Date().toISOString()
            }
        } catch {
            return {
                address: existingProject?.address || normalizedAddress,
                latitude: existingProject?.latitude ?? null,
                longitude: existingProject?.longitude ?? null,
                geocodeStatus: 'Error',
                geocodedAt: existingProject?.geocodedAt || null
            }
        }
    }

    private buildStandardizedAddress(address: any): string {
        const streetNumber = this.optionalString(address?.streetNumber, 50)
        const streetName = this.optionalString(address?.streetName, 200)
        const municipality = this.optionalString(address?.municipality, 120)
        const countrySubdivision = this.optionalString(address?.countrySubdivision, 120)
        const postalCode = this.optionalString(address?.postalCode, 32)

        const street = [streetNumber, streetName].filter((value) => value).join(' ').trim()
        const locality = [municipality, countrySubdivision, postalCode].filter((value) => value).join(', ').replace(/, (?=[^,]+$)/, ' ')
        return [street, locality].filter((value) => value).join(', ').trim()
    }

    private requiresAddressVerification(inputAddress: string, resultAddress: any, standardizedAddress: string): boolean {
        const inputStreetNumber = this.extractStreetNumber(inputAddress)
        if (!inputStreetNumber) {
            return false
        }

        const resultStreetNumber =
            this.optionalString(resultAddress?.streetNumber, 50)
            || this.extractStreetNumber(standardizedAddress)

        return !resultStreetNumber || resultStreetNumber !== inputStreetNumber
    }

    private extractStreetNumber(address: string | null | undefined): string {
        const match = /^\s*(\d+[A-Za-z\-]*)\b/.exec(String(address || '').trim())
        return match?.[1] || ''
    }

    private normalizeFieldwireId(input?: string | null): string | null {
        if (typeof input !== 'string') {
            return null
        }
        const value = input.trim()
        return value ? value.slice(0, 64) : null
    }

    private normalizeWorksheetData(input: any): any {
        if (typeof input === 'undefined') {
            return undefined
        }
        if (input === null) {
            return null
        }

        try {
            return JSON.parse(JSON.stringify(input))
        } catch {
            throw new Error('Invalid worksheetData payload.')
        }
    }

    private normalizeTemplateInput(input: FirewireProjectTemplateInput): FirewireProjectTemplateInput {
        return {
            templateId: this.normalizeOptionalUuid(input?.templateId),
            name: this.requireString(input?.name, 'name', 200),
            visibility: input?.visibility === 'Public' ? 'Public' : 'Private',
            firewireForm: this.normalizeTemplateFirewireForm(input?.firewireForm),
            worksheetData: this.normalizeWorksheetData(input?.worksheetData)
        }
    }

    private normalizeTemplateFirewireForm(input?: Partial<FirewireProjectInput> | null): Partial<FirewireProjectInput> {
        if (!input || typeof input !== 'object') {
            return {}
        }

        return {
            projectType: this.normalizeProjectType(input.projectType),
            jobType: this.optionalString(input.jobType, 100),
            scopeType: this.optionalString(input.scopeType, 100),
            projectScope: this.optionalString(input.projectScope, 4000),
            difficulty: this.optionalString(input.difficulty, 100)
        }
    }

    private normalizeOptionalUuid(input?: string | null): string | null {
        if (typeof input !== 'string') {
            return null
        }
        const value = input.trim()
        return value && validateUuid(value) ? value : null
    }

    private normalizeProjectNbr(input?: string | null): string {
        if (typeof input !== 'string') {
            return ''
        }
        return input.trim().toLowerCase()
    }

    private normalizeProjectType(input?: string | null): FirewireProjectType {
        const value = typeof input === 'string' ? input.trim() : ''
        const matched = FIREWIRE_PROJECT_TYPES.find((item) => item === value)
        if (matched) {
            return matched
        }
        if (!value) {
            return DEFAULT_FIREWIRE_PROJECT_TYPE
        }
        throw new Error(`Invalid projectType. Allowed values: ${FIREWIRE_PROJECT_TYPES.join(', ')}.`)
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
        const geocodeStatus = row.geocodeStatus || null
        return {
            uuid: row.uuid,
            fieldwireId: row.fieldwireId ? String(row.fieldwireId) : null,
            worksheetData: null,
            isManualLocked: Boolean(row.isManualLocked),
            manualLockedAt: this.toIso(row.manualLockedAt),
            manualLockedBy: row.manualLockedBy ? String(row.manualLockedBy) : null,
            name: row.name,
            projectNbr: row.projectNbr,
            address: row.address,
            addressNeedsVerification: this.addressNeedsVerification(geocodeStatus),
            latitude: row.latitude === null || typeof row.latitude === 'undefined' ? null : Number(row.latitude),
            longitude: row.longitude === null || typeof row.longitude === 'undefined' ? null : Number(row.longitude),
            geocodeStatus,
            geocodedAt: this.toIso(row.geocodedAt),
            bidDueDate: this.toIso(row.bidDueDate) || this.defaultBidDueDateIso(),
            projectStatus: row.projectStatus || 'Estimation',
            projectType: this.normalizeProjectType(row.projectType),
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

    private async getWorksheetData(projectId: string): Promise<any | null> {
        const pool = await this.getPool()
        const query = [
            'SELECT projectId, worksheetJson',
            'FROM dbo.firewireProjectWorksheets',
            'WHERE projectId = @projectId;'
        ].join('\n')
        const result = await pool.request()
            .input('projectId', mssql.UniqueIdentifier, projectId)
            .query(query)
        const row = (result.recordset || [])[0] as SqlWorksheetRow | undefined
        if (!row?.worksheetJson) {
            return null
        }

        try {
            return JSON.parse(String(row.worksheetJson))
        } catch {
            return null
        }
    }

    private async upsertWorksheetData(projectId: string, worksheetData: any, userId: string): Promise<void> {
        const pool = await this.getPool()

        if (worksheetData === null) {
            await pool.request()
                .input('projectId', mssql.UniqueIdentifier, projectId)
                .query('DELETE FROM dbo.firewireProjectWorksheets WHERE projectId = @projectId;')
            return
        }

        const worksheetJson = JSON.stringify(worksheetData)
        const query = [
            'MERGE dbo.firewireProjectWorksheets AS target',
            'USING (SELECT @projectId AS projectId) AS source',
            'ON target.projectId = source.projectId',
            'WHEN MATCHED THEN',
            '    UPDATE SET',
            '        worksheetJson = @worksheetJson,',
            '        updatedAt = SYSUTCDATETIME(),',
            '        updatedBy = @updatedBy',
            'WHEN NOT MATCHED THEN',
            '    INSERT (projectId, worksheetJson, createdBy, updatedBy)',
            '    VALUES (@projectId, @worksheetJson, @createdBy, @updatedBy);'
        ].join('\n')

        await pool.request()
            .input('projectId', mssql.UniqueIdentifier, projectId)
            .input('worksheetJson', mssql.NVarChar(mssql.MAX), worksheetJson)
            .input('createdBy', mssql.NVarChar(256), userId)
            .input('updatedBy', mssql.NVarChar(256), userId)
            .query(query)
    }

    private mapTemplateRow(row: SqlTemplateRow): FirewireProjectTemplateRecord {
        let templateData: FirewireProjectTemplateRecord['templateData'] = {
            firewireForm: {},
            worksheetData: null
        }

        if (row.templateJson) {
            try {
                const parsed = JSON.parse(String(row.templateJson))
                templateData = {
                    firewireForm: parsed?.firewireForm && typeof parsed.firewireForm === 'object' ? parsed.firewireForm : {},
                    worksheetData: typeof parsed?.worksheetData === 'undefined' ? null : parsed.worksheetData
                }
            } catch {
                templateData = {
                    firewireForm: {},
                    worksheetData: null
                }
            }
        }

        return {
            templateId: row.templateId,
            name: row.name,
            visibility: row.visibility === 'Public' ? 'Public' : 'Private',
            ownerUserId: row.ownerUserId,
            templateData,
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
            addressNeedsVerification: false,
            latitude: null,
            longitude: null,
            geocodeStatus: null,
            geocodedAt: null,
            bidDueDate: null,
            projectStatus: null,
            projectType: null,
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
            addressNeedsVerification: project.addressNeedsVerification,
            latitude: project.latitude,
            longitude: project.longitude,
            geocodeStatus: project.geocodeStatus,
            geocodedAt: project.geocodedAt,
            bidDueDate: project.bidDueDate,
            projectStatus: project.projectStatus,
            projectType: project.projectType,
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
            addressNeedsVerification: firewireProject.addressNeedsVerification,
            latitude: firewireProject.latitude,
            longitude: firewireProject.longitude,
            geocodeStatus: firewireProject.geocodeStatus,
            geocodedAt: firewireProject.geocodedAt,
            bidDueDate: firewireProject.bidDueDate,
            projectStatus: firewireProject.projectStatus,
            projectType: firewireProject.projectType,
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

    private addressNeedsVerification(geocodeStatus: string | null | undefined): boolean {
        return !!geocodeStatus && geocodeStatus !== 'Mapped'
    }
}
