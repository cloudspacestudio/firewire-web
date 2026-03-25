import * as express from 'express'
import * as mssql from 'mssql'
import { MsSqlServerDb } from '../../../core/databases/mssqldb'

export interface FirewireUserPreferencesPayload {
    homePage: {
        backgroundMode: string
        backgroundVideo: string
        showRecentProjects: boolean
        compactHero: boolean
        solidColor: string
        gradientFrom: string
        gradientTo: string
        gradientAngle: number
    }
    projectMap: {
        version: number
        style: string
        dimension: string
        showRoadDetails: boolean
        showBuildingFootprints: boolean
        autoFitPins: boolean
    }
    profile: {
        avatarDataUrl: string | null
    }
}

export interface FirewireUserPreferencesRecord {
    userId: string
    preferences: FirewireUserPreferencesPayload
    createdAt: string | null
    createdBy: string | null
    updatedAt: string | null
    updatedBy: string | null
}

type SqlPreferencesRow = {
    userId: string
    preferencesJson: string | null
    createdAt: Date | string | null
    createdBy: string | null
    updatedAt: Date | string | null
    updatedBy: string | null
}

export class FirewireUserPreferencesRepository {
    constructor(private app: express.Application) {}

    async getUserPreferences(userId: string): Promise<FirewireUserPreferencesRecord> {
        await this.ensureTable()
        const pool = await this.getPool()
        const query = [
            'SELECT userId, preferencesJson, createdAt, createdBy, updatedAt, updatedBy',
            'FROM dbo.firewireUserPreferences',
            'WHERE userId = @userId;'
        ].join('\n')
        const result = await pool.request()
            .input('userId', mssql.NVarChar(256), userId)
            .query(query)
        const row = (result.recordset || [])[0] as SqlPreferencesRow | undefined
        if (!row) {
            return {
                userId,
                preferences: this.defaultPreferences(),
                createdAt: null,
                createdBy: null,
                updatedAt: null,
                updatedBy: null
            }
        }

        return {
            userId: row.userId,
            preferences: this.parsePreferences(row.preferencesJson),
            createdAt: this.toIso(row.createdAt),
            createdBy: row.createdBy || null,
            updatedAt: this.toIso(row.updatedAt),
            updatedBy: row.updatedBy || null
        }
    }

    async saveUserPreferences(userId: string, payload: FirewireUserPreferencesPayload, actorUserId: string): Promise<FirewireUserPreferencesRecord> {
        await this.ensureTable()
        const normalized = this.normalizePayload(payload)
        const pool = await this.getPool()
        const query = [
            'MERGE dbo.firewireUserPreferences AS target',
            'USING (SELECT @userId AS userId) AS source',
            'ON target.userId = source.userId',
            'WHEN MATCHED THEN',
            '    UPDATE SET',
            '        preferencesJson = @preferencesJson,',
            '        updatedAt = SYSUTCDATETIME(),',
            '        updatedBy = @updatedBy',
            'WHEN NOT MATCHED THEN',
            '    INSERT (userId, preferencesJson, createdBy, updatedBy)',
            '    VALUES (@userId, @preferencesJson, @createdBy, @updatedBy);'
        ].join('\n')

        await pool.request()
            .input('userId', mssql.NVarChar(256), userId)
            .input('preferencesJson', mssql.NVarChar(mssql.MAX), JSON.stringify(normalized))
            .input('createdBy', mssql.NVarChar(256), actorUserId)
            .input('updatedBy', mssql.NVarChar(256), actorUserId)
            .query(query)

        return this.getUserPreferences(userId)
    }

    async ensureTable(): Promise<void> {
        const pool = await this.getPool()
        const query = [
            "IF OBJECT_ID(N'dbo.firewireUserPreferences', N'U') IS NULL",
            'BEGIN',
            '    CREATE TABLE dbo.firewireUserPreferences (',
            '        userId NVARCHAR(256) NOT NULL CONSTRAINT PK_firewireUserPreferences PRIMARY KEY,',
            '        preferencesJson NVARCHAR(MAX) NOT NULL,',
            '        createdAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireUserPreferences_createdAt DEFAULT SYSUTCDATETIME(),',
            '        createdBy NVARCHAR(256) NOT NULL,',
            '        updatedAt DATETIME2(7) NOT NULL CONSTRAINT DF_firewireUserPreferences_updatedAt DEFAULT SYSUTCDATETIME(),',
            '        updatedBy NVARCHAR(256) NOT NULL',
            '    );',
            'END;'
        ].join('\n')
        await pool.request().batch(query)
    }

    private normalizePayload(payload: FirewireUserPreferencesPayload | null | undefined): FirewireUserPreferencesPayload {
        const defaults = this.defaultPreferences()
        const homePage = payload?.homePage && typeof payload.homePage === 'object' ? payload.homePage : defaults.homePage
        const projectMap = payload?.projectMap && typeof payload.projectMap === 'object' ? payload.projectMap : defaults.projectMap
        const profile = payload?.profile && typeof payload.profile === 'object' ? payload.profile : defaults.profile

        return {
            homePage: {
                backgroundMode: this.normalizeBackgroundMode(homePage.backgroundMode),
                backgroundVideo: this.normalizeBackgroundVideo(homePage.backgroundVideo),
                showRecentProjects: homePage.showRecentProjects !== false,
                compactHero: !!homePage.compactHero,
                solidColor: this.normalizeHexColor(homePage.solidColor, '#08111b'),
                gradientFrom: this.normalizeHexColor(homePage.gradientFrom, '#09111d'),
                gradientTo: this.normalizeHexColor(homePage.gradientTo, '#060a12'),
                gradientAngle: this.normalizeAngle(homePage.gradientAngle)
            },
            projectMap: {
                version: this.normalizeProjectMapVersion(projectMap.version),
                style: this.normalizeProjectMapStyle(projectMap.style),
                dimension: this.normalizeProjectMapDimension(projectMap.dimension),
                showRoadDetails: projectMap.showRoadDetails !== false,
                showBuildingFootprints: projectMap.showBuildingFootprints !== false,
                autoFitPins: projectMap.autoFitPins !== false
            },
            profile: {
                avatarDataUrl: this.normalizeAvatarDataUrl(profile.avatarDataUrl)
            }
        }
    }

    private normalizeBackgroundMode(input: unknown): string {
        if (input === 'solid' || input === 'gradient') {
            return String(input)
        }
        return 'video'
    }

    private normalizeBackgroundVideo(input: unknown): string {
        if (typeof input !== 'string') {
            return 'fire1.mp4'
        }
        const value = input.trim()
        if (/^[^\\/:*?"<>|]+\.(mp4|mov|webm)$/i.test(value)) {
            return value
        }
        if (/^fire1$/i.test(value)) {
            return 'fire1.mp4'
        }
        if (/^fire2$/i.test(value)) {
            return 'fire2.mp4'
        }
        if (/^ps3$/i.test(value)) {
            return 'ps3.mp4'
        }
        const mediaMatch = /^media([0-9]+)$/i.exec(value)
        if (mediaMatch) {
            return `Media${mediaMatch[1]}.mp4`
        }
        return 'fire1.mp4'
    }

    private normalizeHexColor(input: unknown, fallback: string): string {
        if (typeof input !== 'string') {
            return fallback
        }
        const value = input.trim()
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
            return value
        }
        return fallback
    }

    private normalizeAngle(input: unknown): number {
        const value = Number(input)
        if (!Number.isFinite(value)) {
            return 135
        }
        return Math.max(0, Math.min(360, Math.round(value)))
    }

    private normalizeProjectMapVersion(input: unknown): number {
        const value = Number(input)
        return Number.isFinite(value) && value >= 1 ? Math.round(value) : 1
    }

    private normalizeProjectMapStyle(input: unknown): string {
        switch (input) {
            case 'road':
            case 'satellite':
            case 'road_shaded_relief':
            case 'night':
                return String(input)
            default:
                return 'night'
        }
    }

    private normalizeProjectMapDimension(input: unknown): string {
        return input === '3d' ? '3d' : '2d'
    }

    private normalizeAvatarDataUrl(input: unknown): string | null {
        if (typeof input !== 'string') {
            return null
        }
        const value = input.trim()
        if (!value) {
            return null
        }
        if (!value.startsWith('data:image/')) {
            throw new Error('Invalid avatar image payload.')
        }
        if (value.length > 2_000_000) {
            throw new Error('Avatar image is too large.')
        }
        return value
    }

    private parsePreferences(input: string | null): FirewireUserPreferencesPayload {
        if (!input) {
            return this.defaultPreferences()
        }

        try {
            return this.normalizePayload(JSON.parse(String(input)))
        } catch {
            return this.defaultPreferences()
        }
    }

    private defaultPreferences(): FirewireUserPreferencesPayload {
        return {
            homePage: {
                backgroundMode: 'video',
                backgroundVideo: 'fire1.mp4',
                showRecentProjects: true,
                compactHero: false,
                solidColor: '#08111b',
                gradientFrom: '#09111d',
                gradientTo: '#060a12',
                gradientAngle: 135
            },
            projectMap: {
                version: 1,
                style: 'night',
                dimension: '2d',
                showRoadDetails: true,
                showBuildingFootprints: true,
                autoFitPins: true
            },
            profile: {
                avatarDataUrl: null
            }
        }
    }

    private async getPool(): Promise<mssql.ConnectionPool> {
        const sql = this.app.locals.sqlserver as MsSqlServerDb
        if (!sql) {
            throw new Error('Missing sqlserver app local.')
        }
        return sql.init()
    }

    private toIso(input: Date | string | null): string | null {
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
