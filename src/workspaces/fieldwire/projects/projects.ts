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