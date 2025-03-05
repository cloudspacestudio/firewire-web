import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'

export class FieldwireProjects {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/floorplans',
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
                        const result = await fieldwire.projectFloorplans(projectId, true)
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
            path: '/api/data/fieldwire/projects/:projectId/floorplans',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    res.setHeader('Content-Type', 'text/html')
                    try {
                        const projectId = req.params.projectId
                        if (!projectId) {
                            res.status(400).send('Invalid Payload: Missing projectId parameter')
                        }
                        const result: any = await fieldwire.projectFloorplans(projectId, true)
                        if (result) {
                            let output = `<table>`
                            result.forEach((row: any) => {
                                output+=`<tr>`
                                output+=`<td>${row.name}</td>`
                                output+=`<td>${row.description}</td>`
                                output+=`<td>${row.created_at}</td>`
                                output+=`<td>${row.updated_at}</td>`
                                output+=`</tr>`
                            })
                            output+=`</table>`
                            return res.status(200).send(output)
                        }
                        return res.status(200).send('<table><tr><td>No Data Found</td></tr></table>')
                    } catch (err: Error|any) {
                        return res.status(500).send(err && err.message ? err.message : err)
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/projects/:projectId/folders',
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
                        const result = await fieldwire.folders(projectId)
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
            path: '/api/fieldwire/projects/:projectId/sheets',
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
                        const result = await fieldwire.sheets(projectId)
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
            path: '/api/fieldwire/projects/:projectId/statuses',
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
                        const result = await fieldwire.statuses(projectId)
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
            path: '/api/fieldwire/projects/:projectId/locations',
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
                        const result = await fieldwire.locations(projectId)
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
            path: '/api/fieldwire/projects/:projectId/teams',
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
                        const result = await fieldwire.teams(projectId)
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
                        const result = await fieldwire.tasks(projectId)
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
                        const result = await fieldwire.createTask({
                            project_id: projectId,
                            owner_user_id: req.body.owner_user_id,
                            floorplan_id: req.body.floorplan_id,
                            team_id: req.body.team_id,
                            is_local: req.body.floorplan_id?true:false,
                            name: req.body.name,
                            pos_x: req.body.pos_x,
                            pos_y: req.body.pos_y,
                            priority: req.body.priority,
                            status_id: req.body.status_id
                        })
                        return res.status(200).json({
                            result
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
            path: '/api/fieldwire/projects/:projectId/taskattributes',
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
                        const result = await fieldwire.taskattributes(projectId)
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
            path: '/api/fieldwire/projects/:projectId/taskcheckitems',
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
                        const result = await fieldwire.taskcheckitems(projectId)
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
            path: '/api/fieldwire/projects/:projectId/attachments',
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
                        const result = await fieldwire.attachments(projectId)
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
            path: '/api/fieldwire/projects/:projectId',
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
                        const result = await fieldwire.project(projectId)
                        return res.status(200).json({
                            data: result
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