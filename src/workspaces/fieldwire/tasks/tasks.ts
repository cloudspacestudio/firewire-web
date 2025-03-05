import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { TaskEmailParams } from './taskemail.params'
import { CreateTaskParams } from './project.task.params'
import { Utils } from '../../../core/utils'

export class FieldwireTasks {

    static manifestItems = [
        {
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
                        return res.status(200).json({
                            result
                        })
                    } catch (err: Error|any) {
                        console.error(err)
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
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
                        //console.dir(req.app.locals.importData)
                        if (!req.app.locals.importData) {
                            return res.status(400).json({
                                message: `Invalid Import CSV`
                            })
                        }
                        const rows = req.app.locals.importData
                        let importedCount = 0
                        for(let i = 0; i < rows.length; i++) {
                            const row = rows[i]
                            const task: CreateTaskParams = {
                                project_id: projectId,
                                creator_user_id: req.body.owner_user_id,
                                owner_user_id: req.body.owner_user_id,
                                floorplan_id: req.body.floorplan_id,
                                team_id: Utils.getTeamIdFromName(projectId, row['Visibility']),
                                is_local: req.body.floorplan_id?true:false,
                                name: `INSTALL: ${row['Name']}`,
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
                            importedCount++
                            await Utils.sleep(500)
                        }
                        return res.status(200).json({
                            message: `Imported ${importedCount} records`
                        })
                        
                    } catch (err: Error|any) {
                        console.error(err)
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
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
                        return res.status(201).json({
                            message: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }
    ]

}