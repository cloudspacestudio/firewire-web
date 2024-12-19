import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { TaskEmailParams } from './taskemail.params'

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