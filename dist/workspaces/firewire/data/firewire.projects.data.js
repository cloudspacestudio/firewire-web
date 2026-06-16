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
const sqldb_1 = require("../../fieldwire/repository/sqldb");
const azure_blob_document_storage_1 = require("./azure-blob-document-storage");
const firewireproject_repository_1 = require("../repository/firewireproject.repository");
class FirewireProjectsData {
}
exports.FirewireProjectsData = FirewireProjectsData;
_a = FirewireProjectsData;
FirewireProjectsData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/project-templates',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.listProjectTemplates(userId);
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
        method: 'post',
        path: '/api/firewire/project-templates',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const userId = resolveUserId(req);
                    const payload = normalizeTemplatePayload(req.body);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.saveProjectTemplate(payload, userId);
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
        path: '/api/firewire/projects/firewire/:projectId/lock',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const projectId = String(req.params.projectId || '').trim();
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        });
                    }
                    const userId = resolveUserId(req);
                    const isLocked = !!((_b = req.body) === null || _b === void 0 ? void 0 : _b.isLocked);
                    const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                    const result = yield repository.updateManualLock(projectId, isLocked, userId);
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
        method: 'get',
        path: '/api/firewire/projects/firewire/:projectId/fieldwire-import/plan',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const projectId = String(req.params.projectId || '').trim();
                if (!projectId) {
                    return res.status(400).json({
                        message: 'Invalid payload: missing projectId parameter.'
                    });
                }
                const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                const project = yield repository.getFirewireProject(projectId);
                if (!project) {
                    return res.status(404).json({
                        message: 'Project not found.'
                    });
                }
                const fieldwire = req.app.locals.fieldwire;
                const sqldb = new sqldb_1.SqlDb(req.app);
                const plan = yield buildFieldwireImportPlan(fieldwire, sqldb, project);
                return res.status(200).json({
                    data: plan
                });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'post',
        path: '/api/firewire/projects/firewire/:projectId/fieldwire-import/execute',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const projectId = String(req.params.projectId || '').trim();
                if (!projectId) {
                    return res.status(400).json({
                        message: 'Invalid payload: missing projectId parameter.'
                    });
                }
                const userId = resolveUserId(req);
                const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                const project = yield repository.getFirewireProject(projectId);
                if (!project) {
                    return res.status(404).json({
                        message: 'Project not found.'
                    });
                }
                const fieldwire = req.app.locals.fieldwire;
                const sqldb = new sqldb_1.SqlDb(req.app);
                const result = yield executeFieldwireImport(fieldwire, sqldb, repository, project, userId);
                return res.status(200).json({
                    data: result,
                    message: result.message
                });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'get',
        path: '/api/firewire/projects/:projectId/change-orders',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const projectId = String(req.params.projectId || '').trim();
                if (!projectId) {
                    return res.status(400).json({
                        message: 'Invalid payload: missing projectId parameter.'
                    });
                }
                const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                const rootProject = yield resolveRootFirewireProject(req.app, repository, projectId);
                if (!rootProject) {
                    return res.status(404).json({
                        message: 'Root project not found.'
                    });
                }
                const changeOrders = yield listProjectChangeOrders(repository, rootProject);
                return res.status(200).json({
                    data: {
                        rootProject,
                        changeOrders
                    }
                });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'post',
        path: '/api/firewire/projects/:projectId/change-orders',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const projectId = String(req.params.projectId || '').trim();
                if (!projectId) {
                    return res.status(400).json({
                        message: 'Invalid payload: missing projectId parameter.'
                    });
                }
                const userId = resolveUserId(req);
                const repository = new firewireproject_repository_1.FirewireProjectRepository(req.app);
                const rootProject = yield resolveRootFirewireProject(req.app, repository, projectId);
                if (!rootProject) {
                    return res.status(404).json({
                        message: 'Root project not found.'
                    });
                }
                const changeOrders = yield listProjectChangeOrders(repository, rootProject);
                const nextVersion = getNextChangeOrderVersion(changeOrders);
                const versionLabel = nextVersion.toString().padStart(2, '0');
                const rootProjectNbr = getRootProjectNumber(rootProject.projectNbr);
                const rootProjectName = getRootProjectName(rootProject.name);
                const worksheetData = buildChangeOrderWorksheetData(rootProject.worksheetData);
                const created = yield repository.createFirewireProject({
                    fieldwireId: null,
                    name: `${rootProjectName} - ${versionLabel}`,
                    projectNbr: rootProjectNbr ? `${rootProjectNbr}.${versionLabel}` : '',
                    address: rootProject.address,
                    bidDueDate: rootProject.bidDueDate,
                    projectStatus: 'Estimation',
                    projectType: rootProject.projectType,
                    salesman: rootProject.salesman,
                    jobType: rootProject.jobType,
                    scopeType: rootProject.scopeType,
                    projectScope: rootProject.projectScope,
                    difficulty: rootProject.difficulty,
                    totalSqFt: rootProject.totalSqFt,
                    worksheetData
                }, userId);
                return res.status(201).json({
                    data: {
                        rootProject,
                        project: created,
                        version: versionLabel,
                        route: `/sales/${created.uuid}`
                    }
                });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
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
        path: '/api/firewire/projects/map-config',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim();
                    return res.status(200).json({
                        data: {
                            subscriptionKey: subscriptionKey || null
                        }
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
        path: '/api/firewire/projects/weather-forecast',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const latitude = Number(req.query.latitude);
                    const longitude = Number(req.query.longitude);
                    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                        return res.status(400).json({
                            message: 'Invalid payload: latitude and longitude query parameters are required.'
                        });
                    }
                    const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim();
                    if (!subscriptionKey) {
                        return res.status(200).json({
                            data: {
                                forecast: [],
                                status: 'not-configured'
                            }
                        });
                    }
                    const apiVersion = (process.env.AZURE_MAPS_WEATHER_API_VERSION || '1.1').trim();
                    const baseUrl = (process.env.AZURE_MAPS_BASE_URL || 'https://atlas.microsoft.com').trim().replace(/\/$/, '');
                    const url = `${baseUrl}/weather/forecast/daily/json?api-version=${encodeURIComponent(apiVersion)}&subscription-key=${encodeURIComponent(subscriptionKey)}&query=${encodeURIComponent(`${latitude},${longitude}`)}&duration=10&language=en-US&unit=imperial`;
                    const response = yield fetch(url, {
                        method: 'GET',
                        headers: {
                            Accept: 'application/json'
                        }
                    });
                    if (!response.ok) {
                        return res.status(200).json({
                            data: {
                                forecast: [],
                                status: 'unavailable'
                            }
                        });
                    }
                    const payload = yield response.json();
                    return res.status(200).json({
                        data: {
                            forecast: normalizeDailyForecastPayload(payload),
                            status: 'ok'
                        }
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
        method: 'delete',
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
                    const deleted = yield repository.deleteFirewireProject(projectId);
                    if (!deleted) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        });
                    }
                    return res.status(200).json({
                        data: {
                            deleted: true
                        }
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
        worksheetData: body === null || body === void 0 ? void 0 : body.worksheetData,
        name: body === null || body === void 0 ? void 0 : body.name,
        projectNbr: body === null || body === void 0 ? void 0 : body.projectNbr,
        address: body === null || body === void 0 ? void 0 : body.address,
        bidDueDate: body === null || body === void 0 ? void 0 : body.bidDueDate,
        projectStatus: body === null || body === void 0 ? void 0 : body.projectStatus,
        projectType: body === null || body === void 0 ? void 0 : body.projectType,
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
function resolveRootFirewireProject(app, repository, projectKey) {
    return __awaiter(this, void 0, void 0, function* () {
        const directProject = yield repository.getFirewireProject(projectKey);
        if (directProject) {
            return directProject;
        }
        const firewireProjects = yield repository.listFirewireProjects();
        const explicitMatch = firewireProjects.find((project) => String(project.fieldwireId || '') === projectKey);
        if (explicitMatch) {
            return repository.getFirewireProject(explicitMatch.uuid);
        }
        try {
            const fieldwire = app.locals.fieldwire;
            const fieldwireProject = yield fieldwire.project(projectKey);
            const fieldwireCode = normalizeLookupKey(fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.code);
            const byProjectNumber = fieldwireCode
                ? firewireProjects.find((project) => normalizeLookupKey(project.projectNbr) === fieldwireCode)
                : null;
            if (byProjectNumber) {
                return repository.getFirewireProject(byProjectNumber.uuid);
            }
        }
        catch (_b) { }
        return null;
    });
}
function listProjectChangeOrders(repository, rootProject) {
    return __awaiter(this, void 0, void 0, function* () {
        const rootProjectNbr = getRootProjectNumber(rootProject.projectNbr);
        if (!rootProjectNbr) {
            return [];
        }
        const allProjects = yield repository.listFirewireProjects();
        const pattern = new RegExp(`^${escapeRegExp(rootProjectNbr)}\\.\\d{2}$`, 'i');
        return allProjects
            .filter((project) => project.uuid !== rootProject.uuid && pattern.test(String(project.projectNbr || '').trim()))
            .sort((left, right) => getChangeOrderVersion(left.projectNbr) - getChangeOrderVersion(right.projectNbr));
    });
}
function getNextChangeOrderVersion(changeOrders) {
    const versions = changeOrders
        .map((project) => getChangeOrderVersion(project.projectNbr))
        .filter((version) => Number.isFinite(version) && version > 0);
    return versions.length > 0 ? Math.max(...versions) + 1 : 1;
}
function getChangeOrderVersion(projectNbr) {
    const match = String(projectNbr || '').trim().match(/\.(\d{2})$/);
    return match ? Number(match[1]) : 0;
}
function getRootProjectNumber(projectNbr) {
    return String(projectNbr || '').trim().replace(/\.\d{2}$/, '');
}
function getRootProjectName(name) {
    return String(name || '').trim().replace(/\s+-\s+\d{2}$/, '');
}
function buildChangeOrderWorksheetData(sourceWorksheetData) {
    const customerInfo = (sourceWorksheetData === null || sourceWorksheetData === void 0 ? void 0 : sourceWorksheetData.customerInfo) && typeof sourceWorksheetData.customerInfo === 'object'
        ? JSON.parse(JSON.stringify(sourceWorksheetData.customerInfo))
        : undefined;
    return typeof customerInfo === 'undefined' ? {} : { customerInfo };
}
function escapeRegExp(value) {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function buildFieldwireSymbolFinancialMap(project) {
    var _b;
    const result = new Map();
    const bomSections = Array.isArray((_b = project === null || project === void 0 ? void 0 : project.worksheetData) === null || _b === void 0 ? void 0 : _b.bomSections) ? project.worksheetData.bomSections : [];
    for (const section of bomSections) {
        const rows = Array.isArray(section === null || section === void 0 ? void 0 : section.rows) ? section.rows : [];
        for (const row of rows) {
            const categoryName = String((row === null || row === void 0 ? void 0 : row.type) || '').trim();
            const partNumber = String((row === null || row === void 0 ? void 0 : row.partNbr) || '').trim();
            const deviceName = String((row === null || row === void 0 ? void 0 : row.description) || (row === null || row === void 0 ? void 0 : row.partNbr) || categoryName).trim();
            const materialCost = toFiniteNumber(row === null || row === void 0 ? void 0 : row.cost) || 0;
            const laborHours = toFiniteNumber(row === null || row === void 0 ? void 0 : row.labor) || 0;
            if (!categoryName && !partNumber && !deviceName) {
                continue;
            }
            const keys = [
                `${categoryName}::${partNumber || deviceName}`,
                `${categoryName}::${deviceName}`,
                partNumber,
                deviceName
            ].map((value) => normalizeLookupKey(value)).filter(Boolean);
            for (const key of keys) {
                if (!result.has(key)) {
                    result.set(key, { materialCost, laborHours });
                }
            }
        }
    }
    return result;
}
function getFieldwireSymbolFinancials(symbol, symbolFinancials) {
    const symbolCost = toFiniteNumber(symbol === null || symbol === void 0 ? void 0 : symbol.materialCost);
    const symbolLabor = toFiniteNumber(symbol === null || symbol === void 0 ? void 0 : symbol.laborHours);
    const lookupKeys = [
        symbol === null || symbol === void 0 ? void 0 : symbol.symbolId,
        `${(symbol === null || symbol === void 0 ? void 0 : symbol.categoryName) || ''}::${(symbol === null || symbol === void 0 ? void 0 : symbol.partNumber) || (symbol === null || symbol === void 0 ? void 0 : symbol.deviceName) || (symbol === null || symbol === void 0 ? void 0 : symbol.label) || (symbol === null || symbol === void 0 ? void 0 : symbol.text) || ''}`,
        `${(symbol === null || symbol === void 0 ? void 0 : symbol.categoryName) || ''}::${(symbol === null || symbol === void 0 ? void 0 : symbol.deviceName) || (symbol === null || symbol === void 0 ? void 0 : symbol.label) || (symbol === null || symbol === void 0 ? void 0 : symbol.text) || ''}`,
        symbol === null || symbol === void 0 ? void 0 : symbol.partNumber,
        symbol === null || symbol === void 0 ? void 0 : symbol.deviceName,
        symbol === null || symbol === void 0 ? void 0 : symbol.label,
        symbol === null || symbol === void 0 ? void 0 : symbol.text
    ].map((value) => normalizeLookupKey(value)).filter(Boolean);
    const fallback = lookupKeys.map((key) => symbolFinancials.get(key)).find(Boolean);
    return {
        materialCost: typeof symbolCost === 'number' && Number.isFinite(symbolCost) ? symbolCost : (fallback === null || fallback === void 0 ? void 0 : fallback.materialCost) || 0,
        laborHours: typeof symbolLabor === 'number' && Number.isFinite(symbolLabor) ? symbolLabor : (fallback === null || fallback === void 0 ? void 0 : fallback.laborHours) || 0
    };
}
function buildFieldwireImportPlan(fieldwire, sqldb, project) {
    return __awaiter(this, void 0, void 0, function* () {
        const accountProjects = yield fieldwire.accountProjects();
        const normalizedProjectNbr = normalizeLookupKey(project.projectNbr);
        const fieldwireProject = (project.fieldwireId
            ? accountProjects.find((item) => String((item === null || item === void 0 ? void 0 : item.id) || '') === project.fieldwireId)
            : null)
            || (normalizedProjectNbr
                ? accountProjects.find((item) => normalizeLookupKey(item === null || item === void 0 ? void 0 : item.code) === normalizedProjectNbr)
                : null)
            || null;
        const workspace = yield loadProjectDocLibraryPayload(sqldb, project.uuid);
        const floorplans = getFirewireFloorplans(workspace);
        const actionItems = [];
        const floorplanPlans = [];
        let taskCreateCount = 0;
        if (!fieldwireProject) {
            actionItems.push({
                type: 'create-project',
                status: 'required',
                label: 'Create Fieldwire project',
                detail: `Create ${project.name || 'project'}${project.projectNbr ? ` with project number ${project.projectNbr}` : ''}.`
            });
        }
        const fieldwireFloorplans = (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.id)
            ? yield fieldwire.projectFloorplans(String(fieldwireProject.id), true)
            : [];
        const fieldwireProjectId = (fieldwireProject === null || fieldwireProject === void 0 ? void 0 : fieldwireProject.id) ? String(fieldwireProject.id) : '';
        const fieldwireFloorplanTasksById = new Map();
        for (const fieldwireFloorplan of fieldwireFloorplans) {
            const id = String((fieldwireFloorplan === null || fieldwireFloorplan === void 0 ? void 0 : fieldwireFloorplan.id) || '');
            if (!id) {
                continue;
            }
            if (!isFieldwireFloorplanReady(fieldwireFloorplan)) {
                fieldwireFloorplanTasksById.set(id, []);
                continue;
            }
            try {
                fieldwireFloorplanTasksById.set(id, yield fieldwire.projectFloorplanTasks(fieldwireProjectId, id));
            }
            catch (_b) {
                fieldwireFloorplanTasksById.set(id, []);
            }
        }
        for (const floorplan of floorplans) {
            const latestVersion = latestFileVersion(floorplan);
            const nameWithoutExtension = getFileBaseName(floorplan.name);
            const matchingFloorplan = findMatchingFieldwireFloorplan(fieldwireFloorplans, floorplan.name, nameWithoutExtension);
            const symbols = getFloorplanSymbols(floorplan);
            const matchingFloorplanReady = matchingFloorplan ? isFieldwireFloorplanReady(matchingFloorplan) : false;
            const existingTasks = (matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.id) ? (fieldwireFloorplanTasksById.get(String(matchingFloorplan.id)) || []) : [];
            const taskPlans = symbols.map((symbol) => {
                const taskName = String(symbol.label || symbol.text || symbol.deviceName || symbol.categoryName || 'Symbol').trim();
                const existingTask = existingTasks.find((task) => normalizeLookupKey(task === null || task === void 0 ? void 0 : task.name) === normalizeLookupKey(taskName));
                const status = existingTask ? 'exists' : matchingFloorplan && !matchingFloorplanReady ? 'blocked' : 'required';
                if (status === 'required') {
                    taskCreateCount += 1;
                }
                return {
                    annotationId: symbol.id,
                    taskName,
                    xRatio: toFiniteNumber(symbol.xRatio),
                    yRatio: toFiniteNumber(symbol.yRatio),
                    categoryName: symbol.categoryName || '',
                    partNumber: symbol.partNumber || '',
                    deviceName: symbol.deviceName || '',
                    status,
                    fieldwireTaskId: (existingTask === null || existingTask === void 0 ? void 0 : existingTask.id) || null
                };
            });
            const floorplanStatus = matchingFloorplan
                ? matchingFloorplanReady ? 'exists' : 'processing'
                : 'required';
            if (floorplanStatus === 'required') {
                actionItems.push({
                    type: 'create-floorplan',
                    status: 'required',
                    label: `Create floorplan ${floorplan.name}`,
                    detail: (latestVersion === null || latestVersion === void 0 ? void 0 : latestVersion.sourceFileName) || floorplan.name,
                    firewireFileId: floorplan.id
                });
            }
            for (const taskPlan of taskPlans.filter((item) => item.status === 'required')) {
                actionItems.push({
                    type: 'create-task',
                    status: 'required',
                    label: `Create task ${taskPlan.taskName}`,
                    detail: `Place on ${floorplan.name} at ${formatPercent(taskPlan.xRatio)}, ${formatPercent(taskPlan.yRatio)}.`,
                    firewireFileId: floorplan.id,
                    annotationId: taskPlan.annotationId
                });
            }
            floorplanPlans.push({
                firewireFileId: floorplan.id,
                fileName: floorplan.name,
                sourceFileName: (latestVersion === null || latestVersion === void 0 ? void 0 : latestVersion.sourceFileName) || floorplan.name,
                mimeType: (latestVersion === null || latestVersion === void 0 ? void 0 : latestVersion.mimeType) || '',
                sizeBytes: (latestVersion === null || latestVersion === void 0 ? void 0 : latestVersion.sizeBytes) || 0,
                symbolCount: symbols.length,
                status: floorplanStatus,
                fieldwireFloorplanId: (matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.id) || null,
                fieldwireFloorplanName: (matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.name) || '',
                fieldwireCreatedAt: toIsoString(matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.created_at),
                fieldwireUpdatedAt: toIsoString(matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.updated_at),
                tasks: taskPlans
            });
        }
        return {
            project: {
                id: project.uuid,
                name: project.name,
                projectNbr: project.projectNbr,
                address: project.address,
                status: project.projectStatus,
                fieldwireId: project.fieldwireId
            },
            fieldwireProject: fieldwireProject ? {
                id: fieldwireProject.id,
                name: fieldwireProject.name || '',
                code: fieldwireProject.code || '',
                address: fieldwireProject.address || '',
                createdAt: toIsoString(fieldwireProject.created_at),
                updatedAt: toIsoString(fieldwireProject.updated_at),
                url: `https://app.fieldwire.com/projects/${fieldwireProject.id}`
            } : null,
            status: fieldwireProject ? 'project-exists' : 'project-missing',
            canImport: actionItems.length > 0,
            summary: {
                floorplans: floorplanPlans.length,
                floorplansToCreate: floorplanPlans.filter((item) => item.status === 'required').length,
                tasksToCreate: taskCreateCount,
                actionsRequired: actionItems.length
            },
            floorplans: floorplanPlans,
            actionItems
        };
    });
}
function executeFieldwireImport(fieldwire, sqldb, repository, project, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        const results = [];
        let workingProject = project;
        let plan = yield buildFieldwireImportPlan(fieldwire, sqldb, workingProject);
        if (!plan.canImport) {
            return {
                success: true,
                message: 'Fieldwire is already current for this project.',
                results: []
            };
        }
        let fieldwireProject = plan.fieldwireProject;
        if (!fieldwireProject) {
            try {
                const createdProject = yield fieldwire.createProject({
                    name: workingProject.name,
                    code: workingProject.projectNbr || undefined,
                    address: workingProject.address || undefined,
                    time_zone: 'America/Chicago'
                });
                fieldwireProject = {
                    id: createdProject.id,
                    name: createdProject.name || workingProject.name,
                    code: createdProject.code || workingProject.projectNbr,
                    address: createdProject.address || workingProject.address,
                    createdAt: toIsoString(createdProject.created_at),
                    updatedAt: toIsoString(createdProject.updated_at),
                    url: `https://app.fieldwire.com/projects/${createdProject.id}`
                };
                fieldwire.allowEditableProject(String(createdProject.id));
                const mappedProject = yield repository.updateFieldwireMapping(workingProject.uuid, {
                    fieldwireId: String(createdProject.id)
                }, userId);
                if (mappedProject) {
                    workingProject = mappedProject;
                }
                results.push({
                    type: 'create-project',
                    label: 'Create Fieldwire project',
                    status: 'success',
                    detail: `Created ${fieldwireProject.name}.`
                });
            }
            catch (err) {
                results.push({
                    type: 'create-project',
                    label: 'Create Fieldwire project',
                    status: 'failed',
                    detail: (err === null || err === void 0 ? void 0 : err.message) || String(err)
                });
                return {
                    success: false,
                    message: 'Fieldwire import failed while creating the project.',
                    results
                };
            }
        }
        else {
            fieldwire.allowEditableProject(String(fieldwireProject.id));
        }
        const fieldwireProjectId = String(fieldwireProject.id);
        const workspace = yield loadProjectDocLibraryPayload(sqldb, workingProject.uuid);
        const floorplans = getFirewireFloorplans(workspace);
        const floorplansByFirewireFileId = new Map();
        let fieldwireFloorplans = yield fieldwire.projectFloorplans(fieldwireProjectId, true);
        const taskContext = yield loadFieldwireTaskContext(fieldwire, fieldwireProjectId);
        const symbolFinancials = buildFieldwireSymbolFinancialMap(workingProject);
        for (const floorplan of floorplans) {
            const baseName = getFileBaseName(floorplan.name);
            let matchingFloorplan = findMatchingFieldwireFloorplan(fieldwireFloorplans, floorplan.name, baseName);
            if (!matchingFloorplan) {
                try {
                    const sheetUpload = yield createFieldwireFloorplanFromFirewireFile(fieldwire, workingProject.uuid, fieldwireProjectId, taskContext.userId, floorplan);
                    matchingFloorplan = yield waitForFieldwireFloorplan(fieldwire, fieldwireProjectId, floorplan.name, baseName, sheetUpload === null || sheetUpload === void 0 ? void 0 : sheetUpload.id);
                    if (matchingFloorplan) {
                        fieldwireFloorplans = yield fieldwire.projectFloorplans(fieldwireProjectId, true);
                        if (isFieldwireFloorplanReady(matchingFloorplan)) {
                            results.push({
                                type: 'create-floorplan',
                                label: `Create floorplan ${floorplan.name}`,
                                status: 'success',
                                detail: 'Uploaded sheet/floorplan to Fieldwire and it is ready for tasks.'
                            });
                        }
                        else {
                            results.push({
                                type: 'create-floorplan',
                                label: `Create floorplan ${floorplan.name}`,
                                status: 'pending',
                                detail: describeFieldwireFloorplanPending(matchingFloorplan)
                            });
                        }
                    }
                    else {
                        results.push({
                            type: 'create-floorplan',
                            label: `Create floorplan ${floorplan.name}`,
                            status: 'pending',
                            detail: 'Fieldwire accepted the upload, but the new floorplan is still processing or awaiting conflict resolution. Run Execute again after Fieldwire finishes processing.'
                        });
                    }
                }
                catch (err) {
                    results.push({
                        type: 'create-floorplan',
                        label: `Create floorplan ${floorplan.name}`,
                        status: 'failed',
                        detail: (err === null || err === void 0 ? void 0 : err.message) || String(err)
                    });
                }
            }
            if (matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.id) {
                if (isFieldwireFloorplanReady(matchingFloorplan)) {
                    matchingFloorplan = yield ensureFieldwireFloorplanName(fieldwire, fieldwireProjectId, matchingFloorplan, baseName);
                }
                floorplansByFirewireFileId.set(String(floorplan.id), matchingFloorplan);
            }
        }
        for (const floorplan of floorplans) {
            let matchingFloorplan = floorplansByFirewireFileId.get(String(floorplan.id))
                || findMatchingFieldwireFloorplan(fieldwireFloorplans, floorplan.name, getFileBaseName(floorplan.name));
            if (!(matchingFloorplan === null || matchingFloorplan === void 0 ? void 0 : matchingFloorplan.id)) {
                const symbolCount = getFloorplanSymbols(floorplan).length;
                if (symbolCount > 0) {
                    results.push({
                        type: 'create-task',
                        label: `Create ${symbolCount} task${symbolCount === 1 ? '' : 's'} on ${floorplan.name}`,
                        status: 'skipped',
                        detail: 'The Fieldwire floorplan is not available yet.'
                    });
                }
                continue;
            }
            if (!isFieldwireFloorplanReady(matchingFloorplan)) {
                const symbolCount = getFloorplanSymbols(floorplan).length;
                if (symbolCount > 0) {
                    results.push({
                        type: 'create-task',
                        label: `Create ${symbolCount} task${symbolCount === 1 ? '' : 's'} on ${floorplan.name}`,
                        status: 'pending',
                        detail: describeFieldwireFloorplanPending(matchingFloorplan)
                    });
                }
                continue;
            }
            matchingFloorplan = yield ensureFieldwireFloorplanName(fieldwire, fieldwireProjectId, matchingFloorplan, getFileBaseName(floorplan.name));
            const existingTasks = yield fieldwire.projectFloorplanTasks(fieldwireProjectId, String(matchingFloorplan.id));
            for (const symbol of getFloorplanSymbols(floorplan)) {
                const taskName = String(symbol.label || symbol.text || symbol.deviceName || symbol.categoryName || 'Symbol').trim();
                const existingTask = existingTasks.find((task) => normalizeLookupKey(task === null || task === void 0 ? void 0 : task.name) === normalizeLookupKey(taskName));
                if (existingTask) {
                    continue;
                }
                const team = yield getOrCreateFieldwireTeam(fieldwire, fieldwireProjectId, taskContext, symbol.categoryName || 'Firewire');
                const position = calculateFieldwirePosition(matchingFloorplan, symbol);
                const financials = getFieldwireSymbolFinancials(symbol, symbolFinancials);
                try {
                    yield fieldwire.createTask({
                        project_id: fieldwireProjectId,
                        creator_user_id: taskContext.userId,
                        owner_user_id: taskContext.userId,
                        floorplan_id: String(matchingFloorplan.id),
                        team_id: team.id,
                        is_local: true,
                        name: taskName,
                        pos_x: position.posX,
                        pos_y: position.posY,
                        priority: 2,
                        status_id: taskContext.statusId,
                        cost_value: financials.materialCost,
                        man_power_value: financials.laborHours
                    });
                    results.push({
                        type: 'create-task',
                        label: `Create task ${taskName}`,
                        status: 'success',
                        detail: `Placed on ${floorplan.name} at ${formatPercent(toFiniteNumber(symbol.xRatio))}, ${formatPercent(toFiniteNumber(symbol.yRatio))}.`
                    });
                }
                catch (err) {
                    results.push({
                        type: 'create-task',
                        label: `Create task ${taskName}`,
                        status: 'failed',
                        detail: (err === null || err === void 0 ? void 0 : err.message) || String(err)
                    });
                }
            }
        }
        const failures = results.filter((result) => result.status === 'failed');
        const pending = results.filter((result) => result.status === 'pending');
        return {
            success: failures.length <= 0 && pending.length <= 0,
            message: failures.length > 0
                ? `Fieldwire import finished with ${failures.length} failed operation${failures.length === 1 ? '' : 's'}.`
                : pending.length > 0
                    ? `Fieldwire accepted the upload, but ${pending.length} operation${pending.length === 1 ? ' is' : 's are'} waiting on Fieldwire plan processing.`
                    : 'Fieldwire import completed.',
            results
        };
    });
}
function createFieldwireFloorplanFromFirewireFile(fieldwire, workspaceKey, fieldwireProjectId, fieldwireUserId, floorplan) {
    return __awaiter(this, void 0, void 0, function* () {
        const version = latestFileVersion(floorplan);
        if (!version) {
            throw new Error('Floorplan has no file version content.');
        }
        const fileContent = yield loadFirewireFileContent(workspaceKey, floorplan, version);
        const tokens = yield fieldwire.aws_post_tokens();
        const token = Array.isArray(tokens) ? tokens[0] : tokens;
        if (!(token === null || token === void 0 ? void 0 : token.post_address) || !(token === null || token === void 0 ? void 0 : token.post_parameters)) {
            throw new Error('Fieldwire did not return a usable AWS post token.');
        }
        const sourceFileName = version.sourceFileName || floorplan.name || 'floorplan';
        const postParameters = Object.assign({}, token.post_parameters);
        if (postParameters.key && String(postParameters.key).includes('${filename}')) {
            postParameters.key = String(postParameters.key).replace('${filename}', sourceFileName);
        }
        const form = new FormData();
        Object.keys(postParameters).forEach((key) => {
            form.append(key, String(postParameters[key]));
        });
        form.append('file', new Blob([new Uint8Array(fileContent.buffer)], {
            type: fileContent.contentType || 'application/octet-stream'
        }), sourceFileName);
        const uploadResponse = yield fetch(token.post_address, {
            method: 'POST',
            body: form
        });
        if (!uploadResponse.ok) {
            throw new Error(`AWS upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
        }
        const fileKey = String(postParameters.key || '');
        const baseName = getFileBaseName(floorplan.name || sourceFileName);
        const fileUrl = `${String(token.post_address).replace(/\/$/, '')}/${fileKey}`;
        const sheetUploadBody = {
            user_id: fieldwireUserId,
            name: baseName,
            file_url: fileUrl
        };
        console.log('FIELDWIRE SHEET UPLOAD REQUEST');
        console.log(JSON.stringify({
            projectId: fieldwireProjectId,
            firewireFloorplanName: floorplan.name,
            sourceFileName,
            contentType: fileContent.contentType,
            fileSizeBytes: fileContent.buffer.length,
            awsPostAddress: token.post_address,
            awsKey: fileKey,
            body: sheetUploadBody
        }, null, 2));
        return fieldwire.createSheetUpload(fieldwireProjectId, sheetUploadBody);
    });
}
function loadFirewireFileContent(workspaceKey, file, version) {
    return __awaiter(this, void 0, void 0, function* () {
        if (version.blobName) {
            const storage = new azure_blob_document_storage_1.AzureBlobDocumentStorage();
            const result = yield storage.download(version.blobContainerName || workspaceKey, version.blobName);
            return {
                buffer: result.buffer,
                contentType: result.contentType || version.mimeType || 'application/octet-stream'
            };
        }
        if (version.dataUrl) {
            const dataUrl = String(version.dataUrl);
            const commaIndex = dataUrl.indexOf(',');
            const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : '';
            const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
            const mimeTypeMatch = header.match(/data:(.*?);base64/);
            return {
                buffer: Buffer.from(base64, 'base64'),
                contentType: mimeTypeMatch ? mimeTypeMatch[1] : version.mimeType || 'application/octet-stream'
            };
        }
        throw new Error(`No content is available for ${(file === null || file === void 0 ? void 0 : file.name) || 'floorplan'}.`);
    });
}
function waitForFieldwireFloorplan(fieldwire, projectId, fileName, baseName, sheetUploadId) {
    return __awaiter(this, void 0, void 0, function* () {
        for (let attempt = 0; attempt < 5; attempt += 1) {
            const floorplans = yield fieldwire.projectFloorplans(projectId, true);
            const match = findMatchingFieldwireFloorplan(floorplans, fileName, baseName, sheetUploadId);
            if (match) {
                return match;
            }
            yield new Promise((resolve) => setTimeout(resolve, 1500));
        }
        return null;
    });
}
function loadFieldwireTaskContext(fieldwire, projectId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = normalizeArray(yield fieldwire.accountProjectUsers(projectId));
        const user = users.find((item) => item === null || item === void 0 ? void 0 : item.is_admin) || users[0];
        if (!(user === null || user === void 0 ? void 0 : user.id)) {
            throw new Error('No Fieldwire project user is available for task creation.');
        }
        const statuses = normalizeArray(yield fieldwire.statuses(projectId));
        const status = statuses.find((item) => item === null || item === void 0 ? void 0 : item.is_default)
            || statuses.find((item) => normalizeLookupKey(item === null || item === void 0 ? void 0 : item.name).includes('open'))
            || statuses[0];
        const teams = normalizeArray(yield fieldwire.teams(projectId));
        return {
            userId: String(user.id),
            statusId: (status === null || status === void 0 ? void 0 : status.id) ? String(status.id) : undefined,
            teams
        };
    });
}
function getOrCreateFieldwireTeam(fieldwire, projectId, context, categoryName) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedCategoryName = String(categoryName || 'Firewire').trim() || 'Firewire';
        const match = context.teams.find((team) => normalizeLookupKey(team === null || team === void 0 ? void 0 : team.name) === normalizeLookupKey(normalizedCategoryName))
            || context.teams[0];
        if (match === null || match === void 0 ? void 0 : match.id) {
            return match;
        }
        const handle = normalizedCategoryName
            .replace(/[^a-zA-Z0-9]/g, '')
            .substring(0, 2)
            .toUpperCase() || 'FW';
        const created = yield fieldwire.createTeam({
            id: '',
            project_id: projectId,
            name: normalizedCategoryName,
            handle
        });
        context.teams.push(created);
        return created;
    });
}
function ensureFieldwireFloorplanName(fieldwire, projectId, floorplan, desiredName) {
    return __awaiter(this, void 0, void 0, function* () {
        const normalizedDesiredName = String(desiredName || '').trim();
        if (!(floorplan === null || floorplan === void 0 ? void 0 : floorplan.id) || !normalizedDesiredName || normalizeLookupKey(floorplan.name) === normalizeLookupKey(normalizedDesiredName)) {
            return floorplan;
        }
        try {
            return yield fieldwire.updateFloorplan(projectId, String(floorplan.id), {
                name: normalizedDesiredName,
                is_name_confirmed: true,
                is_user_confirmed: true
            });
        }
        catch (_b) {
            return floorplan;
        }
    });
}
function calculateFieldwirePosition(fieldwireFloorplan, symbol) {
    const sheet = Array.isArray(fieldwireFloorplan === null || fieldwireFloorplan === void 0 ? void 0 : fieldwireFloorplan.sheets) ? fieldwireFloorplan.sheets[0] : fieldwireFloorplan === null || fieldwireFloorplan === void 0 ? void 0 : fieldwireFloorplan.current_sheet;
    const fileWidth = toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.file_width) || toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.width) || 1;
    const fileHeight = toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.file_height) || toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.height) || 1;
    const xRatio = toFiniteNumber(symbol.xRatio) || 0;
    const yRatio = toFiniteNumber(symbol.yRatio) || 0;
    return {
        posX: Math.round(fileWidth * xRatio),
        posY: Math.round(fileHeight * yRatio)
    };
}
function normalizeArray(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (Array.isArray(value === null || value === void 0 ? void 0 : value.rows)) {
        return value.rows;
    }
    if (Array.isArray(value === null || value === void 0 ? void 0 : value.data)) {
        return value.data;
    }
    return value ? [value] : [];
}
function loadProjectDocLibraryPayload(sqldb, workspaceKey) {
    return __awaiter(this, void 0, void 0, function* () {
        const record = yield sqldb.getWorkspaceStorage('project-doc-library', workspaceKey);
        if (!(record === null || record === void 0 ? void 0 : record.payloadJson)) {
            return { files: [] };
        }
        try {
            return JSON.parse(record.payloadJson);
        }
        catch (_b) {
            return { files: [] };
        }
    });
}
function getFirewireFloorplans(workspace) {
    return (Array.isArray(workspace === null || workspace === void 0 ? void 0 : workspace.files) ? workspace.files : [])
        .filter((file) => String((file === null || file === void 0 ? void 0 : file.folderId) || '') === 'floorplans')
        .sort((left, right) => String((left === null || left === void 0 ? void 0 : left.name) || '').localeCompare(String((right === null || right === void 0 ? void 0 : right.name) || ''), undefined, {
        numeric: true,
        sensitivity: 'base'
    }));
}
function getFloorplanSymbols(file) {
    var _b;
    return (Array.isArray((_b = file === null || file === void 0 ? void 0 : file.floorplanDesign) === null || _b === void 0 ? void 0 : _b.annotations) ? file.floorplanDesign.annotations : [])
        .filter((annotation) => (annotation === null || annotation === void 0 ? void 0 : annotation.kind) === 'symbol');
}
function latestFileVersion(file) {
    const versions = Array.isArray(file === null || file === void 0 ? void 0 : file.versions) ? file.versions : [];
    return versions.length > 0 ? versions[versions.length - 1] : null;
}
function findMatchingFieldwireFloorplan(fieldwireFloorplans, fileName, baseName, sheetUploadId) {
    const fileKey = normalizeLookupKey(fileName);
    const baseKey = normalizeLookupKey(baseName);
    const uploadKey = normalizeLookupKey(sheetUploadId);
    return (fieldwireFloorplans || []).find((floorplan) => {
        const sheets = getFieldwireFloorplanSheets(floorplan);
        if (uploadKey && sheets.some((sheet) => { var _b; return normalizeLookupKey(sheet === null || sheet === void 0 ? void 0 : sheet.sheet_upload_id) === uploadKey || normalizeLookupKey((_b = sheet === null || sheet === void 0 ? void 0 : sheet.sheet_upload) === null || _b === void 0 ? void 0 : _b.id) === uploadKey; })) {
            return true;
        }
        const candidateNames = [
            floorplan === null || floorplan === void 0 ? void 0 : floorplan.name,
            floorplan === null || floorplan === void 0 ? void 0 : floorplan.description,
            ...(sheets.map((sheet) => (sheet === null || sheet === void 0 ? void 0 : sheet.file_name) || (sheet === null || sheet === void 0 ? void 0 : sheet.name) || (sheet === null || sheet === void 0 ? void 0 : sheet.source_file_name) || (sheet === null || sheet === void 0 ? void 0 : sheet.original_filename)))
        ];
        return candidateNames.some((candidate) => {
            const key = normalizeLookupKey(candidate);
            return key && (key === fileKey || key === baseKey);
        });
    }) || null;
}
function getFieldwireFloorplanSheets(floorplan) {
    const sheets = Array.isArray(floorplan === null || floorplan === void 0 ? void 0 : floorplan.sheets) ? floorplan.sheets : [];
    const currentSheet = (floorplan === null || floorplan === void 0 ? void 0 : floorplan.current_sheet) || (floorplan === null || floorplan === void 0 ? void 0 : floorplan.currentSheet);
    return currentSheet ? [currentSheet, ...sheets] : sheets;
}
function isFieldwireFloorplanReady(floorplan) {
    if (!floorplan) {
        return false;
    }
    const processState = normalizeLookupKey(floorplan.process_state || floorplan.processing_state || floorplan.state);
    if (processState && !['complete', 'completed', 'processed', 'ready'].includes(processState)) {
        return false;
    }
    return getFieldwireFloorplanSheets(floorplan).some((sheet) => {
        const width = toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.file_width) || toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.width);
        const height = toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.file_height) || toFiniteNumber(sheet === null || sheet === void 0 ? void 0 : sheet.height);
        return !!(sheet === null || sheet === void 0 ? void 0 : sheet.id) && !!width && !!height;
    });
}
function describeFieldwireFloorplanPending(floorplan) {
    const name = (floorplan === null || floorplan === void 0 ? void 0 : floorplan.name) ? ` ${floorplan.name}` : '';
    const processState = (floorplan === null || floorplan === void 0 ? void 0 : floorplan.process_state) || (floorplan === null || floorplan === void 0 ? void 0 : floorplan.processing_state) || (floorplan === null || floorplan === void 0 ? void 0 : floorplan.state);
    const reason = processState ? ` Current Fieldwire state: ${processState}.` : '';
    return `Fieldwire has accepted floorplan${name}, but it is not ready for task placement yet. Resolve any Fieldwire processing/version conflict and run Execute again.${reason}`;
}
function getFileBaseName(fileName) {
    const value = String(fileName || '').trim();
    const match = value.match(/\.([a-z0-9]{2,8})$/i);
    if (!match) {
        return value;
    }
    const extension = match[1].toLowerCase();
    const knownExtensions = new Set([
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'bmp',
        'tif',
        'tiff',
        'dwg',
        'dxf'
    ]);
    return knownExtensions.has(extension)
        ? value.slice(0, -(extension.length + 1)).trim()
        : value;
}
function normalizeLookupKey(value) {
    return String(value || '').trim().toLowerCase();
}
function toFiniteNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : null;
}
function formatPercent(value) {
    return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : 'unknown';
}
function toIsoString(value) {
    if (!value) {
        return null;
    }
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
}
function normalizeTemplatePayload(body) {
    return {
        templateId: body === null || body === void 0 ? void 0 : body.templateId,
        name: body === null || body === void 0 ? void 0 : body.name,
        visibility: body === null || body === void 0 ? void 0 : body.visibility,
        firewireForm: body === null || body === void 0 ? void 0 : body.firewireForm,
        worksheetData: body === null || body === void 0 ? void 0 : body.worksheetData
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
    return message.includes('missing ')
        || message.includes('invalid ')
        || message.includes('must be')
        || message.includes('cannot be changed');
}
function normalizeDailyForecastPayload(payload) {
    const source = Array.isArray(payload === null || payload === void 0 ? void 0 : payload.forecasts)
        ? payload.forecasts
        : Array.isArray(payload === null || payload === void 0 ? void 0 : payload.dailyForecasts)
            ? payload.dailyForecasts
            : Array.isArray(payload === null || payload === void 0 ? void 0 : payload.results)
                ? payload.results
                : [];
    return source.slice(0, 7).map((entry) => {
        var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
        const dateValue = firstString(entry === null || entry === void 0 ? void 0 : entry.date, entry === null || entry === void 0 ? void 0 : entry.validDate, (_b = entry === null || entry === void 0 ? void 0 : entry.summary) === null || _b === void 0 ? void 0 : _b.date, (_c = entry === null || entry === void 0 ? void 0 : entry.day) === null || _c === void 0 ? void 0 : _c.date);
        const parsedDate = dateValue ? new Date(dateValue) : null;
        const hasParsedDate = !!parsedDate && !Number.isNaN(parsedDate.getTime());
        return {
            date: hasParsedDate ? parsedDate.toISOString() : null,
            dayLabel: hasParsedDate
                ? new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsedDate)
                : '',
            phrase: firstString((_d = entry === null || entry === void 0 ? void 0 : entry.day) === null || _d === void 0 ? void 0 : _d.iconPhrase, (_e = entry === null || entry === void 0 ? void 0 : entry.day) === null || _e === void 0 ? void 0 : _e.shortPhrase, entry === null || entry === void 0 ? void 0 : entry.phrase, (_f = entry === null || entry === void 0 ? void 0 : entry.summary) === null || _f === void 0 ? void 0 : _f.phrase, (_g = entry === null || entry === void 0 ? void 0 : entry.night) === null || _g === void 0 ? void 0 : _g.iconPhrase) || 'Forecast Pending',
            iconCode: firstNumber((_h = entry === null || entry === void 0 ? void 0 : entry.day) === null || _h === void 0 ? void 0 : _h.iconCode, entry === null || entry === void 0 ? void 0 : entry.iconCode, (_j = entry === null || entry === void 0 ? void 0 : entry.summary) === null || _j === void 0 ? void 0 : _j.iconCode),
            minTemp: firstNumber((_l = (_k = entry === null || entry === void 0 ? void 0 : entry.temperature) === null || _k === void 0 ? void 0 : _k.minimum) === null || _l === void 0 ? void 0 : _l.value, (_o = (_m = entry === null || entry === void 0 ? void 0 : entry.temperature) === null || _m === void 0 ? void 0 : _m.min) === null || _o === void 0 ? void 0 : _o.value, (_q = (_p = entry === null || entry === void 0 ? void 0 : entry.night) === null || _p === void 0 ? void 0 : _p.temperature) === null || _q === void 0 ? void 0 : _q.value, (_s = (_r = entry === null || entry === void 0 ? void 0 : entry.realFeelTemperature) === null || _r === void 0 ? void 0 : _r.minimum) === null || _s === void 0 ? void 0 : _s.value),
            maxTemp: firstNumber((_u = (_t = entry === null || entry === void 0 ? void 0 : entry.temperature) === null || _t === void 0 ? void 0 : _t.maximum) === null || _u === void 0 ? void 0 : _u.value, (_w = (_v = entry === null || entry === void 0 ? void 0 : entry.temperature) === null || _v === void 0 ? void 0 : _v.max) === null || _w === void 0 ? void 0 : _w.value, (_y = (_x = entry === null || entry === void 0 ? void 0 : entry.day) === null || _x === void 0 ? void 0 : _x.temperature) === null || _y === void 0 ? void 0 : _y.value, (_0 = (_z = entry === null || entry === void 0 ? void 0 : entry.realFeelTemperature) === null || _z === void 0 ? void 0 : _z.maximum) === null || _0 === void 0 ? void 0 : _0.value),
            precipitationProbability: firstNumber((_1 = entry === null || entry === void 0 ? void 0 : entry.day) === null || _1 === void 0 ? void 0 : _1.precipitationProbability, entry === null || entry === void 0 ? void 0 : entry.precipitationProbability, (_2 = entry === null || entry === void 0 ? void 0 : entry.hoursOfRain) === null || _2 === void 0 ? void 0 : _2.value)
        };
    });
}
function firstString(...values) {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}
function firstNumber(...values) {
    for (const value of values) {
        const numeric = Number(value);
        if (Number.isFinite(numeric)) {
            return numeric;
        }
    }
    return null;
}
