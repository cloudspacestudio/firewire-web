import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { TaskEmailParams } from './taskemail.params'
import { CreateTaskParams } from './project.task.params'
import { Utils } from '../../../core/utils'
import { ImportItem } from './importitem.schemas'

export class FieldwireTasks {

    static manifestItems = [
        FieldwireTasks.getProjectTasks(),
        FieldwireTasks.getProjectTaskTypeAttributes(),
        FieldwireTasks.createProjectTask(),
        FieldwireTasks.importProjectTasks(),
        FieldwireTasks.createProjectTask(),
        FieldwireTasks.deleteTasks()
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
                        const result = await fieldwire.projectTaskTypeAttrinutes(projectId)
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
                        const user_id = req.body.owner_user_id
                        const floorplan_id = req.body.floorplan_id
                        const batchId = req.body.batch_id
                        const locationId = req.body.location_id

                        // pull importData from Sql Server by projectId and batchId


                        // console.dir(req.app.locals.importData)
                        if (!req.app.locals.importData) {
                            return res.status(400).json({
                                message: `Invalid Import CSV`
                            })
                        }
                        const rows: ImportItem[] = req.app.locals.importData
                        let importedCount = 0
                        const output: any[] = []
                        for(let i = 0; i < rows.length; i++) {
                            const row = rows[i]
                            // Todo: Get category for row
                            // Is Master or Sub Task
                            const task: CreateTaskParams = {
                                project_id: projectId,
                                creator_user_id: user_id,
                                owner_user_id: user_id,
                                floorplan_id: floorplan_id,
                                team_id: FieldwireSDK.getTeamIdFromName(projectId, row['Visibility']),
                                is_local: floorplan_id?true:false,
                                // Name Sample: 0020020161 - Power Monitor Shunt (CT1)
                                name: `${row['Address']} - ${row['Visibility']} (${'CT1'})`, // TODO: Category Handle
                                pos_x: req.body.pos_x,
                                pos_y: req.body.pos_y,
                                priority: req.body.priority,
                                location_id: locationId
                            }
                            if (req.body.due_date) task.due_date=req.body.due_date
                            if (req.body.cost_value) task.cost_value=req.body.cost_value
                            if (req.body.man_power_value) task.man_power_value=req.body.man_power_value
                            const result = await fieldwire.createTask(task)
                            output.push(result)
                            importedCount++
                            await Utils.sleep(500)
                        }
                        res.status(200).json({
                            message: `Imported ${importedCount} records`
                        })
                        return resolve(output)
                        
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

                        const result = await fieldwire.deleteAllTasks(projectId, true)
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
}