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
            ].join('\n');
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, projectId)
                .query(query);
            const row = (result.recordset || [])[0];
            return row ? this.mapSqlRow(row) : null;
        });
    }
    createFirewireProject(input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const normalized = this.normalizeInput(input);
            const projectId = (0, uuid_1.v4)();
            const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso();
            const pool = yield this.getPool();
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
            ].join('\n');
            yield pool.request()
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
                .query(query);
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
            const bidDueDate = normalized.bidDueDate || this.defaultBidDueDateIso();
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request()
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
                .query(query);
            if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
                return null;
            }
            return this.getFirewireProject(projectId);
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
    ensureTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
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
            ].join('\n');
            const alterQuery = [
                "IF COL_LENGTH('dbo.firewireProjects', 'fieldwireId') IS NULL",
                'BEGIN',
                "    ALTER TABLE dbo.firewireProjects ADD fieldwireId NVARCHAR(64) NULL;",
                'END;',
                "IF COL_LENGTH('dbo.firewireProjects', 'projectStatus') IS NULL",
                'BEGIN',
                "    ALTER TABLE dbo.firewireProjects ADD projectStatus NVARCHAR(100) NOT NULL CONSTRAINT DF_firewireProjects_projectStatus_existing DEFAULT N'Estimation';",
                'END;'
            ].join('\n');
            yield pool.request().batch(createQuery);
            yield pool.request().batch(alterQuery);
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
        return {
            fieldwireId: this.normalizeFieldwireId(input === null || input === void 0 ? void 0 : input.fieldwireId),
            name: this.requireString(input === null || input === void 0 ? void 0 : input.name, 'name', 200),
            projectNbr: this.requireString(input === null || input === void 0 ? void 0 : input.projectNbr, 'projectNbr', 100),
            address: this.optionalString(input === null || input === void 0 ? void 0 : input.address, 500),
            bidDueDate: this.normalizeDate(input === null || input === void 0 ? void 0 : input.bidDueDate),
            projectStatus: this.optionalString(input === null || input === void 0 ? void 0 : input.projectStatus, 100) || 'Estimation',
            salesman: this.optionalString(input === null || input === void 0 ? void 0 : input.salesman, 200),
            jobType: this.optionalString(input === null || input === void 0 ? void 0 : input.jobType, 100),
            scopeType: this.optionalString(input === null || input === void 0 ? void 0 : input.scopeType, 100),
            projectScope: this.optionalString(input === null || input === void 0 ? void 0 : input.projectScope, 4000),
            difficulty: this.optionalString(input === null || input === void 0 ? void 0 : input.difficulty, 100),
            totalSqFt: this.normalizeTotalSqFt(input === null || input === void 0 ? void 0 : input.totalSqFt)
        };
    }
    normalizeFieldwireId(input) {
        if (typeof input !== 'string') {
            return null;
        }
        const value = input.trim();
        return value ? value.slice(0, 64) : null;
    }
    normalizeProjectNbr(input) {
        if (typeof input !== 'string') {
            return '';
        }
        return input.trim().toLowerCase();
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
            bidDueDate: null,
            projectStatus: null,
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
            bidDueDate: firewireProject.bidDueDate,
            projectStatus: firewireProject.projectStatus,
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
}
exports.FirewireProjectRepository = FirewireProjectRepository;
