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
exports.FirewireProjectRepository = void 0;
const mssql = __importStar(require("mssql"));
const uuid_1 = require("uuid");
const FIREWIRE_PROJECT_TYPES = ['Fire Alarm', 'Sprinkler', 'Security'];
const DEFAULT_FIREWIRE_PROJECT_TYPE = 'Fire Alarm';
const DEFAULT_GEOCODE_STATUS = 'Not Configured';
class FirewireProjectRepository {
    constructor(app) {
        this.app = app;
    }
    listCombined() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const firewireProjects = yield this.listFirewireProjects();
            const fieldwire = this.app.locals.fieldwire;
            const fieldwireProjects = yield fieldwire.accountProjects();
            const firewireByFieldwireId = new Map();
            const firewireByProjectNbr = new Map();
            const consumedFirewireIds = new Set();
            const combined = [];
            for (const firewireProject of firewireProjects) {
                if (firewireProject.fieldwireId) {
                    firewireByFieldwireId.set(firewireProject.fieldwireId, firewireProject);
                }
                const normalizedProjectNbr = this.normalizeProjectNbr(firewireProject.projectNbr);
                if (normalizedProjectNbr && !firewireByProjectNbr.has(normalizedProjectNbr)) {
                    firewireByProjectNbr.set(normalizedProjectNbr, firewireProject);
                }
            }
            for (const fieldwireProject of fieldwireProjects) {
                const fieldwireProjectId = (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.id) ? String(fieldwireProject.id) : '';
                if (!fieldwireProjectId) {
                    continue;
                }
                const explicitFirewire = firewireByFieldwireId.get(fieldwireProjectId);
                if (explicitFirewire) {
                    consumedFirewireIds.add(explicitFirewire.uuid);
                    combined.push(this.mapMergedProjectToListItem(fieldwireProject, explicitFirewire));
                    continue;
                }
                const normalizedProjectNbr = this.normalizeProjectNbr(fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.code);
                const matchedByProjectNbr = normalizedProjectNbr ? firewireByProjectNbr.get(normalizedProjectNbr) : null;
                if (matchedByProjectNbr && !consumedFirewireIds.has(matchedByProjectNbr.uuid)) {
                    consumedFirewireIds.add(matchedByProjectNbr.uuid);
                    combined.push(this.mapMergedProjectToListItem(fieldwireProject, matchedByProjectNbr));
                    continue;
                }
                combined.push(this.mapFieldwireProjectToListItem(fieldwireProject));
            }
            for (const firewireProject of firewireProjects) {
                if (consumedFirewireIds.has(firewireProject.uuid)) {
                    continue;
                }
                combined.push(this.mapFirewireProjectToListItem(firewireProject));
            }
            return combined.sort((left, right) => {
                const leftTime = left.updatedAt ? Date.parse(left.updatedAt) : 0;
                const rightTime = right.updatedAt ? Date.parse(right.updatedAt) : 0;
                if (leftTime !== rightTime) {
                    return rightTime - leftTime;
                }
                return left.name.localeCompare(right.name);
            });
        });
    }
    listFirewireProjects() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request().query(query);
            return (result.recordset || []).map((row) => this.mapSqlRow(row));
        });
    }
    getFirewireProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(projectId)) {
                return null;
            }
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, projectId)
                .query(query);
            const row = (result.recordset || [])[0];
            if (!row) {
                return null;
            }
            const project = this.mapSqlRow(row);
            project.worksheetData = yield this.getWorksheetData(projectId);
            return project;
        });
    }
    createFirewireProject(input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const normalized = this.normalizeInput(input);
            const projectId = (0, uuid_1.v4)();
            const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso();
            const geocode = yield this.resolveProjectGeocode(normalized.address);
            const resolvedAddress = geocode.address || normalized.address;
            const pool = yield this.getPool();
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
            ].join('\n');
            yield pool.request()
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
                .query(query);
            if (typeof normalized.worksheetData !== 'undefined') {
                yield this.upsertWorksheetData(projectId, normalized.worksheetData, userId);
            }
            const created = yield this.getFirewireProject(projectId);
            if (!created) {
                throw new Error('Created project could not be reloaded.');
            }
            return created;
        });
    }
    updateFirewireProject(projectId, input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(projectId)) {
                return null;
            }
            const normalized = this.normalizeInput(input);
            const existingProject = yield this.getFirewireProject(projectId);
            if (!existingProject) {
                return null;
            }
            if (existingProject.projectStatus !== 'Estimation' && normalized.projectType !== existingProject.projectType) {
                throw new Error('projectType cannot be changed after a project leaves Estimation.');
            }
            const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso();
            const geocode = yield this.resolveProjectGeocode(normalized.address, existingProject);
            const resolvedAddress = geocode.address || normalized.address;
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request()
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
                .query(query);
            if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
                return null;
            }
            if (typeof normalized.worksheetData !== 'undefined') {
                yield this.upsertWorksheetData(projectId, normalized.worksheetData, userId);
            }
            return this.getFirewireProject(projectId);
        });
    }
    deleteFirewireProject(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(projectId)) {
                return false;
            }
            const existingProject = yield this.getFirewireProject(projectId);
            if (!existingProject) {
                return false;
            }
            const pool = yield this.getPool();
            yield pool.request()
                .input('projectId', mssql.UniqueIdentifier, projectId)
                .query('DELETE FROM dbo.firewireProjectWorksheets WHERE projectId = @projectId;');
            yield pool.request()
                .input('workspaceKey', mssql.NVarChar(200), projectId)
                .query([
                "IF OBJECT_ID(N'dbo.workspaceStorage', N'U') IS NOT NULL",
                'BEGIN',
                "    DELETE FROM dbo.workspaceStorage WHERE [area] = N'project-doc-library' AND [workspaceKey] = @workspaceKey;",
                'END;'
            ].join('\n'));
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, projectId)
                .query('DELETE FROM dbo.firewireProjects WHERE uuid = @uuid;');
            return !!result.rowsAffected && result.rowsAffected[0] > 0;
        });
    }
    updateFieldwireMapping(projectId, input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(projectId)) {
                return null;
            }
            const normalizedFieldwireId = this.normalizeFieldwireId(input === null || input === void 0 ? void 0 : input.fieldwireId);
            const pool = yield this.getPool();
            const query = [
                'UPDATE dbo.firewireProjects',
                'SET',
                '    fieldwireId = @fieldwireId,',
                '    updatedAt = SYSUTCDATETIME(),',
                '    updatedBy = @updatedBy',
                'WHERE uuid = @uuid;'
            ].join('\n');
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, projectId)
                .input('fieldwireId', mssql.NVarChar(64), normalizedFieldwireId)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
            if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
                return null;
            }
            return this.getFirewireProject(projectId);
        });
    }
    updateManualLock(projectId, isLocked, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(projectId)) {
                return null;
            }
            const pool = yield this.getPool();
            const query = [
                'UPDATE dbo.firewireProjects',
                'SET',
                '    isManualLocked = @isManualLocked,',
                '    manualLockedAt = CASE WHEN @isManualLocked = 1 THEN SYSUTCDATETIME() ELSE NULL END,',
                '    manualLockedBy = CASE WHEN @isManualLocked = 1 THEN @manualLockedBy ELSE NULL END,',
                '    updatedAt = SYSUTCDATETIME(),',
                '    updatedBy = @updatedBy',
                'WHERE uuid = @uuid;'
            ].join('\n');
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, projectId)
                .input('isManualLocked', mssql.Bit, isLocked ? 1 : 0)
                .input('manualLockedBy', mssql.NVarChar(256), isLocked ? userId : null)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
            if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
                return null;
            }
            return this.getFirewireProject(projectId);
        });
    }
    listProjectTemplates(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request()
                .input('publicVisibility', mssql.NVarChar(20), 'Public')
                .input('ownerUserId', mssql.NVarChar(256), userId)
                .query(query);
            return (result.recordset || []).map((row) => this.mapTemplateRow(row));
        });
    }
    saveProjectTemplate(input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const normalized = this.normalizeTemplateInput(input);
            const pool = yield this.getPool();
            const templateId = normalized.templateId && (0, uuid_1.validate)(normalized.templateId)
                ? normalized.templateId
                : (0, uuid_1.v4)();
            const templateJson = JSON.stringify({
                firewireForm: normalized.firewireForm || {},
                worksheetData: typeof normalized.worksheetData === 'undefined' ? null : normalized.worksheetData
            });
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
            ].join('\n');
            const result = yield pool.request()
                .input('templateId', mssql.UniqueIdentifier, templateId)
                .input('name', mssql.NVarChar(200), normalized.name)
                .input('visibility', mssql.NVarChar(20), normalized.visibility)
                .input('ownerUserId', mssql.NVarChar(256), userId)
                .input('templateJson', mssql.NVarChar(mssql.MAX), templateJson)
                .input('createdBy', mssql.NVarChar(256), userId)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
            const row = (result.recordset || [])[0];
            if (!row) {
                throw new Error('Template save failed.');
            }
            return this.mapTemplateRow(row);
        });
    }
    ensureTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
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
            ].join('\n');
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
            ].join('\n');
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
            ].join('\n');
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
            ].join('\n');
            const backfillProjectTypeQuery = [
                "IF COL_LENGTH('dbo.firewireProjects', 'projectType') IS NOT NULL",
                'BEGIN',
                `    EXEC(N'UPDATE dbo.firewireProjects SET projectType = N''${DEFAULT_FIREWIRE_PROJECT_TYPE}'' WHERE projectType IS NULL OR LTRIM(RTRIM(projectType)) = N'''';');`,
                'END;'
            ].join('\n');
            yield pool.request().batch(createQuery);
            yield pool.request().batch(worksheetQuery);
            yield pool.request().batch(templateQuery);
            yield pool.request().batch(alterQuery);
            yield pool.request().batch(backfillProjectTypeQuery);
        });
    }
    getPool() {
        return __awaiter(this, void 0, void 0, function* () {
            const sql = this.app.locals.sqlserver;
            if (!sql) {
                throw new Error('Missing sqlserver app local.');
            }
            return sql.init();
        });
    }
    normalizeInput(input) {
        const normalizedProjectStatus = this.optionalString(input === null || input === void 0 ? void 0 : input.projectStatus, 100) || 'Estimation';
        return {
            fieldwireId: this.normalizeFieldwireId(input === null || input === void 0 ? void 0 : input.fieldwireId),
            worksheetData: this.normalizeWorksheetData(input === null || input === void 0 ? void 0 : input.worksheetData),
            name: this.requireString(input === null || input === void 0 ? void 0 : input.name, 'name', 200),
            projectNbr: this.normalizeProjectNbrInput(input === null || input === void 0 ? void 0 : input.projectNbr),
            address: this.optionalString(input === null || input === void 0 ? void 0 : input.address, 500),
            bidDueDate: this.normalizeDate(input === null || input === void 0 ? void 0 : input.bidDueDate),
            projectStatus: normalizedProjectStatus,
            projectType: this.normalizeProjectType(input === null || input === void 0 ? void 0 : input.projectType),
            salesman: this.optionalString(input === null || input === void 0 ? void 0 : input.salesman, 200),
            jobType: this.optionalString(input === null || input === void 0 ? void 0 : input.jobType, 100),
            scopeType: this.optionalString(input === null || input === void 0 ? void 0 : input.scopeType, 100),
            projectScope: this.optionalString(input === null || input === void 0 ? void 0 : input.projectScope, 4000),
            difficulty: this.optionalString(input === null || input === void 0 ? void 0 : input.difficulty, 100),
            totalSqFt: this.normalizeTotalSqFt(input === null || input === void 0 ? void 0 : input.totalSqFt)
        };
    }
    normalizeProjectNbrInput(input) {
        return this.optionalString(input, 100);
    }
    resolveProjectGeocode(address, existingProject) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j;
            const normalizedAddress = this.optionalString(address, 500);
            const existingAddress = this.optionalString(existingProject === null || existingProject === void 0 ? void 0 : existingProject.address, 500);
            const addressChanged = normalizedAddress.toLowerCase() !== existingAddress.toLowerCase();
            const hasExistingMappedCoordinates = typeof (existingProject === null || existingProject === void 0 ? void 0 : existingProject.latitude) === 'number' && typeof (existingProject === null || existingProject === void 0 ? void 0 : existingProject.longitude) === 'number';
            if (!normalizedAddress) {
                return {
                    address: null,
                    latitude: null,
                    longitude: null,
                    geocodeStatus: 'Missing Address',
                    geocodedAt: null
                };
            }
            if (existingProject && !addressChanged && hasExistingMappedCoordinates && existingProject.geocodeStatus === 'Mapped') {
                return {
                    address: existingProject.address || normalizedAddress,
                    latitude: existingProject.latitude,
                    longitude: existingProject.longitude,
                    geocodeStatus: existingProject.geocodeStatus || 'Mapped',
                    geocodedAt: existingProject.geocodedAt || null
                };
            }
            const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim();
            if (!subscriptionKey) {
                return {
                    address: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.address) || normalizedAddress,
                    latitude: (_a = existingProject === null || existingProject === void 0 ? void 0 : existingProject.latitude) !== null && _a !== void 0 ? _a : null,
                    longitude: (_b = existingProject === null || existingProject === void 0 ? void 0 : existingProject.longitude) !== null && _b !== void 0 ? _b : null,
                    geocodeStatus: DEFAULT_GEOCODE_STATUS,
                    geocodedAt: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.geocodedAt) || null
                };
            }
            const apiVersion = (process.env.AZURE_MAPS_API_VERSION || '1.0').trim();
            const baseUrl = (process.env.AZURE_MAPS_BASE_URL || 'https://atlas.microsoft.com').trim().replace(/\/$/, '');
            const url = `${baseUrl}/search/address/json?api-version=${encodeURIComponent(apiVersion)}&subscription-key=${encodeURIComponent(subscriptionKey)}&query=${encodeURIComponent(normalizedAddress)}&limit=1`;
            try {
                const response = yield fetch(url, {
                    method: 'GET',
                    headers: {
                        Accept: 'application/json'
                    }
                });
                if (!response.ok) {
                    return {
                        address: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.address) || normalizedAddress,
                        latitude: (_c = existingProject === null || existingProject === void 0 ? void 0 : existingProject.latitude) !== null && _c !== void 0 ? _c : null,
                        longitude: (_d = existingProject === null || existingProject === void 0 ? void 0 : existingProject.longitude) !== null && _d !== void 0 ? _d : null,
                        geocodeStatus: 'Error',
                        geocodedAt: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.geocodedAt) || null
                    };
                }
                const payload = yield response.json();
                const bestResult = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.results) ? payload.results[0] : null;
                const standardizedAddress = this.optionalString((_e = bestResult === null || bestResult === void 0 ? void 0 : bestResult.address) === null || _e === void 0 ? void 0 : _e.freeformAddress, 500)
                    || this.buildStandardizedAddress(bestResult === null || bestResult === void 0 ? void 0 : bestResult.address)
                    || normalizedAddress;
                const latitude = (_f = bestResult === null || bestResult === void 0 ? void 0 : bestResult.position) === null || _f === void 0 ? void 0 : _f.lat;
                const longitude = (_g = bestResult === null || bestResult === void 0 ? void 0 : bestResult.position) === null || _g === void 0 ? void 0 : _g.lon;
                if (typeof latitude !== 'number' || typeof longitude !== 'number') {
                    return {
                        address: normalizedAddress,
                        latitude: null,
                        longitude: null,
                        geocodeStatus: 'Not Found',
                        geocodedAt: new Date().toISOString()
                    };
                }
                if (this.requiresAddressVerification(normalizedAddress, bestResult === null || bestResult === void 0 ? void 0 : bestResult.address, standardizedAddress)) {
                    return {
                        address: normalizedAddress,
                        latitude: null,
                        longitude: null,
                        geocodeStatus: 'Needs Verification',
                        geocodedAt: new Date().toISOString()
                    };
                }
                return {
                    address: standardizedAddress,
                    latitude,
                    longitude,
                    geocodeStatus: 'Mapped',
                    geocodedAt: new Date().toISOString()
                };
            }
            catch (_k) {
                return {
                    address: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.address) || normalizedAddress,
                    latitude: (_h = existingProject === null || existingProject === void 0 ? void 0 : existingProject.latitude) !== null && _h !== void 0 ? _h : null,
                    longitude: (_j = existingProject === null || existingProject === void 0 ? void 0 : existingProject.longitude) !== null && _j !== void 0 ? _j : null,
                    geocodeStatus: 'Error',
                    geocodedAt: (existingProject === null || existingProject === void 0 ? void 0 : existingProject.geocodedAt) || null
                };
            }
        });
    }
    buildStandardizedAddress(address) {
        const streetNumber = this.optionalString(address === null || address === void 0 ? void 0 : address.streetNumber, 50);
        const streetName = this.optionalString(address === null || address === void 0 ? void 0 : address.streetName, 200);
        const municipality = this.optionalString(address === null || address === void 0 ? void 0 : address.municipality, 120);
        const countrySubdivision = this.optionalString(address === null || address === void 0 ? void 0 : address.countrySubdivision, 120);
        const postalCode = this.optionalString(address === null || address === void 0 ? void 0 : address.postalCode, 32);
        const street = [streetNumber, streetName].filter((value) => value).join(' ').trim();
        const locality = [municipality, countrySubdivision, postalCode].filter((value) => value).join(', ').replace(/, (?=[^,]+$)/, ' ');
        return [street, locality].filter((value) => value).join(', ').trim();
    }
    requiresAddressVerification(inputAddress, resultAddress, standardizedAddress) {
        const inputStreetNumber = this.extractStreetNumber(inputAddress);
        if (!inputStreetNumber) {
            return false;
        }
        const resultStreetNumber = this.optionalString(resultAddress === null || resultAddress === void 0 ? void 0 : resultAddress.streetNumber, 50)
            || this.extractStreetNumber(standardizedAddress);
        return !resultStreetNumber || resultStreetNumber !== inputStreetNumber;
    }
    extractStreetNumber(address) {
        const match = /^\s*(\d+[A-Za-z\-]*)\b/.exec(String(address || '').trim());
        return (match === null || match === void 0 ? void 0 : match[1]) || '';
    }
    normalizeFieldwireId(input) {
        if (typeof input !== 'string') {
            return null;
        }
        const value = input.trim();
        return value ? value.slice(0, 64) : null;
    }
    normalizeWorksheetData(input) {
        if (typeof input === 'undefined') {
            return undefined;
        }
        if (input === null) {
            return null;
        }
        try {
            return JSON.parse(JSON.stringify(input));
        }
        catch (_a) {
            throw new Error('Invalid worksheetData payload.');
        }
    }
    normalizeTemplateInput(input) {
        return {
            templateId: this.normalizeOptionalUuid(input === null || input === void 0 ? void 0 : input.templateId),
            name: this.requireString(input === null || input === void 0 ? void 0 : input.name, 'name', 200),
            visibility: (input === null || input === void 0 ? void 0 : input.visibility) === 'Public' ? 'Public' : 'Private',
            firewireForm: this.normalizeTemplateFirewireForm(input === null || input === void 0 ? void 0 : input.firewireForm),
            worksheetData: this.normalizeWorksheetData(input === null || input === void 0 ? void 0 : input.worksheetData)
        };
    }
    normalizeTemplateFirewireForm(input) {
        if (!input || typeof input !== 'object') {
            return {};
        }
        return {
            projectType: this.normalizeProjectType(input.projectType),
            jobType: this.optionalString(input.jobType, 100),
            scopeType: this.optionalString(input.scopeType, 100),
            projectScope: this.optionalString(input.projectScope, 4000),
            difficulty: this.optionalString(input.difficulty, 100)
        };
    }
    normalizeOptionalUuid(input) {
        if (typeof input !== 'string') {
            return null;
        }
        const value = input.trim();
        return value && (0, uuid_1.validate)(value) ? value : null;
    }
    normalizeProjectNbr(input) {
        if (typeof input !== 'string') {
            return '';
        }
        return input.trim().toLowerCase();
    }
    normalizeProjectType(input) {
        const value = typeof input === 'string' ? input.trim() : '';
        const matched = FIREWIRE_PROJECT_TYPES.find((item) => item === value);
        if (matched) {
            return matched;
        }
        if (!value) {
            return DEFAULT_FIREWIRE_PROJECT_TYPE;
        }
        throw new Error(`Invalid projectType. Allowed values: ${FIREWIRE_PROJECT_TYPES.join(', ')}.`);
    }
    normalizeDate(input) {
        if (!input) {
            return null;
        }
        const parsed = new Date(input);
        if (Number.isNaN(parsed.getTime())) {
            throw new Error('Invalid bidDueDate value.');
        }
        return parsed.toISOString();
    }
    normalizeTotalSqFt(input) {
        const value = Number(input);
        if (!Number.isFinite(value) || value < 0) {
            throw new Error('totalSqFt must be a non-negative number.');
        }
        return Math.round(value * 100) / 100;
    }
    requireString(input, fieldName, maxLength) {
        const value = this.optionalString(input, maxLength);
        if (!value) {
            throw new Error('Missing ' + fieldName + '.');
        }
        return value;
    }
    optionalString(input, maxLength) {
        if (typeof input !== 'string') {
            return '';
        }
        return input.trim().slice(0, maxLength);
    }
    defaultBidDueDateIso() {
        const value = new Date();
        value.setUTCDate(value.getUTCDate() + 30);
        return value.toISOString();
    }
    mapSqlRow(row) {
        const geocodeStatus = row.geocodeStatus || null;
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
        };
    }
    getWorksheetData(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
            const query = [
                'SELECT projectId, worksheetJson',
                'FROM dbo.firewireProjectWorksheets',
                'WHERE projectId = @projectId;'
            ].join('\n');
            const result = yield pool.request()
                .input('projectId', mssql.UniqueIdentifier, projectId)
                .query(query);
            const row = (result.recordset || [])[0];
            if (!(row === null || row === void 0 ? void 0 : row.worksheetJson)) {
                return null;
            }
            try {
                return JSON.parse(String(row.worksheetJson));
            }
            catch (_a) {
                return null;
            }
        });
    }
    upsertWorksheetData(projectId, worksheetData, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
            if (worksheetData === null) {
                yield pool.request()
                    .input('projectId', mssql.UniqueIdentifier, projectId)
                    .query('DELETE FROM dbo.firewireProjectWorksheets WHERE projectId = @projectId;');
                return;
            }
            const worksheetJson = JSON.stringify(worksheetData);
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
            ].join('\n');
            yield pool.request()
                .input('projectId', mssql.UniqueIdentifier, projectId)
                .input('worksheetJson', mssql.NVarChar(mssql.MAX), worksheetJson)
                .input('createdBy', mssql.NVarChar(256), userId)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
        });
    }
    mapTemplateRow(row) {
        let templateData = {
            firewireForm: {},
            worksheetData: null
        };
        if (row.templateJson) {
            try {
                const parsed = JSON.parse(String(row.templateJson));
                templateData = {
                    firewireForm: (parsed === null || parsed === void 0 ? void 0 : parsed.firewireForm) && typeof parsed.firewireForm === 'object' ? parsed.firewireForm : {},
                    worksheetData: typeof (parsed === null || parsed === void 0 ? void 0 : parsed.worksheetData) === 'undefined' ? null : parsed.worksheetData
                };
            }
            catch (_a) {
                templateData = {
                    firewireForm: {},
                    worksheetData: null
                };
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
        };
    }
    mapFieldwireProjectToListItem(project) {
        const fieldwireProjectId = (project === null || project === void 0 ? void 0 : project.id) ? String(project.id) : null;
        return {
            projectSource: 'fieldwire',
            fieldwireProjectId,
            firewireProjectId: null,
            fieldwireId: fieldwireProjectId,
            mappedFieldwireProjectName: (project === null || project === void 0 ? void 0 : project.name) || '',
            name: (project === null || project === void 0 ? void 0 : project.name) || '',
            projectNbr: (project === null || project === void 0 ? void 0 : project.code) || '',
            address: (project === null || project === void 0 ? void 0 : project.address) || '',
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
            createdAt: this.toIso(project === null || project === void 0 ? void 0 : project.created_at),
            createdBy: null,
            updatedAt: this.toIso(project === null || project === void 0 ? void 0 : project.updated_at),
            updatedBy: null
        };
    }
    mapFirewireProjectToListItem(project) {
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
        };
    }
    mapMergedProjectToListItem(fieldwireProject, firewireProject) {
        const fieldwireProjectId = (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.id) ? String(fieldwireProject.id) : firewireProject.fieldwireId;
        return {
            projectSource: 'both',
            fieldwireProjectId,
            firewireProjectId: firewireProject.uuid,
            fieldwireId: firewireProject.fieldwireId,
            mappedFieldwireProjectName: (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.name) || firewireProject.name,
            name: firewireProject.name || (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.name) || '',
            projectNbr: firewireProject.projectNbr || (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.code) || '',
            address: firewireProject.address || (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.address) || '',
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
            createdAt: firewireProject.createdAt || this.toIso(fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.created_at),
            createdBy: firewireProject.createdBy,
            updatedAt: firewireProject.updatedAt || this.toIso(fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.updated_at),
            updatedBy: firewireProject.updatedBy
        };
    }
    toIso(input) {
        if (!input) {
            return null;
        }
        const value = input instanceof Date ? input : new Date(String(input));
        if (Number.isNaN(value.getTime())) {
            return null;
        }
        return value.toISOString();
    }
    addressNeedsVerification(geocodeStatus) {
        return !!geocodeStatus && geocodeStatus !== 'Mapped';
    }
}
exports.FirewireProjectRepository = FirewireProjectRepository;
