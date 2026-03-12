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
exports.FirewireProjectSettingsRepository = void 0;
const mssql = __importStar(require("mssql"));
const uuid_1 = require("uuid");
const DEFAULT_SETTINGS = [
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
];
class FirewireProjectSettingsRepository {
    constructor(app) {
        this.app = app;
    }
    listAll() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request().query(query);
            const rows = (result.recordset || []).map((row) => this.mapSqlRow(row));
            return {
                jobType: rows.filter((row) => row.listKey === 'jobType'),
                scopeType: rows.filter((row) => row.listKey === 'scopeType'),
                projectScope: rows.filter((row) => row.listKey === 'projectScope'),
                difficulty: rows.filter((row) => row.listKey === 'difficulty'),
                projectStatus: rows.filter((row) => row.listKey === 'projectStatus')
            };
        });
    }
    create(input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const normalized = this.normalizeInput(input, false);
            const uuid = (0, uuid_1.v4)();
            const pool = yield this.getPool();
            const query = [
                'INSERT INTO dbo.firewireProjectSettings (',
                '    uuid, listKey, label, description, sortOrder, isActive, createdBy, updatedBy',
                ') VALUES (',
                '    @uuid, @listKey, @label, @description, @sortOrder, @isActive, @createdBy, @updatedBy',
                ');'
            ].join('\n');
            yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, uuid)
                .input('listKey', mssql.NVarChar(50), normalized.listKey)
                .input('label', mssql.NVarChar(200), normalized.label)
                .input('description', mssql.NVarChar(1000), normalized.description)
                .input('sortOrder', mssql.Int, normalized.sortOrder)
                .input('isActive', mssql.Bit, normalized.isActive)
                .input('createdBy', mssql.NVarChar(256), userId)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
            const created = yield this.getById(uuid);
            if (!created) {
                throw new Error('Created setting could not be reloaded.');
            }
            return created;
        });
    }
    update(settingId, input, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(settingId)) {
                return null;
            }
            const normalized = this.normalizeInput(input, true);
            const pool = yield this.getPool();
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
            ].join('\n');
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, settingId)
                .input('listKey', mssql.NVarChar(50), normalized.listKey)
                .input('label', mssql.NVarChar(200), normalized.label)
                .input('description', mssql.NVarChar(1000), normalized.description)
                .input('sortOrder', mssql.Int, normalized.sortOrder)
                .input('isActive', mssql.Bit, normalized.isActive)
                .input('updatedBy', mssql.NVarChar(256), userId)
                .query(query);
            if (!result.rowsAffected || result.rowsAffected[0] <= 0) {
                return null;
            }
            return this.getById(settingId);
        });
    }
    remove(settingId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            if (!(0, uuid_1.validate)(settingId)) {
                return false;
            }
            const pool = yield this.getPool();
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, settingId)
                .query('DELETE FROM dbo.firewireProjectSettings WHERE uuid = @uuid;');
            return !!result.rowsAffected && result.rowsAffected[0] > 0;
        });
    }
    ensureTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
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
            ].join('\n');
            yield pool.request().batch(createQuery);
            for (const item of DEFAULT_SETTINGS) {
                const seedQuery = [
                    'IF NOT EXISTS (',
                    '    SELECT 1 FROM dbo.firewireProjectSettings WHERE listKey = @listKey AND label = @label',
                    ')',
                    'BEGIN',
                    '    INSERT INTO dbo.firewireProjectSettings (uuid, listKey, label, description, sortOrder, isActive, createdBy, updatedBy)',
                    '    VALUES (@uuid, @listKey, @label, @description, @sortOrder, 1, @createdBy, @updatedBy);',
                    'END;'
                ].join('\n');
                yield pool.request()
                    .input('uuid', mssql.UniqueIdentifier, (0, uuid_1.v4)())
                    .input('listKey', mssql.NVarChar(50), item.listKey)
                    .input('label', mssql.NVarChar(200), item.label)
                    .input('description', mssql.NVarChar(1000), item.description)
                    .input('sortOrder', mssql.Int, item.sortOrder)
                    .input('createdBy', mssql.NVarChar(256), 'system')
                    .input('updatedBy', mssql.NVarChar(256), 'system')
                    .query(seedQuery);
            }
        });
    }
    getById(settingId) {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
            const result = yield pool.request()
                .input('uuid', mssql.UniqueIdentifier, settingId)
                .query([
                'SELECT',
                '    uuid, listKey, label, description, sortOrder, isActive, createdAt, createdBy, updatedAt, updatedBy',
                'FROM dbo.firewireProjectSettings',
                'WHERE uuid = @uuid;'
            ].join('\n'));
            const row = (result.recordset || [])[0];
            return row ? this.mapSqlRow(row) : null;
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
    normalizeInput(input, allowInactiveDefault) {
        const listKey = this.normalizeListKey(input === null || input === void 0 ? void 0 : input.listKey);
        const label = this.requireString(input === null || input === void 0 ? void 0 : input.label, 'label', 200);
        const description = this.optionalString(input === null || input === void 0 ? void 0 : input.description, 1000);
        const sortOrder = this.normalizeSortOrder(input === null || input === void 0 ? void 0 : input.sortOrder);
        const isActive = typeof (input === null || input === void 0 ? void 0 : input.isActive) === 'boolean' ? input.isActive : allowInactiveDefault ? true : true;
        return {
            listKey,
            label,
            description,
            sortOrder,
            isActive
        };
    }
    normalizeListKey(input) {
        if (input === 'jobType' || input === 'scopeType' || input === 'projectScope' || input === 'difficulty' || input === 'projectStatus') {
            return input;
        }
        throw new Error('Invalid listKey value.');
    }
    normalizeSortOrder(input) {
        const value = Number(input);
        if (!Number.isFinite(value)) {
            return 0;
        }
        return Math.trunc(value);
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
    mapSqlRow(row) {
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
exports.FirewireProjectSettingsRepository = FirewireProjectSettingsRepository;
