import * as express from 'express'
import {
    FirewireUserPreferencesPayload,
    FirewireUserPreferencesRepository
} from '../repository/firewireuserpreferences.repository'

export class FirewireUserPreferencesData {
    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/user-preferences',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const userId = resolveUserId(req)
                        const repository = new FirewireUserPreferencesRepository(req.app)
                        const result = await repository.getUserPreferences(userId)
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
            method: 'put',
            path: '/api/firewire/user-preferences',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const userId = resolveUserId(req)
                        const payload = normalizePayload(req.body)
                        const repository = new FirewireUserPreferencesRepository(req.app)
                        const result = await repository.saveUserPreferences(userId, payload, userId)
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

    static legacyFieldwireAliasItems = FirewireUserPreferencesData.manifestItems.map((item) => {
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

function normalizePayload(body: any): FirewireUserPreferencesPayload {
    return {
        homePage: {
            backgroundMode: body?.homePage?.backgroundMode,
            backgroundVideo: body?.homePage?.backgroundVideo,
            showRecentProjects: body?.homePage?.showRecentProjects,
            compactHero: body?.homePage?.compactHero,
            solidColor: body?.homePage?.solidColor,
            gradientFrom: body?.homePage?.gradientFrom,
            gradientTo: body?.homePage?.gradientTo,
            gradientAngle: body?.homePage?.gradientAngle
        },
        projectMap: {
            version: body?.projectMap?.version,
            style: body?.projectMap?.style,
            dimension: body?.projectMap?.dimension,
            showRoadDetails: body?.projectMap?.showRoadDetails,
            showBuildingFootprints: body?.projectMap?.showBuildingFootprints,
            autoFitPins: body?.projectMap?.autoFitPins
        },
        profile: {
            avatarDataUrl: body?.profile?.avatarDataUrl
        }
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
    return message.includes('invalid ') || message.includes('too large')
}
