import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { CreateFormSchema } from '../schemas/createform.schema'
import { DailyReportSchema } from '../schemas/dailyreport.schema'

export class FieldwireForms {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/formtemplates',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const result = await fieldwire.projectFormTemplates(projectId)
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/formtemplatestatuses',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const result = await fieldwire.projectFormTemplateStatuses(projectId)
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/forms',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const result = await fieldwire.projectForms(projectId)
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/forms/:formId/full',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        const result = await fieldwire.projectFormFull(projectId, req.params.formId)
                        return res.status(200).json(result)
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        FieldwireForms.createForm(),
        FieldwireForms.loadDailyReport()
    ]

    static createForm() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/forms',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const params: CreateFormSchema = {
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
                        }
                        const result = await fieldwire.createProjectForm(projectId, params)
                        res.status(201).json(result)
                        return resolve(true)
                    } catch (err: Error|any) {
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                        return resolve(err)
                    }
                })
            }
        }
    }
    static loadDailyReport() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/forms/loaddailyreport',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const params: DailyReportSchema = {
                            form_id: req.body.form_id,
                            worklog: req.body.worklog
                        }
                        const result = await fieldwire.loadDailyReport(projectId, params)
                        res.status(200).json(result)
                        return resolve(result)
                    } catch (err: Error|any) {
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                        return resolve(err)
                    }
                })
            }
        }
    }

}