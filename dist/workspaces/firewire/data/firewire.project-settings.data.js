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
exports.FirewireProjectSettingsData = void 0;
const firewireprojectsettings_repository_1 = require("../repository/firewireprojectsettings.repository");
class FirewireProjectSettingsData {
}
exports.FirewireProjectSettingsData = FirewireProjectSettingsData;
_a = FirewireProjectSettingsData;
FirewireProjectSettingsData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/project-settings',
        fx: (req, res) => {
            return new Promise(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const repository = new firewireprojectsettings_repository_1.FirewireProjectSettingsRepository(req.app);
                    const result = yield repository.listAll();
                    return res.status(200).json({ data: result });
                }
                catch (err) {
                    return res.status(500).json({ message: err && err.message ? err.message : err });
                }
            }));
        }
    },
    {
        method: 'post',
        path: '/api/firewire/project-settings/items',
        fx: (req, res) => {
            return new Promise(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const payload = normalizePayload(req.body);
                    const repository = new firewireprojectsettings_repository_1.FirewireProjectSettingsRepository(req.app);
                    const result = yield repository.create(payload, userId);
                    return res.status(201).json({ data: result });
                }
                catch (err) {
                    const statusCode = isValidationError(err) ? 400 : 500;
                    return res.status(statusCode).json({ message: err && err.message ? err.message : err });
                }
            }));
        }
    },
    {
        method: 'patch',
        path: '/api/firewire/project-settings/items/:itemId',
        fx: (req, res) => {
            return new Promise(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const itemId = String(req.params.itemId || '').trim();
                    if (!itemId) {
                        return res.status(400).json({ message: 'Invalid payload: missing itemId parameter.' });
                    }
                    const userId = resolveUserId(req);
                    const payload = normalizePayload(req.body);
                    const repository = new firewireprojectsettings_repository_1.FirewireProjectSettingsRepository(req.app);
                    const result = yield repository.update(itemId, payload, userId);
                    if (!result) {
                        return res.status(404).json({ message: 'Setting not found.' });
                    }
                    return res.status(200).json({ data: result });
                }
                catch (err) {
                    const statusCode = isValidationError(err) ? 400 : 500;
                    return res.status(statusCode).json({ message: err && err.message ? err.message : err });
                }
            }));
        }
    },
    {
        method: 'delete',
        path: '/api/firewire/project-settings/items/:itemId',
        fx: (req, res) => {
            return new Promise(() => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const itemId = String(req.params.itemId || '').trim();
                    if (!itemId) {
                        return res.status(400).json({ message: 'Invalid payload: missing itemId parameter.' });
                    }
                    const repository = new firewireprojectsettings_repository_1.FirewireProjectSettingsRepository(req.app);
                    const deleted = yield repository.remove(itemId);
                    if (!deleted) {
                        return res.status(404).json({ message: 'Setting not found.' });
                    }
                    return res.status(204).send();
                }
                catch (err) {
                    return res.status(500).json({ message: err && err.message ? err.message : err });
                }
            }));
        }
    }
];
FirewireProjectSettingsData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => {
    const normalizedMethod = item.method.toLowerCase();
    const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
        ? normalizedMethod
        : 'get';
    return Object.assign(Object.assign({}, item), { method, path: item.path.replace('/api/firewire/', '/api/fieldwire/') });
});
function normalizePayload(body) {
    return {
        listKey: body === null || body === void 0 ? void 0 : body.listKey,
        label: body === null || body === void 0 ? void 0 : body.label,
        description: body === null || body === void 0 ? void 0 : body.description,
        sortOrder: body === null || body === void 0 ? void 0 : body.sortOrder,
        isActive: body === null || body === void 0 ? void 0 : body.isActive
    };
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
    return message.includes('missing ') || message.includes('invalid ');
}
