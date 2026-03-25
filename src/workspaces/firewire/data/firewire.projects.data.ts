import * as express from 'express'
import {
    FirewireProjectFieldwireMapInput,
    FirewireProjectInput,
    FirewireProjectTemplateInput,
    FirewireProjectRepository
} from '../repository/firewireproject.repository'

export class FirewireProjectsData {
    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/project-templates',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const userId = resolveUserId(req)
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.listProjectTemplates(userId)
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
            method: 'post',
            path: '/api/firewire/project-templates',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const userId = resolveUserId(req)
                        const payload = normalizeTemplatePayload(req.body)
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.saveProjectTemplate(payload, userId)
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
            path: '/api/firewire/projects/firewire/:projectId/lock',
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
                        const isLocked = !!req.body?.isLocked
                        const repository = new FirewireProjectRepository(req.app)
                        const result = await repository.updateManualLock(projectId, isLocked, userId)
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
            path: '/api/firewire/projects/map-config',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim()
                        return res.status(200).json({
                            data: {
                                subscriptionKey: subscriptionKey || null
                            }
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
            path: '/api/firewire/projects/weather-forecast',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const latitude = Number(req.query.latitude)
                        const longitude = Number(req.query.longitude)
                        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                            return res.status(400).json({
                                message: 'Invalid payload: latitude and longitude query parameters are required.'
                            })
                        }

                        const subscriptionKey = (process.env.AZURE_MAPS_SUBSCRIPTION_KEY || process.env.AZURE_MAPS_KEY || '').trim()
                        if (!subscriptionKey) {
                            return res.status(200).json({
                                data: {
                                    forecast: [],
                                    status: 'not-configured'
                                }
                            })
                        }

                        const apiVersion = (process.env.AZURE_MAPS_WEATHER_API_VERSION || '1.1').trim()
                        const baseUrl = (process.env.AZURE_MAPS_BASE_URL || 'https://atlas.microsoft.com').trim().replace(/\/$/, '')
                        const url = `${baseUrl}/weather/forecast/daily/json?api-version=${encodeURIComponent(apiVersion)}&subscription-key=${encodeURIComponent(subscriptionKey)}&query=${encodeURIComponent(`${latitude},${longitude}`)}&duration=10&language=en-US&unit=imperial`

                        const response = await fetch(url, {
                            method: 'GET',
                            headers: {
                                Accept: 'application/json'
                            }
                        })

                        if (!response.ok) {
                            return res.status(200).json({
                                data: {
                                    forecast: [],
                                    status: 'unavailable'
                                }
                            })
                        }

                        const payload = await response.json() as any
                        return res.status(200).json({
                            data: {
                                forecast: normalizeDailyForecastPayload(payload),
                                status: 'ok'
                            }
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
        worksheetData: body?.worksheetData,
        name: body?.name,
        projectNbr: body?.projectNbr,
        address: body?.address,
        bidDueDate: body?.bidDueDate,
        projectStatus: body?.projectStatus,
        projectType: body?.projectType,
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

function normalizeTemplatePayload(body: any): FirewireProjectTemplateInput {
    return {
        templateId: body?.templateId,
        name: body?.name,
        visibility: body?.visibility,
        firewireForm: body?.firewireForm,
        worksheetData: body?.worksheetData
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
    return message.includes('missing ')
        || message.includes('invalid ')
        || message.includes('must be')
        || message.includes('cannot be changed')
}

function normalizeDailyForecastPayload(payload: any): Array<{
    date: string | null
    dayLabel: string
    phrase: string
    iconCode: number | null
    minTemp: number | null
    maxTemp: number | null
    precipitationProbability: number | null
}> {
    const source = Array.isArray(payload?.forecasts)
        ? payload.forecasts
        : Array.isArray(payload?.dailyForecasts)
            ? payload.dailyForecasts
            : Array.isArray(payload?.results)
                ? payload.results
                : []

    return source.slice(0, 7).map((entry: any) => {
        const dateValue = firstString(entry?.date, entry?.validDate, entry?.summary?.date, entry?.day?.date)
        const parsedDate = dateValue ? new Date(dateValue) : null
        const hasParsedDate = !!parsedDate && !Number.isNaN(parsedDate.getTime())

        return {
            date: hasParsedDate ? parsedDate!.toISOString() : null,
            dayLabel: hasParsedDate
                ? new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsedDate!)
                : '',
            phrase: firstString(
                entry?.day?.iconPhrase,
                entry?.day?.shortPhrase,
                entry?.phrase,
                entry?.summary?.phrase,
                entry?.night?.iconPhrase
            ) || 'Forecast Pending',
            iconCode: firstNumber(entry?.day?.iconCode, entry?.iconCode, entry?.summary?.iconCode),
            minTemp: firstNumber(
                entry?.temperature?.minimum?.value,
                entry?.temperature?.min?.value,
                entry?.night?.temperature?.value,
                entry?.realFeelTemperature?.minimum?.value
            ),
            maxTemp: firstNumber(
                entry?.temperature?.maximum?.value,
                entry?.temperature?.max?.value,
                entry?.day?.temperature?.value,
                entry?.realFeelTemperature?.maximum?.value
            ),
            precipitationProbability: firstNumber(
                entry?.day?.precipitationProbability,
                entry?.precipitationProbability,
                entry?.hoursOfRain?.value
            )
        }
    })
}

function firstString(...values: any[]): string {
    for (const value of values) {
        if (typeof value === 'string' && value.trim()) {
            return value.trim()
        }
    }
    return ''
}

function firstNumber(...values: any[]): number | null {
    for (const value of values) {
        const numeric = Number(value)
        if (Number.isFinite(numeric)) {
            return numeric
        }
    }
    return null
}
