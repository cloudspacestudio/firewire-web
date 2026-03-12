import * as express from 'express'
import {
    FirewireProjectSettingInput,
    FirewireProjectSettingsRepository
} from '../repository/firewireprojectsettings.repository'

export class FirewireProjectSettingsData {
    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/project-settings',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async() => {
                    try {
                        const repository = new FirewireProjectSettingsRepository(req.app)
                        const result = await repository.listAll()
                        return res.status(200).json({ data: result })
                    } catch (err: Error | any) {
                        return res.status(500).json({ message: err && err.message ? err.message : err })
                    }
                })
            }
        },
        {
            method: 'post',
            path: '/api/firewire/project-settings/items',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async() => {
                    try {
                        const userId = resolveUserId(req)
                        const payload = normalizePayload(req.body)
                        const repository = new FirewireProjectSettingsRepository(req.app)
                        const result = await repository.create(payload, userId)
                        return res.status(201).json({ data: result })
                    } catch (err: Error | any) {
                        const statusCode = isValidationError(err) ? 400 : 500
                        return res.status(statusCode).json({ message: err && err.message ? err.message : err })
                    }
                })
            }
        },
        {
            method: 'patch',
            path: '/api/firewire/project-settings/items/:itemId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async() => {
                    try {
                        const itemId = String(req.params.itemId || '').trim()
                        if (!itemId) {
                            return res.status(400).json({ message: 'Invalid payload: missing itemId parameter.' })
                        }
                        const userId = resolveUserId(req)
                        const payload = normalizePayload(req.body)
                        const repository = new FirewireProjectSettingsRepository(req.app)
                        const result = await repository.update(itemId, payload, userId)
                        if (!result) {
                            return res.status(404).json({ message: 'Setting not found.' })
                        }
                        return res.status(200).json({ data: result })
                    } catch (err: Error | any) {
                        const statusCode = isValidationError(err) ? 400 : 500
                        return res.status(statusCode).json({ message: err && err.message ? err.message : err })
                    }
                })
            }
        },
        {
            method: 'delete',
            path: '/api/firewire/project-settings/items/:itemId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async() => {
                    try {
                        const itemId = String(req.params.itemId || '').trim()
                        if (!itemId) {
                            return res.status(400).json({ message: 'Invalid payload: missing itemId parameter.' })
                        }
                        const repository = new FirewireProjectSettingsRepository(req.app)
                        const deleted = await repository.remove(itemId)
                        if (!deleted) {
                            return res.status(404).json({ message: 'Setting not found.' })
                        }
                        return res.status(204).send()
                    } catch (err: Error | any) {
                        return res.status(500).json({ message: err && err.message ? err.message : err })
                    }
                })
            }
        }
    ]

    static legacyFieldwireAliasItems = FirewireProjectSettingsData.manifestItems.map((item) => {
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

function normalizePayload(body: any): FirewireProjectSettingInput {
    return {
        listKey: body?.listKey,
        label: body?.label,
        description: body?.description,
        sortOrder: body?.sortOrder,
        isActive: body?.isActive
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
    return message.includes('missing ') || message.includes('invalid ')
}
