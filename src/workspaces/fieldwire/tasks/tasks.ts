import * as express from 'express'
import { v4 } from 'uuid'
import multer from 'multer'
import { parse } from 'csv-parse'
import fs from 'fs'
import path from 'path'

import { FieldwireSDK } from '../fieldwire'
import { TaskEmailParams } from './taskemail.params'
import { CreateTaskParams } from './project.task.params'
import { ResolverParams } from './resolvers/resolver.params'
import { ImportItem } from '../schemas/importitem.schemas'

//const upload = multer({ dest: 'uploads/' }); // stores files in /uploads
const uploadImport = multer({ dest: 'uploads/' }).single('file')
                
export class FieldwireTasks {

    static manifestItems = [
        FieldwireTasks.getProjectTasks(),
        FieldwireTasks.getProjectTaskTypeAttributes(),
        FieldwireTasks.createProjectTask(),
        FieldwireTasks.importProjectTasks(),
        FieldwireTasks.createProjectTask(),
        FieldwireTasks.deleteTasks(),
        FieldwireTasks.seedFromTestDevices(),
        FieldwireTasks.getFloorplanTasks(),
        FieldwireTasks.taskFilterByStatus(),
        FieldwireTasks.getTaskDetail(),
        FieldwireTasks.getRelatedTasks()
    ]

    static getProjectTasks() {
        return {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/tasks',
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
                        const result = await fieldwire.projectTasks(projectId)
                        res.status(200).json({
                            rows: result
                        })
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

    static getFloorplanTasks() {
        return {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/floorplans/:floorplanId/tasks',
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
                        const floorplanId = req.params.floorplanId
                        if (!floorplanId) {
                            res.status(400).json({
                                message: `Invalid Payload: Missing floorplanId parameter`
                            })
                        }
                        const result = await fieldwire.projectFloorplanTasks(projectId, floorplanId)
                        res.status(200).json({
                            rows: result
                        })
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

    static getRelatedTasks() {
        return {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/tasks/:taskId/related',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = req.params.projectId
                        const taskId = req.params.taskId
                        if (!projectId) {
                            res.status(400).json({
                                message: 'Invalid Payload: Missing projectId parameter'
                            })
                        }
                        const result = await fieldwire.taskRelatedTasks(projectId, taskId)
                        res.status(200).json(result)
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

    static getTaskDetail() {
        return {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/tasks/:taskId',
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
                        const taskId = req.params.taskId
                        if (!taskId) {
                            res.status(400).json({
                                message: `Invalid Payload: Missing taskId parameter`
                            })
                        }
                        const result = await fieldwire.taskDetail(projectId, taskId)
                        res.status(200).json(result)
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

    static getProjectTaskTypeAttributes() {
        return {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/tasktypeattributes',
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
                        const result = await fieldwire.projectTaskTypeAttributes(projectId)
                        res.status(200).json({
                            rows: result
                        })
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

    static taskFilterByStatus() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/taskfilterbystatus',
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
                        if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                            res.status(404).json({
                                message: `Invalid Project Id: ${projectId} is not an editable project id`
                            })
                        }
                        const statusId = req.body.statusId
                        const startDateParam = req.body.startDate
                        const endDateParam = req.body.endDate
                        if (!statusId || !startDateParam || !endDateParam) {
                            return res.status(400).json({
                                message: 'Bad Request'
                            })
                        }
                        const startDate = new Date(startDateParam)
                        const endDate = new Date(endDateParam)
                        const result = await fieldwire.taskFilterByStatus(projectId, statusId, startDateParam, endDateParam)
                        res.status(200).json(result)
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



    static seedFromTestDevices() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/seedtestdevices',
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
                        if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                            res.status(404).json({
                                message: `Invalid Project Id: ${projectId} is not an editable project id`
                            })
                        }
                        const result = await fieldwire.seedFromTestDevices(req.app)
                        res.status(200).json(result)
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

    static createProjectTask() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/tasks',
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
                        if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                            res.status(404).json({
                                message: `Invalid Project Id: ${projectId} is not an editable project id`
                            })
                        }
                        const task: CreateTaskParams = {
                            project_id: projectId,
                            creator_user_id: req.body.owner_user_id,
                            owner_user_id: req.body.owner_user_id,
                            floorplan_id: req.body.floorplan_id,
                            team_id: req.body.team_id,
                            is_local: req.body.floorplan_id?true:false,
                            name: req.body.name,
                            pos_x: req.body.pos_x,
                            pos_y: req.body.pos_y,
                            priority: req.body.priority,
                            status_id: req.body.status_id
                        }
                        if (req.body.task_type_id) task.task_type_id=req.body.task_type_id
                        if (req.body.location_id) task.location_id=req.body.location_id
                        if (req.body.due_date) task.due_date=req.body.due_date
                        if (req.body.cost_value) task.cost_value=req.body.cost_value
                        if (req.body.man_power_value) task.man_power_value=req.body.man_power_value
                        if (req.body.due_at) task.due_at=req.body.due_at
                        if (req.body.end_at) task.end_at=req.body.end_at
                        if (req.body.start_at) task.start_at=req.body.start_at
                        if (req.body.fixed_at) task.fixed_at=req.body.fixed_at
                        if (req.body.verified_at) task.verified_at=req.body.verified_at
                        const result = await fieldwire.createTask(task)
                        res.status(200).json({
                            result
                        })
                        return resolve(true)
                    } catch (err: Error|any) {
                        console.error(err)
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                        return resolve(err)
                    }
                })
            }
        }        
    }



    static importProjectTasks() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/tasks/import',
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
                        if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                            res.status(404).json({
                                message: `Invalid Project Id: ${projectId} is not an editable project id`
                            })
                        }
                        let fileDetails: any = await this.getUpload(req, res)
                        const filepath = path.resolve(fileDetails.path)
                        let rawData = await this.readUpload(filepath)

                        const batchId = v4()
                        const userId = '1684559'
                        const floorplanId = req.body.floorplanId
                        const locationId = req.body.locationId // if static value for upload
                        const preview = true //req.body.preview // if set to true, will not commit changes

                        if (!rawData) {
                            return res.status(400).json({
                                message: `Invalid Import CSV`
                            })
                        }
                        console.dir({
                            batchId, userId, floorplanId, locationId, preview
                        })
                        //res.status(200).json(rawData)
                        //return resolve(true)
                        const rows: ImportItem[] = rawData

                        // get map information for import operation
                        //  by project with optional batch override
                        //  maps by device or category
                        //  resolve device, title, category, location, address, priority, sub tasks
                        const resolverParams: ResolverParams = {
                            batchId, projectId, userId, floorplanId, locationId, previewMode: preview
                        }
                        if (preview) {
                            const result = await fieldwire.importTasks(resolverParams, rows, req.app)
                            res.status(200).json(result)
                            return resolve(true)                            
                        } else {
                            const result = await fieldwire.importTasksCommit(resolverParams, rows, req.app)
                            res.status(200).json(result)
                            return resolve(true)
                        }
                    } catch (err: Error|any) {
                        console.error(err)
                        res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                        return resolve(err)
                    }
                })
            }
        }
    }

    static deleteTasks() {
        return {
            method: 'delete',
            path: '/api/fieldwire/projects/:projectId/tasks/deleteall',
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
                        if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                            res.status(404).json({
                                message: `Invalid Project Id: ${projectId} is not an editable project id`
                            })
                        }

                        const result = await fieldwire.deleteAllTasks(projectId, false)
                        res.status(200).json(result)
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

    static createTaskEmail() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/tasks/:taskId/email',
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
                        const taskId = req.params.taskId
                        if (!taskId) {
                            res.status(400).json({
                                message: `Invalid Payload: Missing taskId parameter`
                            })
                        }
                        const params: TaskEmailParams = {
                            projectId,
                            taskId,
                            subject: req.body.subject,
                            body: req.body.body,
                            cc_sender: req.body.cc_sender,
                            email: req.body.email,
                            kind: req.body.kind
                        }
                        const result = await fieldwire.taskEmail(params)
                        res.status(201).json({
                            message: result
                        })
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

    static getUpload(req: express.Request, res: express.Response) {
        return new Promise(async(resolve, reject) => {
            try {
                uploadImport(req, res, function (err) {
                    if (err instanceof multer.MulterError) {
                        // A Multer error occurred when uploading.
                        return reject(err)
                    } else if (err) {
                        // An unknown error occurred when uploading.
                        return reject(err)
                    }
                    // Everything went fine.
                    return resolve(req.file)
                })
            } catch (err2) {
                return reject(err2)
            }
        })
    }

    static readUpload(filepath: string): Promise<any[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const records: any[] = [];
                fs.createReadStream(filepath)
                    .pipe(parse({ columns: true, trim: true }))
                    .on('data', (row) => {
                        records.push(row);
                    })
                    .on('end', () => {
                        fs.unlinkSync(filepath); // remove temp file
                        return resolve(records)
                    })
                    .on('error', (err) => {
                        fs.unlinkSync(filepath); // clean up
                        return reject(err)
                    });

            } catch (err2) {
                return reject(err2)
            }
        })
    }
}
// load importData from file upload .csv
/*
    Floorplan: Sample 1 - fb687444-8d64-4d62-b04f-6ae9cc925ac7
    Floorplan: James St - 5e96c01d-a150-4983-8f18-25620f2f6e3e

    Name        SLCAddr Serial  Strobe  Speaker  
    --------------------------------------------------------------------------------
    Annuciator  MAC     N/A     N/A     N/A     B7B2BC9F-4347-45B4-8E9A-742CDEE00784
    APC (auxi)  N/A     N/A     N/A     N/A     565BE581-0F1C-4961-A265-499B69F69E86
    DOC         N/A     N/A     N/A     N/A     3E78D47D-B33E-4BE4-A948-0C732BC1D219
    Smoke Det   null    null    N/A     N/A     7E1AA044-FDF5-49D9-B187-8B0F4AA5BF4E
    Smoke Base  null    null    null    N/A     E0494009-3281-4A1E-9160-8973B2B76BB6
    Speak Ceil  N/A     N/A     null    null    9809FDBF-A07F-4472-A033-9C0774D4373F
    Strobe Ceil N/A     N/A     null    N/A     1BC630F0-E3D5-4CA6-9B0A-C50997B8A262
*/
/*
const rawData = [
    {Handle: 'a', Visibility: 'Annunciator', PosX: 10.00, PosY: 10.00, ADDRESS1: '0020060013', ADDRESS2: '01:23:45:67:89:AB'},
    {Handle: 'b', Visibility: 'APS (Auxiliary Power Supply)', PosX: 20.00, PosY: 20.00, ADDRESS1: '0020060015'},
    {Handle: 'c', Visibility: 'DOC (Document Storage Cabinet)', PosX: 30.00, PosY: 30.00, ADDRESS1: '0020060004'},
    {Handle: 'd', Visibility: 'Smoke Detector', PosX: 40.00, PosY: 40.00, ADDRESS1: '0020060023'},
    {Handle: 'e', Visibility: 'Smoke Detector with Sounder Base', PosX: 50.00, PosY: 50.00, ADDRESS1: '0020060025'},
    {Handle: 'f', Visibility: 'Speaker/Strobe - Ceiling', PosX: 60.00, PosY: 60.00, ADDRESS1: '0020060003'},
    {Handle: 'g', Visibility: 'Strobe - Ceiling', PosX: 70.00, PosY: 70.00, ADDRESS1: '0020060017'}
]
// console.dir(req.app.locals.importData)

*/