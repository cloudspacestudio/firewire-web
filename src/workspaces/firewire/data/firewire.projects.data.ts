import * as express from 'express'
import {
    FirewireProjectFieldwireMapInput,
    FirewireProjectInput,
    FirewireProjectRepository
} from '../repository/firewireproject.repository'

export class FirewireProjectsData {
    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/projects',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.listCombined()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error | any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/firewire/projects/firewire/:projectId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = String(req.params.projectId || '').trim()
                        if (!projectId) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing projectId parameter.'
                            })
                        }

                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.getFirewireProject(projectId)
                        if (!result) {
                            return res.status(404).json({
                                message: 'Project not found.'
                            })
                        }

                        return res.status(200).json({
                            data: result
                        })
                    } catch (err: Error | any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const userId = resolveUserId(req)
                        const payload = normalizePayload(req.body)
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.createFirewireProject(payload, userId)
                        return res.status(201).json({
                            data: result
                        })
                    } catch (err: Error | any) {
                        const statusCode = isValidationError(err) ? 400 : 500
                        return res.status(statusCode).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'patch',
            path: '/api/firewire/projects/firewire/:projectId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = String(req.params.projectId || '').trim()
                        if (!projectId) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing projectId parameter.'
                            })
                        }

                        const userId = resolveUserId(req)
                        const payload = normalizePayload(req.body)
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.updateFirewireProject(projectId, payload, userId)
                        if (!result) {
                            return res.status(404).json({
                                message: 'Project not found.'
                            })
                        }

                        return res.status(200).json({
                            data: result
                        })
                    } catch (err: Error | any) {
                        const statusCode = isValidationError(err) ? 400 : 500
                        return res.status(statusCode).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'patch',
            path: '/api/firewire/projects/firewire/:projectId/fieldwire',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const projectId = String(req.params.projectId || '').trim()
                        if (!projectId) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing projectId parameter.'
                            })
                        }

                        const userId = resolveUserId(req)
                        const payload = normalizeFieldwireMapPayload(req.body)
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.updateFieldwireMapping(projectId, payload, userId)
                        if (!result) {
                            return res.status(404).json({
                                message: 'Project not found.'
                            })
                        }

                        return res.status(200).json({
                            data: result
                        })
                    } catch (err: Error | any) {
                        const statusCode = isValidationError(err) ? 400 : 500
                        return res.status(statusCode).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }
    ]

    static legacyFieldwireAliasItems = FirewireProjectsData.manifestItems.map((item) => {
        const normalizedMethod = item.method.toLowerCase()
        const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
            ? normalizedMethod
            : 'get'

        return {
            ...item,
            method,
            path: item.path.replace('/api/firewire/', '/api/fieldwire/')
        }
    })
}

function normalizePayload(body: any): FirewireProjectInput {
    return {
        fieldwireId: body?.fieldwireId,
        name: body?.name,
        projectNbr: body?.projectNbr,
        address: body?.address,
        bidDueDate: body?.bidDueDate,
        projectStatus: body?.projectStatus,
        salesman: body?.salesman,
        jobType: body?.jobType,
        scopeType: body?.scopeType,
        projectScope: body?.projectScope,
        difficulty: body?.difficulty,
        totalSqFt: body?.totalSqFt
    }
}

function normalizeFieldwireMapPayload(body: any): FirewireProjectFieldwireMapInput {
    return {
        fieldwireId: body?.fieldwireId
    }
}

function resolveUserId(req: express.Request): string {
    const tokenOutput = (req as any).bearerTokenOutput || {}
    const candidates = [
        tokenOutput.preferred_username,
        tokenOutput.upn,
        tokenOutput.email,
        tokenOutput.unique_name,
        tokenOutput.name,
        tokenOutput.oid,
        tokenOutput.sub
    ]

    for (const candidate of candidates) {
        if (typeof candidate === 'string' && candidate.trim().length > 0) {
            return candidate.trim()
        }
    }

    throw new Error('Unable to resolve request user context from bearer token.')
}

function isValidationError(err: any): boolean {
    const message = typeof err?.message === 'string' ? err.message.toLowerCase() : ''
    return message.includes('missing ') || message.includes('invalid ') || message.includes('must be')
}
