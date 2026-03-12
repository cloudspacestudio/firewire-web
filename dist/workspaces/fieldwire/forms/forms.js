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
exports.FieldwireForms = void 0;
class FieldwireForms {
    static createForm() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/forms',
            fx: (req, res) => {
                const fieldwire = req.app.locals.fieldwire;
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const projectId = req.params.projectId;
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            });
                        }
                        const params = {
                            checksum: req.body.checksum,
                            form_template_form_status_id: req.body.form_template_form_status_id,
                            form_template_id: req.body.form_template_id,
                            is_generated: false,
                            kind: `single_day`,
                            name: req.body.name,
                            owner_user_id: 1684559,
                            creator_user_id: 1684559,
                            last_editor_user_id: 1684559,
                            start_at: req.body.start_at,
                            end_at: req.body.end_at
                        };
                        const result = yield fieldwire.createProjectForm(projectId, params);
                        res.status(201).json(result);
                        return resolve(true);
                    }
                    catch (err) {
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        });
                        return resolve(err);
                    }
                }));
            }
        };
    }
    static loadDailyReport() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/forms/loaddailyreport',
            fx: (req, res) => {
                const fieldwire = req.app.locals.fieldwire;
                return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                    try {
                        const projectId = req.params.projectId;
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            });
                        }
                        const params = {
                            form_id: req.body.form_id,
                            worklog: req.body.worklog
                        };
                        const result = yield fieldwire.loadDailyReport(projectId, params);
                        res.status(200).json(result);
                        return resolve(result);
                    }
                    catch (err) {
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        });
                        return resolve(err);
                    }
                }));
            }
        };
    }
}
exports.FieldwireForms = FieldwireForms;
_a = FieldwireForms;
FieldwireForms.manifestItems = [
    {
        method: 'get',
        path: '/api/fieldwire/projects/:projectId/formtemplates',
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
                    const result = yield fieldwire.projectFormTemplates(projectId);
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
        path: '/api/fieldwire/projects/:projectId/formtemplatestatuses',
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
                    const result = yield fieldwire.projectFormTemplateStatuses(projectId);
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
        path: '/api/fieldwire/projects/:projectId/forms',
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
                    const result = yield fieldwire.projectForms(projectId);
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
        path: '/api/fieldwire/projects/:projectId/forms/:formId/full',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    const result = yield fieldwire.projectFormFull(projectId, req.params.formId);
                    return res.status(200).json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    _a.createForm(),
    _a.loadDailyReport()
];
