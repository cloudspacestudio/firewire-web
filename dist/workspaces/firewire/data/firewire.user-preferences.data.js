"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirewireUserPreferencesData = void 0;
const firewireuserpreferences_repository_1 = require("../repository/firewireuserpreferences.repository");
class FirewireUserPreferencesData {
}
exports.FirewireUserPreferencesData = FirewireUserPreferencesData;
_a = FirewireUserPreferencesData;
FirewireUserPreferencesData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/user-preferences',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const repository = new firewireuserpreferences_repository_1.FirewireUserPreferencesRepository(req.app);
                    const result = yield repository.getUserPreferences(userId);
                    return res.status(200).json({
                        data: sanitizePreferencesRecord(result)
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    {
        method: 'put',
        path: '/api/firewire/user-preferences',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const payload = normalizePayload(req.body);
                    const repository = new firewireuserpreferences_repository_1.FirewireUserPreferencesRepository(req.app);
                    const result = yield repository.saveUserPreferences(userId, payload, userId);
                    return res.status(200).json({
                        data: sanitizePreferencesRecord(result)
                    });
                }
                catch (err) {
                    const statusCode = isValidationError(err) ? 400 : 500;
                    return res.status(statusCode).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    {
        method: 'post',
        path: '/api/firewire/user-preferences/workspace-lock/verify',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const userId = resolveUserId(req);
                    const repository = new firewireuserpreferences_repository_1.FirewireUserPreferencesRepository(req.app);
                    const valid = yield repository.verifyWorkspacePin(userId, String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.pin) || ''));
                    return res.status(200).json({
                        data: { valid }
                    });
                }
                catch (err) {
                    const statusCode = isValidationError(err) ? 400 : 500;
                    return res.status(statusCode).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    {
        method: 'put',
        path: '/api/firewire/user-preferences/workspace-lock/pin',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c;
                try {
                    const userId = resolveUserId(req);
                    const repository = new firewireuserpreferences_repository_1.FirewireUserPreferencesRepository(req.app);
                    const result = yield repository.saveWorkspacePin(userId, String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.newPin) || ''), userId, typeof ((_c = req.body) === null || _c === void 0 ? void 0 : _c.currentPin) === 'string' ? req.body.currentPin : null);
                    return res.status(200).json({
                        data: sanitizePreferencesRecord(result)
                    });
                }
                catch (err) {
                    const statusCode = isValidationError(err) ? 400 : 500;
                    return res.status(statusCode).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    }
];
FirewireUserPreferencesData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => {
    const normalizedMethod = item.method.toLowerCase();
    const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
        ? normalizedMethod
        : 'get';
    return Object.assign(Object.assign({}, item), { method, path: item.path.replace('/api/firewire/', '/api/fieldwire/') });
});
function normalizePayload(body) {
    var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
    return {
        homePage: {
            backgroundMode: (_b = body === null || body === void 0 ? void 0 : body.homePage) === null || _b === void 0 ? void 0 : _b.backgroundMode,
            backgroundVideo: (_c = body === null || body === void 0 ? void 0 : body.homePage) === null || _c === void 0 ? void 0 : _c.backgroundVideo,
            showRecentProjects: (_d = body === null || body === void 0 ? void 0 : body.homePage) === null || _d === void 0 ? void 0 : _d.showRecentProjects,
            compactHero: (_e = body === null || body === void 0 ? void 0 : body.homePage) === null || _e === void 0 ? void 0 : _e.compactHero,
            solidColor: (_f = body === null || body === void 0 ? void 0 : body.homePage) === null || _f === void 0 ? void 0 : _f.solidColor,
            gradientFrom: (_g = body === null || body === void 0 ? void 0 : body.homePage) === null || _g === void 0 ? void 0 : _g.gradientFrom,
            gradientTo: (_h = body === null || body === void 0 ? void 0 : body.homePage) === null || _h === void 0 ? void 0 : _h.gradientTo,
            gradientAngle: (_j = body === null || body === void 0 ? void 0 : body.homePage) === null || _j === void 0 ? void 0 : _j.gradientAngle
        },
        projectMap: {
            version: (_k = body === null || body === void 0 ? void 0 : body.projectMap) === null || _k === void 0 ? void 0 : _k.version,
            style: (_l = body === null || body === void 0 ? void 0 : body.projectMap) === null || _l === void 0 ? void 0 : _l.style,
            dimension: (_m = body === null || body === void 0 ? void 0 : body.projectMap) === null || _m === void 0 ? void 0 : _m.dimension,
            showRoadDetails: (_o = body === null || body === void 0 ? void 0 : body.projectMap) === null || _o === void 0 ? void 0 : _o.showRoadDetails,
            showBuildingFootprints: (_p = body === null || body === void 0 ? void 0 : body.projectMap) === null || _p === void 0 ? void 0 : _p.showBuildingFootprints,
            autoFitPins: (_q = body === null || body === void 0 ? void 0 : body.projectMap) === null || _q === void 0 ? void 0 : _q.autoFitPins
        },
        profile: {
            avatarDataUrl: (_r = body === null || body === void 0 ? void 0 : body.profile) === null || _r === void 0 ? void 0 : _r.avatarDataUrl
        },
        workspaceLock: {
            hasPin: (_s = body === null || body === void 0 ? void 0 : body.workspaceLock) === null || _s === void 0 ? void 0 : _s.hasPin
        }
    };
}
function sanitizePreferencesRecord(record) {
    var _b, _c;
    return Object.assign(Object.assign({}, record), { preferences: Object.assign(Object.assign({}, record.preferences), { workspaceLock: {
                hasPin: !!((_c = (_b = record === null || record === void 0 ? void 0 : record.preferences) === null || _b === void 0 ? void 0 : _b.workspaceLock) === null || _c === void 0 ? void 0 : _c.hasPin)
            } }) });
}
function resolveUserId(req) {
    const tokenOutput = req.bearerTokenOutput || {};
    const candidates = [
        tokenOutput.preferred_username,
        tokenOutput.upn,
        tokenOutput.email,
        tokenOutput.unique_name,
        tokenOutput.name,
        tokenOutput.oid,
        tokenOutput.sub
    ];
    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim();
        }
    }
    throw new Error('Unable to resolve request user context from bearer token.');
}
function isValidationError(err) {
    const message = typeof (err === null || err === void 0 ? void 0 : err.message) === 'string' ? err.message.toLowerCase() : '';
    return message.includes('invalid ') || message.includes('too large') || message.includes('pin');
}
