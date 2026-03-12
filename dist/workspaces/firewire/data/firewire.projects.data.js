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
exports.FirewireProjectsData = void 0;
const firewireproject_repository_1 = require("../repository/firewireproject.repository");
class FirewireProjectsData {
}
exports.FirewireProjectsData = FirewireProjectsData;
_a = FirewireProjectsData;
FirewireProjectsData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/projects',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.listCombined();
                    return res.status(200).json({
                        rows: result
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
        method: 'get',
        path: '/api/firewire/projects/firewire/:projectId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = String(req.params.projectId || '').trim();
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        });
                    }
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.getFirewireProject(projectId);
                    if (!result) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        });
                    }
                    return res.status(200).json({
                        data: result
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
        method: 'post',
        path: '/api/firewire/projects',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const payload = normalizePayload(req.body);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.createFirewireProject(payload, userId);
                    return res.status(201).json({
                        data: result
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
        method: 'patch',
        path: '/api/firewire/projects/firewire/:projectId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = String(req.params.projectId || '').trim();
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        });
                    }
                    const userId = resolveUserId(req);
                    const payload = normalizePayload(req.body);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.updateFirewireProject(projectId, payload, userId);
                    if (!result) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        });
                    }
                    return res.status(200).json({
                        data: result
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
        method: 'patch',
        path: '/api/firewire/projects/firewire/:projectId/fieldwire',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = String(req.params.projectId || '').trim();
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        });
                    }
                    const userId = resolveUserId(req);
                    const payload = normalizeFieldwireMapPayload(req.body);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.updateFieldwireMapping(projectId, payload, userId);
                    if (!result) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        });
                    }
                    return res.status(200).json({
                        data: result
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
FirewireProjectsData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => {
    const normalizedMethod = item.method.toLowerCase();
    const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
        ? normalizedMethod
        : 'get';
    return Object.assign(Object.assign({}, item), { method, path: item.path.replace('/api/firewire/', '/api/fieldwire/') });
});
function normalizePayload(body) {
    return {
        fieldwireId: body === null || body === void 0 ? void 0 : body.fieldwireId,
        name: body === null || body === void 0 ? void 0 : body.name,
        projectNbr: body === null || body === void 0 ? void 0 : body.projectNbr,
        address: body === null || body === void 0 ? void 0 : body.address,
        bidDueDate: body === null || body === void 0 ? void 0 : body.bidDueDate,
        projectStatus: body === null || body === void 0 ? void 0 : body.projectStatus,
        salesman: body === null || body === void 0 ? void 0 : body.salesman,
        jobType: body === null || body === void 0 ? void 0 : body.jobType,
        scopeType: body === null || body === void 0 ? void 0 : body.scopeType,
        projectScope: body === null || body === void 0 ? void 0 : body.projectScope,
        difficulty: body === null || body === void 0 ? void 0 : body.difficulty,
        totalSqFt: body === null || body === void 0 ? void 0 : body.totalSqFt
    };
}
function normalizeFieldwireMapPayload(body) {
    return {
        fieldwireId: body === null || body === void 0 ? void 0 : body.fieldwireId
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
    return message.includes('missing ') || message.includes('invalid ') || message.includes('must be');
}
