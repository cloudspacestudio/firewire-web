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
exports.FieldwireProjects = void 0;
class FieldwireProjects {
}
exports.FieldwireProjects = FieldwireProjects;
_a = FieldwireProjects;
FieldwireProjects.manifestItems = [
    // Get Floorplans
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/floorplans',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.projectFloorplans(projectId, true);
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
    // Get as HTML Table
    {
        method: 'get',
        path: '/api/data/fieldwire/projects/:projectId/floorplans',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                res.setHeader('Content-Type', 'text/html');
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).send('Invalid Payload: Missing projectId parameter');
                    }
                    const result = yield fieldwire.projectFloorplans(projectId, true);
                    if (result) {
                        let output = `<table>`;
                        result.forEach((row) => {
                            output += `<tr>`;
                            output += `<td>${row.name}</td>`;
                            output += `<td>${row.description}</td>`;
                            output += `<td>${row.created_at}</td>`;
                            output += `<td>${row.updated_at}</td>`;
                            output += `</tr>`;
                        });
                        output += `</table>`;
                        return res.status(200).send(output);
                    }
                    return res.status(200).send('<table><tr><td>No Data Found</td></tr></table>');
                }
                catch (err) {
                    return res.status(500).send(err && err.message ? err.message : err);
                }
            }));
        }
    },
    // Get Folders
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/folders',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.folders(projectId);
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
    // Get Sheets
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/sheets',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.sheets(projectId);
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
    // Get Statuses (Priority 1, Not Started, Completed etc.)
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/statuses',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.statuses(projectId);
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
    // Get Project Locations (Office 1, Lab 2 etc.)
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/locations',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.locations(projectId);
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
    // Get Project Teams (Categories e.g. Speaker Strobe, Fire Alarm Panel etc.)
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/teams',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.teams(projectId);
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
    // Get Project Tasks
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/tasks',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.tasks(projectId);
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
    // Get Project Task Attributes
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/taskattributes',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.taskattributes(projectId);
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
    // Get Task Check Items
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/taskcheckitems',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.taskcheckitems(projectId);
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
    // Get Project Attachments
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/attachments',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.attachments(projectId);
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
    // Get Project Detail
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.project(projectId);
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
    }
];
