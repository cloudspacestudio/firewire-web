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
exports.FirewireUserPreferencesRepository = void 0;
const mssql = __importStar(require("mssql"));
class FirewireUserPreferencesRepository {
    constructor(app) {
        this.app = app;
    }
    getUserPreferences(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const pool = yield this.getPool();
            const query = [
                'SELECT userId, preferencesJson, createdAt, createdBy, updatedAt, updatedBy',
                'FROM dbo.firewireUserPreferences',
                'WHERE userId = @userId;'
            ].join('\n');
            const result = yield pool.request()
                .input('userId', mssql.NVarChar(256), userId)
                .query(query);
            const row = (result.recordset || [])[0];
            if (!row) {
                return {
                    userId,
                    preferences: this.defaultPreferences(),
                    createdAt: null,
                    createdBy: null,
                    updatedAt: null,
                    updatedBy: null
                };
            }
            return {
                userId: row.userId,
                preferences: this.parsePreferences(row.preferencesJson),
                createdAt: this.toIso(row.createdAt),
                createdBy: row.createdBy || null,
                updatedAt: this.toIso(row.updatedAt),
                updatedBy: row.updatedBy || null
            };
        });
    }
    saveUserPreferences(userId, payload, actorUserId) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.ensureTable();
            const normalized = this.normalizePayload(payload);
            const pool = yield this.getPool();
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
            ].join('\n');
            yield pool.request()
                .input('userId', mssql.NVarChar(256), userId)
                .input('preferencesJson', mssql.NVarChar(mssql.MAX), JSON.stringify(normalized))
                .input('createdBy', mssql.NVarChar(256), actorUserId)
                .input('updatedBy', mssql.NVarChar(256), actorUserId)
                .query(query);
            return this.getUserPreferences(userId);
        });
    }
    ensureTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const pool = yield this.getPool();
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
            ].join('\n');
            yield pool.request().batch(query);
        });
    }
    normalizePayload(payload) {
        const defaults = this.defaultPreferences();
        const homePage = (payload === null || payload === void 0 ? void 0 : payload.homePage) && typeof payload.homePage === 'object' ? payload.homePage : defaults.homePage;
        const profile = (payload === null || payload === void 0 ? void 0 : payload.profile) && typeof payload.profile === 'object' ? payload.profile : defaults.profile;
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
            profile: {
                avatarDataUrl: this.normalizeAvatarDataUrl(profile.avatarDataUrl)
            }
        };
    }
    normalizeBackgroundMode(input) {
        if (input === 'solid' || input === 'gradient') {
            return String(input);
        }
        return 'video';
    }
    normalizeBackgroundVideo(input) {
        if (typeof input !== 'string') {
            return 'fire1.mp4';
        }
        const value = input.trim();
        if (/^[^\\/:*?"<>|]+\.(mp4|mov|webm)$/i.test(value)) {
            return value;
        }
        if (/^fire1$/i.test(value)) {
            return 'fire1.mp4';
        }
        if (/^fire2$/i.test(value)) {
            return 'fire2.mp4';
        }
        if (/^ps3$/i.test(value)) {
            return 'ps3.mp4';
        }
        const mediaMatch = /^media([0-9]+)$/i.exec(value);
        if (mediaMatch) {
            return `Media${mediaMatch[1]}.mp4`;
        }
        return 'fire1.mp4';
    }
    normalizeHexColor(input, fallback) {
        if (typeof input !== 'string') {
            return fallback;
        }
        const value = input.trim();
        if (/^#[0-9a-fA-F]{6}$/.test(value)) {
            return value;
        }
        return fallback;
    }
    normalizeAngle(input) {
        const value = Number(input);
        if (!Number.isFinite(value)) {
            return 135;
        }
        return Math.max(0, Math.min(360, Math.round(value)));
    }
    normalizeAvatarDataUrl(input) {
        if (typeof input !== 'string') {
            return null;
        }
        const value = input.trim();
        if (!value) {
            return null;
        }
        if (!value.startsWith('data:image/')) {
            throw new Error('Invalid avatar image payload.');
        }
        if (value.length > 2000000) {
            throw new Error('Avatar image is too large.');
        }
        return value;
    }
    parsePreferences(input) {
        if (!input) {
            return this.defaultPreferences();
        }
        try {
            return this.normalizePayload(JSON.parse(String(input)));
        }
        catch (_a) {
            return this.defaultPreferences();
        }
    }
    defaultPreferences() {
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
            profile: {
                avatarDataUrl: null
            }
        };
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
exports.FirewireUserPreferencesRepository = FirewireUserPreferencesRepository;
