import * as express from 'express'
import { FieldwireSDK } from '../../fieldwire/fieldwire'
import { SqlDb } from '../../fieldwire/repository/sqldb'
import { AzureBlobDocumentStorage } from './azure-blob-document-storage'
import {
    FirewireProjectFieldwireMapInput,
    FirewireProjectInput,
    FirewireProjectRecord,
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
            path: '/api/firewire/projects/firewire/:projectId/fieldwire-import/plan',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const projectId = String(req.params.projectId || '').trim()
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        })
                    }

                    const repository = new FirewireProjectRepository(req.app)
                    const project = await repository.getFirewireProject(projectId)
                    if (!project) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        })
                    }

                    const fieldwire = req.app.locals.fieldwire as FieldwireSDK
                    const sqldb = new SqlDb(req.app)
                    const plan = await buildFieldwireImportPlan(fieldwire, sqldb, project)
                    return res.status(200).json({
                        data: plan
                    })
                } catch (err: Error | any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/firewire/:projectId/fieldwire-import/execute',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const projectId = String(req.params.projectId || '').trim()
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        })
                    }

                    const userId = resolveUserId(req)
                    const repository = new FirewireProjectRepository(req.app)
                    const project = await repository.getFirewireProject(projectId)
                    if (!project) {
                        return res.status(404).json({
                            message: 'Project not found.'
                        })
                    }

                    const fieldwire = req.app.locals.fieldwire as FieldwireSDK
                    const sqldb = new SqlDb(req.app)
                    const result = await executeFieldwireImport(fieldwire, sqldb, repository, project, userId)
                    return res.status(200).json({
                        data: result,
                        message: result.message
                    })
                } catch (err: Error | any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'get',
            path: '/api/firewire/projects/:projectId/change-orders',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const projectId = String(req.params.projectId || '').trim()
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        })
                    }

                    const repository = new FirewireProjectRepository(req.app)
                    const rootProject = await resolveRootFirewireProject(req.app, repository, projectId)
                    if (!rootProject) {
                        return res.status(404).json({
                            message: 'Root project not found.'
                        })
                    }

                    const changeOrders = await listProjectChangeOrders(repository, rootProject)
                    return res.status(200).json({
                        data: {
                            rootProject,
                            changeOrders
                        }
                    })
                } catch (err: Error | any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/projects/:projectId/change-orders',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const projectId = String(req.params.projectId || '').trim()
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId parameter.'
                        })
                    }

                    const userId = resolveUserId(req)
                    const repository = new FirewireProjectRepository(req.app)
                    const rootProject = await resolveRootFirewireProject(req.app, repository, projectId)
                    if (!rootProject) {
                        return res.status(404).json({
                            message: 'Root project not found.'
                        })
                    }

                    const changeOrders = await listProjectChangeOrders(repository, rootProject)
                    const nextVersion = getNextChangeOrderVersion(changeOrders)
                    const versionLabel = nextVersion.toString().padStart(2, '0')
                    const rootProjectNbr = await resolveRootProjectNumber(req.app, rootProject)
                    const rootProjectName = getRootProjectName(rootProject.name)
                    const sqldb = new SqlDb(req.app)
                    const rootDocLibrary = await loadProjectDocLibraryPayload(sqldb, rootProject.uuid)
                    const worksheetData = buildChangeOrderWorksheetData(rootProject, rootDocLibrary, nextVersion, versionLabel, rootProjectNbr)
                    const created = await repository.createFirewireProject({
                        fieldwireId: null,
                        name: `${rootProjectName} - ${versionLabel}`,
                        projectNbr: rootProjectNbr ? `${rootProjectNbr}.${versionLabel}` : '',
                        address: rootProject.address,
                        bidDueDate: rootProject.bidDueDate,
                        projectStatus: 'Estimation',
                        projectType: rootProject.projectType,
                        salesman: rootProject.salesman,
                        jobType: rootProject.jobType,
                        scopeType: rootProject.scopeType,
                        projectScope: rootProject.projectScope,
                        difficulty: rootProject.difficulty,
                        totalSqFt: rootProject.totalSqFt,
                        worksheetData
                    }, userId)

                    await seedChangeOrderDocLibrary(sqldb, rootProject.uuid, created.uuid, rootDocLibrary, userId)

                    return res.status(201).json({
                        data: {
                            rootProject,
                            project: created,
                            version: versionLabel,
                            route: `/sales/${created.uuid}`
                        }
                    })
                } catch (err: Error | any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
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
            method: 'delete',
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
                        const deleted = await repository.deleteFirewireProject(projectId)
                        if (!deleted) {
                            return res.status(404).json({
                                message: 'Project not found.'
                            })
                        }

                        return res.status(200).json({
                            data: {
                                deleted: true
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

async function resolveRootFirewireProject(app: express.Application, repository: FirewireProjectRepository, projectKey: string): Promise<FirewireProjectRecord | null> {
    const directProject = await repository.getFirewireProject(projectKey)
    if (directProject) {
        return directProject
    }

    const firewireProjects = await repository.listFirewireProjects()
    const explicitMatch = firewireProjects.find((project) => String(project.fieldwireId || '') === projectKey)
    if (explicitMatch) {
        return repository.getFirewireProject(explicitMatch.uuid)
    }

    try {
        const fieldwire = app.locals.fieldwire as FieldwireSDK
        const fieldwireProject = await fieldwire.project(projectKey)
        const fieldwireCode = normalizeLookupKey(fieldwireProject?.code)
        const byProjectNumber = fieldwireCode
            ? firewireProjects.find((project) => normalizeLookupKey(project.projectNbr) === fieldwireCode)
            : null
        if (byProjectNumber) {
            return repository.getFirewireProject(byProjectNumber.uuid)
        }
    } catch {}

    return null
}

async function listProjectChangeOrders(repository: FirewireProjectRepository, rootProject: FirewireProjectRecord): Promise<FirewireProjectRecord[]> {
    const rootProjectNbr = getRootProjectNumber(rootProject.projectNbr)
    const allProjects = await repository.listFirewireProjects()
    const pattern = rootProjectNbr
        ? new RegExp(`^${escapeRegExp(rootProjectNbr)}\\.\\d{2}$`, 'i')
        : null
    const probableMatches = allProjects.filter((project) => {
        if (project.uuid === rootProject.uuid) {
            return false
        }
        if (pattern && pattern.test(String(project.projectNbr || '').trim())) {
            return true
        }
        return true
    })
    const hydrated = await Promise.all(probableMatches.map((project) => repository.getFirewireProject(project.uuid)))
    return hydrated
        .filter((project): project is FirewireProjectRecord => {
            if (!project || project.uuid === rootProject.uuid) {
                return false
            }
            if (pattern && pattern.test(String(project.projectNbr || '').trim())) {
                return true
            }
            return String(project.worksheetData?.changeOrderBaseline?.rootProjectId || '').trim().toLowerCase() === rootProject.uuid.toLowerCase()
        })
        .sort((left, right) => getChangeOrderVersionFromProject(left) - getChangeOrderVersionFromProject(right))
}

function getNextChangeOrderVersion(changeOrders: FirewireProjectRecord[]): number {
    const versions = changeOrders
        .map((project) => getChangeOrderVersionFromProject(project))
        .filter((version) => Number.isFinite(version) && version > 0)
    return versions.length > 0 ? Math.max(...versions) + 1 : 1
}

function getChangeOrderVersion(projectNbr: string): number {
    const match = String(projectNbr || '').trim().match(/\.(\d{2})$/)
    return match ? Number(match[1]) : 0
}

function getChangeOrderVersionFromProject(project: FirewireProjectRecord): number {
    const projectNbrVersion = getChangeOrderVersion(project.projectNbr)
    if (projectNbrVersion > 0) {
        return projectNbrVersion
    }
    const baselineVersion = Number(project.worksheetData?.changeOrderBaseline?.changeOrderVersion || 0)
    return Number.isFinite(baselineVersion) ? baselineVersion : 0
}

function getRootProjectNumber(projectNbr: string): string {
    return String(projectNbr || '').trim().replace(/\.\d{2}$/, '')
}

async function resolveRootProjectNumber(app: express.Application, rootProject: FirewireProjectRecord): Promise<string> {
    const firewireProjectNbr = getRootProjectNumber(rootProject.projectNbr)
    if (firewireProjectNbr) {
        return firewireProjectNbr
    }

    const fieldwireId = String(rootProject.fieldwireId || '').trim()
    if (!fieldwireId) {
        return ''
    }

    try {
        const fieldwire = app.locals.fieldwire as FieldwireSDK
        const fieldwireProject = await fieldwire.project(fieldwireId)
        return getRootProjectNumber(String(fieldwireProject?.code || '').trim())
    } catch {
        return ''
    }
}

function getRootProjectName(name: string): string {
    return String(name || '').trim().replace(/\s+-\s+\d{2}$/, '')
}

function buildChangeOrderWorksheetData(rootProject: FirewireProjectRecord, rootDocLibrary: any, changeOrderVersion: number, versionLabel: string, rootProjectNbr: string): any {
    const sourceWorksheetData = rootProject?.worksheetData || {}
    const customerInfo = sourceWorksheetData?.customerInfo && typeof sourceWorksheetData.customerInfo === 'object'
        ? JSON.parse(JSON.stringify(sourceWorksheetData.customerInfo))
        : undefined
    const reportSettings = sourceWorksheetData?.reportSettings && typeof sourceWorksheetData.reportSettings === 'object'
        ? JSON.parse(JSON.stringify(sourceWorksheetData.reportSettings))
        : undefined
    const floorplanFolders = Array.isArray(sourceWorksheetData?.floorplanFolders)
        ? JSON.parse(JSON.stringify(sourceWorksheetData.floorplanFolders))
        : undefined
    const bomSections = Array.isArray(sourceWorksheetData?.bomSections)
        ? JSON.parse(JSON.stringify(sourceWorksheetData.bomSections))
        : []
    const floorplans = getFirewireFloorplans(rootDocLibrary)
        .map((file: any) => ({
            id: file?.id,
            name: file?.name,
            sourceFileName: file?.sourceFileName,
            floorplanFolderId: file?.floorplanFolderId,
            floorplanDesign: file?.floorplanDesign ? JSON.parse(JSON.stringify(file.floorplanDesign)) : undefined
        }))

    return {
        ...(typeof customerInfo === 'undefined' ? {} : { customerInfo }),
        ...(typeof reportSettings === 'undefined' ? {} : { reportSettings }),
        ...(typeof floorplanFolders === 'undefined' ? {} : { floorplanFolders }),
        bomSections: [],
        changeOrderBaseline: {
            version: 1,
            rootProjectId: rootProject.uuid,
            rootProjectName: rootProject.name,
            rootProjectNbr: rootProjectNbr || rootProject.projectNbr,
            changeOrderVersion,
            changeOrderVersionLabel: versionLabel,
            capturedAt: new Date().toISOString(),
            bomSections,
            floorplanFolders: floorplanFolders || [],
            floorplans
        }
    }
}

async function seedChangeOrderDocLibrary(sqldb: SqlDb, rootProjectId: string, changeOrderProjectId: string, rootDocLibrary: any, userId: string): Promise<void> {
    const now = new Date().toISOString()
    const sourceFiles = getFirewireFloorplans(rootDocLibrary)
    const files = sourceFiles.map((file: any) => ({
        ...JSON.parse(JSON.stringify(file)),
        storageKey: rootProjectId,
        floorplanDesign: createEmptyChangeOrderFloorplanDesign(file?.floorplanDesign),
        createdAt: now,
        updatedAt: now,
        changeOrderSourceFileId: file?.id,
        changeOrderSourceProjectId: rootProjectId
    }))
    const payload = {
        files,
        directories: Array.isArray(rootDocLibrary?.directories)
            ? JSON.parse(JSON.stringify(rootDocLibrary.directories))
            : [],
        editMarkupDocuments: []
    }
    await sqldb.saveWorkspaceStorage('project-doc-library', changeOrderProjectId, JSON.stringify(payload), userId)
}

function createEmptyChangeOrderFloorplanDesign(sourceDesign: any): any {
    return {
        annotations: [],
        circuits: [],
        calibration: sourceDesign?.calibration ? JSON.parse(JSON.stringify(sourceDesign.calibration)) : undefined,
        rotationDegrees: Number(sourceDesign?.rotationDegrees || 0),
        symbolDisplayMode: sourceDesign?.symbolDisplayMode || 'icon',
        updatedAt: new Date().toISOString()
    }
}

function escapeRegExp(value: string): string {
    return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildFieldwireSymbolFinancialMap(project: FirewireProjectRecord): Map<string, { materialCost: number, laborHours: number }> {
    const result = new Map<string, { materialCost: number, laborHours: number }>()
    const bomSections = Array.isArray(project?.worksheetData?.bomSections) ? project.worksheetData.bomSections : []
    for (const section of bomSections) {
        const rows = Array.isArray(section?.rows) ? section.rows : []
        for (const row of rows) {
            const categoryName = String(row?.type || '').trim()
            const partNumber = String(row?.partNbr || '').trim()
            const deviceName = String(row?.description || row?.partNbr || categoryName).trim()
            const materialCost = toFiniteNumber(row?.cost) || 0
            const laborHours = toFiniteNumber(row?.labor) || 0
            if (!categoryName && !partNumber && !deviceName) {
                continue
            }

            const keys = [
                `${categoryName}::${partNumber || deviceName}`,
                `${categoryName}::${deviceName}`,
                partNumber,
                deviceName
            ].map((value) => normalizeLookupKey(value)).filter(Boolean)

            for (const key of keys) {
                if (!result.has(key)) {
                    result.set(key, { materialCost, laborHours })
                }
            }
        }
    }
    return result
}

function getFieldwireSymbolFinancials(symbol: any, symbolFinancials: Map<string, { materialCost: number, laborHours: number }>): { materialCost: number, laborHours: number } {
    const symbolCost = toFiniteNumber(symbol?.materialCost)
    const symbolLabor = toFiniteNumber(symbol?.laborHours)
    const lookupKeys = [
        symbol?.symbolId,
        `${symbol?.categoryName || ''}::${symbol?.partNumber || symbol?.deviceName || symbol?.label || symbol?.text || ''}`,
        `${symbol?.categoryName || ''}::${symbol?.deviceName || symbol?.label || symbol?.text || ''}`,
        symbol?.partNumber,
        symbol?.deviceName,
        symbol?.label,
        symbol?.text
    ].map((value) => normalizeLookupKey(value)).filter(Boolean)

    const fallback = lookupKeys.map((key) => symbolFinancials.get(key)).find(Boolean)
    return {
        materialCost: typeof symbolCost === 'number' && Number.isFinite(symbolCost) ? symbolCost : fallback?.materialCost || 0,
        laborHours: typeof symbolLabor === 'number' && Number.isFinite(symbolLabor) ? symbolLabor : fallback?.laborHours || 0
    }
}

async function buildFieldwireImportPlan(fieldwire: FieldwireSDK, sqldb: SqlDb, project: FirewireProjectRecord): Promise<any> {
    const accountProjects = await fieldwire.accountProjects()
    const normalizedProjectNbr = normalizeLookupKey(project.projectNbr)
    const fieldwireProject = (project.fieldwireId
        ? accountProjects.find((item: any) => String(item?.id || '') === project.fieldwireId)
        : null)
        || (normalizedProjectNbr
            ? accountProjects.find((item: any) => normalizeLookupKey(item?.code) === normalizedProjectNbr)
            : null)
        || null

    const workspace = await loadProjectDocLibraryPayload(sqldb, project.uuid)
    const floorplans = getFirewireFloorplans(workspace)
    const actionItems: any[] = []
    const floorplanPlans: any[] = []
    let taskCreateCount = 0

    if (!fieldwireProject) {
        actionItems.push({
            type: 'create-project',
            status: 'required',
            label: 'Create Fieldwire project',
            detail: `Create ${project.name || 'project'}${project.projectNbr ? ` with project number ${project.projectNbr}` : ''}.`
        })
    }

    const fieldwireFloorplans = fieldwireProject?.id
        ? await fieldwire.projectFloorplans(String(fieldwireProject.id), true)
        : []

    const fieldwireProjectId = fieldwireProject?.id ? String(fieldwireProject.id) : ''
    const fieldwireFloorplanTasksById = new Map<string, any[]>()
    for (const fieldwireFloorplan of fieldwireFloorplans as any[]) {
        const id = String(fieldwireFloorplan?.id || '')
        if (!id) {
            continue
        }
        if (!isFieldwireFloorplanReady(fieldwireFloorplan)) {
            fieldwireFloorplanTasksById.set(id, [])
            continue
        }
        try {
            fieldwireFloorplanTasksById.set(id, await fieldwire.projectFloorplanTasks(fieldwireProjectId, id))
        } catch {
            fieldwireFloorplanTasksById.set(id, [])
        }
    }

    for (const floorplan of floorplans) {
        const latestVersion = latestFileVersion(floorplan)
        const nameWithoutExtension = getFileBaseName(floorplan.name)
        const matchingFloorplan = findMatchingFieldwireFloorplan(fieldwireFloorplans, floorplan.name, nameWithoutExtension)
        const symbols = getFloorplanSymbols(floorplan)
        const matchingFloorplanReady = matchingFloorplan ? isFieldwireFloorplanReady(matchingFloorplan) : false
        const existingTasks = matchingFloorplan?.id ? (fieldwireFloorplanTasksById.get(String(matchingFloorplan.id)) || []) : []
        const taskPlans = symbols.map((symbol: any) => {
            const taskName = String(symbol.label || symbol.text || symbol.deviceName || symbol.categoryName || 'Symbol').trim()
            const existingTask = matchingFloorplanReady
                ? findExistingFieldwireTaskForSymbol(existingTasks, taskName, matchingFloorplan, symbol)
                : null
            const status = existingTask ? 'exists' : matchingFloorplan && !matchingFloorplanReady ? 'blocked' : 'required'
            if (status === 'required') {
                taskCreateCount += 1
            }
            return {
                annotationId: symbol.id,
                taskName,
                xRatio: toFiniteNumber(symbol.xRatio),
                yRatio: toFiniteNumber(symbol.yRatio),
                categoryName: symbol.categoryName || '',
                partNumber: symbol.partNumber || '',
                deviceName: symbol.deviceName || '',
                status,
                fieldwireTaskId: existingTask?.id || null
            }
        })

        const floorplanStatus = matchingFloorplan
            ? matchingFloorplanReady ? 'exists' : 'processing'
            : 'required'
        if (floorplanStatus === 'required') {
            actionItems.push({
                type: 'create-floorplan',
                status: 'required',
                label: `Create floorplan ${floorplan.name}`,
                detail: latestVersion?.sourceFileName || floorplan.name,
                firewireFileId: floorplan.id
            })
        }
        for (const taskPlan of taskPlans.filter((item: any) => item.status === 'required')) {
            actionItems.push({
                type: 'create-task',
                status: 'required',
                label: `Create task ${taskPlan.taskName}`,
                detail: `Place on ${floorplan.name} at ${formatPercent(taskPlan.xRatio)}, ${formatPercent(taskPlan.yRatio)}.`,
                firewireFileId: floorplan.id,
                annotationId: taskPlan.annotationId
            })
        }

        floorplanPlans.push({
            firewireFileId: floorplan.id,
            fileName: floorplan.name,
            sourceFileName: latestVersion?.sourceFileName || floorplan.name,
            mimeType: latestVersion?.mimeType || '',
            sizeBytes: latestVersion?.sizeBytes || 0,
            symbolCount: symbols.length,
            status: floorplanStatus,
            fieldwireFloorplanId: matchingFloorplan?.id || null,
            fieldwireFloorplanName: matchingFloorplan?.name || '',
            fieldwireCreatedAt: toIsoString(matchingFloorplan?.created_at),
            fieldwireUpdatedAt: toIsoString(matchingFloorplan?.updated_at),
            tasks: taskPlans
        })
    }

    return {
        project: {
            id: project.uuid,
            name: project.name,
            projectNbr: project.projectNbr,
            address: project.address,
            status: project.projectStatus,
            fieldwireId: project.fieldwireId
        },
        fieldwireProject: fieldwireProject ? {
            id: fieldwireProject.id,
            name: fieldwireProject.name || '',
            code: fieldwireProject.code || '',
            address: fieldwireProject.address || '',
            createdAt: toIsoString(fieldwireProject.created_at),
            updatedAt: toIsoString(fieldwireProject.updated_at),
            url: `https://app.fieldwire.com/projects/${fieldwireProject.id}`
        } : null,
        status: fieldwireProject ? 'project-exists' : 'project-missing',
        canImport: actionItems.length > 0,
        summary: {
            floorplans: floorplanPlans.length,
            floorplansToCreate: floorplanPlans.filter((item) => item.status === 'required').length,
            tasksToCreate: taskCreateCount,
            actionsRequired: actionItems.length
        },
        floorplans: floorplanPlans,
        actionItems
    }
}

async function executeFieldwireImport(
    fieldwire: FieldwireSDK,
    sqldb: SqlDb,
    repository: FirewireProjectRepository,
    project: FirewireProjectRecord,
    userId: string
): Promise<any> {
    const results: any[] = []
    let workingProject = project
    let plan = await buildFieldwireImportPlan(fieldwire, sqldb, workingProject)
    if (!plan.canImport) {
        return {
            success: true,
            message: 'Fieldwire is already current for this project.',
            results: []
        }
    }

    let fieldwireProject = plan.fieldwireProject
    if (!fieldwireProject) {
        try {
            const createdProject = await fieldwire.createProject({
                name: String(workingProject.name || '').trim(),
                code: String(workingProject.projectNbr || '').trim() || undefined,
                address: String(workingProject.address || '').trim() || undefined,
                time_zone: 'America/Chicago'
            })
            fieldwireProject = {
                id: createdProject.id,
                name: createdProject.name || workingProject.name,
                code: createdProject.code || workingProject.projectNbr,
                address: createdProject.address || workingProject.address,
                createdAt: toIsoString(createdProject.created_at),
                updatedAt: toIsoString(createdProject.updated_at),
                url: `https://app.fieldwire.com/projects/${createdProject.id}`
            }
            fieldwire.allowEditableProject(String(createdProject.id))
            const mappedProject = await repository.updateFieldwireMapping(workingProject.uuid, {
                fieldwireId: String(createdProject.id)
            }, userId)
            if (mappedProject) {
                workingProject = mappedProject
            }
            results.push({
                type: 'create-project',
                label: 'Create Fieldwire project',
                status: 'success',
                detail: `Created ${fieldwireProject.name}.`
            })
        } catch (err: any) {
            results.push({
                type: 'create-project',
                label: 'Create Fieldwire project',
                status: 'failed',
                detail: err?.message || String(err)
            })
            return {
                success: false,
                message: 'Fieldwire import failed while creating the project.',
                results
            }
        }
    } else {
        fieldwire.allowEditableProject(String(fieldwireProject.id))
    }

    const fieldwireProjectId = String(fieldwireProject.id)
    const workspace = await loadProjectDocLibraryPayload(sqldb, workingProject.uuid)
    const floorplans = getFirewireFloorplans(workspace)
    const floorplansByFirewireFileId = new Map<string, any>()
    let fieldwireFloorplans = await fieldwire.projectFloorplans(fieldwireProjectId, true)
    const taskContext = await loadFieldwireTaskContext(fieldwire, fieldwireProjectId)
    const symbolFinancials = buildFieldwireSymbolFinancialMap(workingProject)

    for (const floorplan of floorplans) {
        const baseName = getFileBaseName(floorplan.name)
        let matchingFloorplan = findMatchingFieldwireFloorplan(fieldwireFloorplans as any[], floorplan.name, baseName)
        if (!matchingFloorplan) {
            try {
                const sheetUpload = await createFieldwireFloorplanFromFirewireFile(fieldwire, workingProject.uuid, fieldwireProjectId, taskContext.userId, floorplan)
                matchingFloorplan = await waitForFieldwireFloorplan(fieldwire, fieldwireProjectId, floorplan.name, baseName, sheetUpload?.id)
                if (matchingFloorplan) {
                    fieldwireFloorplans = await fieldwire.projectFloorplans(fieldwireProjectId, true)
                    if (isFieldwireFloorplanReady(matchingFloorplan)) {
                        results.push({
                            type: 'create-floorplan',
                            label: `Create floorplan ${floorplan.name}`,
                            status: 'success',
                            detail: 'Uploaded sheet/floorplan to Fieldwire and it is ready for tasks.'
                        })
                    } else {
                        results.push({
                            type: 'create-floorplan',
                            label: `Create floorplan ${floorplan.name}`,
                            status: 'skipped',
                            detail: describeFieldwireFloorplanPending(matchingFloorplan)
                        })
                    }
                } else {
                    results.push({
                        type: 'create-floorplan',
                        label: `Create floorplan ${floorplan.name}`,
                        status: 'pending',
                        detail: 'Fieldwire accepted the upload, but the new floorplan is still processing or awaiting conflict resolution. Run Execute again after Fieldwire finishes processing.'
                    })
                }
            } catch (err: any) {
                results.push({
                    type: 'create-floorplan',
                    label: `Create floorplan ${floorplan.name}`,
                    status: 'failed',
                    detail: err?.message || String(err)
                })
            }
        }
        if (matchingFloorplan?.id) {
            if (isFieldwireFloorplanReady(matchingFloorplan)) {
                matchingFloorplan = await ensureFieldwireFloorplanName(fieldwire, fieldwireProjectId, matchingFloorplan, baseName)
            }
            floorplansByFirewireFileId.set(String(floorplan.id), matchingFloorplan)
        }
    }

    for (const floorplan of floorplans) {
        let matchingFloorplan = floorplansByFirewireFileId.get(String(floorplan.id))
            || findMatchingFieldwireFloorplan(fieldwireFloorplans as any[], floorplan.name, getFileBaseName(floorplan.name))
        const symbols = getFloorplanSymbols(floorplan)
        const createdSymbolIds = new Set<string>()
        if (!matchingFloorplan?.id) {
            const symbolCount = symbols.length
            if (symbolCount > 0) {
                results.push({
                    type: 'create-task',
                    label: `Create ${symbolCount} task${symbolCount === 1 ? '' : 's'} on ${floorplan.name}`,
                    status: 'skipped',
                    detail: 'The Fieldwire floorplan is not available yet.'
                })
            }
            continue
        }
        if (!isFieldwireFloorplanReady(matchingFloorplan)) {
            const symbolCount = symbols.length
            if (symbolCount > 0) {
                const readiness = await waitForFieldwireFloorplanTaskReadiness(
                    fieldwire,
                    fieldwireProjectId,
                    matchingFloorplan,
                    floorplan,
                    symbols[0],
                    taskContext,
                    symbolFinancials,
                    results
                )
                matchingFloorplan = readiness.floorplan || matchingFloorplan
                if (readiness.createdSymbolId) {
                    createdSymbolIds.add(readiness.createdSymbolId)
                }
                if (!readiness.ready && !readiness.failed) {
                    results.push({
                        type: 'create-task',
                        label: `Create ${symbolCount} task${symbolCount === 1 ? '' : 's'} on ${floorplan.name}`,
                        status: 'pending',
                        detail: describeFieldwireFloorplanPending(matchingFloorplan)
                    })
                    continue
                }
            } else {
                continue
            }
        }
        matchingFloorplan = await ensureFieldwireFloorplanName(fieldwire, fieldwireProjectId, matchingFloorplan, getFileBaseName(floorplan.name))

        const existingTasks = await fieldwire.projectFloorplanTasks(fieldwireProjectId, String(matchingFloorplan.id))
        for (const symbol of symbols) {
            if (createdSymbolIds.has(String(symbol.id || ''))) {
                continue
            }
            const taskName = String(symbol.label || symbol.text || symbol.deviceName || symbol.categoryName || 'Symbol').trim()
            const existingTask = findExistingFieldwireTaskForSymbol(existingTasks, taskName, matchingFloorplan, symbol)
            if (existingTask) {
                continue
            }
            try {
                await createFieldwireTaskForSymbol(fieldwire, fieldwireProjectId, matchingFloorplan, floorplan, symbol, taskContext, symbolFinancials)
                results.push(createFieldwireTaskSuccessResult(floorplan, symbol, taskName))
            } catch (err: any) {
                results.push({
                    type: 'create-task',
                    label: `Create task ${taskName}`,
                    status: 'failed',
                    detail: err?.message || String(err)
                })
            }
        }
    }

    const failures = results.filter((result) => result.status === 'failed')
    const pending = results.filter((result) => result.status === 'pending')
    return {
        success: failures.length <= 0 && pending.length <= 0,
        message: failures.length > 0
            ? `Fieldwire import finished with ${failures.length} failed operation${failures.length === 1 ? '' : 's'}.`
            : pending.length > 0
                ? `Fieldwire accepted the upload, but ${pending.length} operation${pending.length === 1 ? ' is' : 's are'} waiting on Fieldwire plan processing.`
            : 'Fieldwire import completed.',
        results
    }
}

async function waitForFieldwireFloorplanTaskReadiness(
    fieldwire: FieldwireSDK,
    fieldwireProjectId: string,
    floorplan: any,
    firewireFloorplan: any,
    firstSymbol: any,
    taskContext: any,
    symbolFinancials: Map<string, any>,
    results: any[]
): Promise<{ ready: boolean, failed: boolean, floorplan: any | null, createdSymbolId: string | null }> {
    const attempts = 20
    const delayMs = 5000
    const baseName = getFileBaseName(firewireFloorplan.name)
    let latestFloorplan = floorplan
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        results.push({
            type: 'wait-floorplan',
            label: `Wait for floorplan ${firewireFloorplan.name}`,
            status: 'skipped',
            detail: `Fieldwire is preparing this floorplan for task placement. Attempt ${attempt} of ${attempts}.`
        })
        await delay(delayMs)
        const fieldwireFloorplans = await fieldwire.projectFloorplans(fieldwireProjectId, true)
        latestFloorplan = findMatchingFieldwireFloorplan(fieldwireFloorplans as any[], firewireFloorplan.name, baseName, latestFloorplan?.id)
            || latestFloorplan
        if (!isFieldwireFloorplanReady(latestFloorplan)) {
            continue
        }
        latestFloorplan = await ensureFieldwireFloorplanName(fieldwire, fieldwireProjectId, latestFloorplan, baseName)
        if (!firstSymbol) {
            return { ready: true, failed: false, floorplan: latestFloorplan, createdSymbolId: null }
        }
        const taskName = String(firstSymbol.label || firstSymbol.text || firstSymbol.deviceName || firstSymbol.categoryName || 'Symbol').trim()
        try {
            await createFieldwireTaskForSymbol(fieldwire, fieldwireProjectId, latestFloorplan, firewireFloorplan, firstSymbol, taskContext, symbolFinancials)
            const successResult = createFieldwireTaskSuccessResult(firewireFloorplan, firstSymbol, taskName)
            results.push({
                ...successResult,
                detail: `Fieldwire floorplan is ready. ${successResult.detail}`
            })
            return { ready: true, failed: false, floorplan: latestFloorplan, createdSymbolId: String(firstSymbol.id || '') }
        } catch (err: any) {
            if (attempt >= attempts || !isRetryableFieldwireFloorplanTaskError(err)) {
                results.push({
                    type: 'create-task',
                    label: `Create task ${taskName}`,
                    status: 'failed',
                    detail: err?.message || String(err)
                })
                return { ready: false, failed: true, floorplan: latestFloorplan, createdSymbolId: null }
            }
        }
    }
    return { ready: false, failed: false, floorplan: latestFloorplan, createdSymbolId: null }
}

async function createFieldwireTaskForSymbol(
    fieldwire: FieldwireSDK,
    fieldwireProjectId: string,
    matchingFloorplan: any,
    floorplan: any,
    symbol: any,
    taskContext: any,
    symbolFinancials: Map<string, any>
): Promise<any> {
    const taskName = String(symbol.label || symbol.text || symbol.deviceName || symbol.categoryName || 'Symbol').trim()
    const team = await getOrCreateFieldwireTeam(fieldwire, fieldwireProjectId, taskContext, symbol.categoryName || 'Firewire')
    const position = calculateFieldwirePosition(matchingFloorplan, symbol)
    const financials = getFieldwireSymbolFinancials(symbol, symbolFinancials)
    return fieldwire.createTask({
        project_id: fieldwireProjectId,
        creator_user_id: taskContext.userId,
        owner_user_id: taskContext.userId,
        floorplan_id: String(matchingFloorplan.id),
        team_id: team.id,
        is_local: true,
        name: taskName,
        pos_x: position.posX,
        pos_y: position.posY,
        priority: 2,
        status_id: taskContext.statusId,
        cost_value: financials.materialCost,
        man_power_value: financials.laborHours
    })
}

function createFieldwireTaskSuccessResult(floorplan: any, symbol: any, taskName: string): any {
    return {
        type: 'create-task',
        label: `Create task ${taskName}`,
        status: 'success',
        detail: `Placed on ${floorplan.name} at ${formatPercent(toFiniteNumber(symbol.xRatio))}, ${formatPercent(toFiniteNumber(symbol.yRatio))}.`
    }
}

function isRetryableFieldwireFloorplanTaskError(err: any): boolean {
    const message = String(err?.message || err || '').toLowerCase()
    return [
        'floorplan',
        'sheet',
        'processing',
        'pending',
        'not ready',
        'not found',
        'cannot find',
        '422',
        '404',
        'timeout',
        'temporar'
    ].some((token) => message.includes(token))
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

async function createFieldwireFloorplanFromFirewireFile(fieldwire: FieldwireSDK, workspaceKey: string, fieldwireProjectId: string, fieldwireUserId: string, floorplan: any): Promise<any> {
    const version = latestFileVersion(floorplan)
    if (!version) {
        throw new Error('Floorplan has no file version content.')
    }
    const fileContent = await loadFirewireFileContent(workspaceKey, floorplan, version)
    const tokens = await fieldwire.aws_post_tokens()
    const token = Array.isArray(tokens) ? tokens[0] : tokens as any
    if (!token?.post_address || !token?.post_parameters) {
        throw new Error('Fieldwire did not return a usable AWS post token.')
    }

    const sourceFileName = version.sourceFileName || floorplan.name || 'floorplan'
    const postParameters = { ...token.post_parameters }
    if (postParameters.key && String(postParameters.key).includes('${filename}')) {
        postParameters.key = String(postParameters.key).replace('${filename}', sourceFileName)
    }

    const form = new FormData()
    Object.keys(postParameters).forEach((key) => {
        form.append(key, String((postParameters as any)[key]))
    })
    form.append('file', new Blob([new Uint8Array(fileContent.buffer)], {
        type: fileContent.contentType || 'application/octet-stream'
    }), sourceFileName)

    const uploadResponse = await fetch(token.post_address, {
        method: 'POST',
        body: form
    } as any)
    if (!uploadResponse.ok) {
        throw new Error(`AWS upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`)
    }

    const fileKey = String(postParameters.key || '')
    const baseName = getFileBaseName(floorplan.name || sourceFileName)
    const fileUrl = `${String(token.post_address).replace(/\/$/, '')}/${fileKey}`
    const sheetUploadBody = {
        user_id: fieldwireUserId,
        name: baseName,
        file_url: fileUrl
    }
    console.log('FIELDWIRE SHEET UPLOAD REQUEST')
    console.log(JSON.stringify({
        projectId: fieldwireProjectId,
        firewireFloorplanName: floorplan.name,
        sourceFileName,
        contentType: fileContent.contentType,
        fileSizeBytes: fileContent.buffer.length,
        awsPostAddress: token.post_address,
        awsKey: fileKey,
        body: sheetUploadBody
    }, null, 2))
    return fieldwire.createSheetUpload(fieldwireProjectId, sheetUploadBody)
}

async function loadFirewireFileContent(workspaceKey: string, file: any, version: any): Promise<{ buffer: Buffer, contentType: string }> {
    if (version.blobName) {
        const storage = new AzureBlobDocumentStorage()
        const result = await storage.download(version.blobContainerName || workspaceKey, version.blobName)
        return {
            buffer: result.buffer,
            contentType: result.contentType || version.mimeType || 'application/octet-stream'
        }
    }
    if (version.dataUrl) {
        const dataUrl = String(version.dataUrl)
        const commaIndex = dataUrl.indexOf(',')
        const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
        const mimeTypeMatch = header.match(/data:(.*?);base64/)
        return {
            buffer: Buffer.from(base64, 'base64'),
            contentType: mimeTypeMatch ? mimeTypeMatch[1] : version.mimeType || 'application/octet-stream'
        }
    }
    throw new Error(`No content is available for ${file?.name || 'floorplan'}.`)
}

async function waitForFieldwireFloorplan(fieldwire: FieldwireSDK, projectId: string, fileName: string, baseName: string, sheetUploadId?: string): Promise<any | null> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
        const floorplans = await fieldwire.projectFloorplans(projectId, true)
        const match = findMatchingFieldwireFloorplan(floorplans as any[], fileName, baseName, sheetUploadId)
        if (match) {
            return match
        }
        await new Promise((resolve) => setTimeout(resolve, 1500))
    }
    return null
}

async function loadFieldwireTaskContext(fieldwire: FieldwireSDK, projectId: string): Promise<any> {
    const users = normalizeArray(await fieldwire.accountProjectUsers(projectId) as any)
    const user = users.find((item: any) => item?.is_admin) || users[0]
    if (!user?.id) {
        throw new Error('No Fieldwire project user is available for task creation.')
    }
    const statuses = normalizeArray(await fieldwire.statuses(projectId) as any)
    const status = statuses.find((item: any) => item?.is_default)
        || statuses.find((item: any) => normalizeLookupKey(item?.name).includes('open'))
        || statuses[0]
    const teams = normalizeArray(await fieldwire.teams(projectId) as any)
    return {
        userId: String(user.id),
        statusId: status?.id ? String(status.id) : undefined,
        teams
    }
}

async function getOrCreateFieldwireTeam(fieldwire: FieldwireSDK, projectId: string, context: any, categoryName: string): Promise<any> {
    const normalizedCategoryName = String(categoryName || 'Firewire').trim() || 'Firewire'
    const match = context.teams.find((team: any) => normalizeLookupKey(team?.name) === normalizeLookupKey(normalizedCategoryName))
        || context.teams[0]
    if (match?.id) {
        return match
    }
    const handle = normalizedCategoryName
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 2)
        .toUpperCase() || 'FW'
    const created = await fieldwire.createTeam({
        id: '',
        project_id: projectId,
        name: normalizedCategoryName,
        handle
    })
    context.teams.push(created)
    return created
}

async function ensureFieldwireFloorplanName(fieldwire: FieldwireSDK, projectId: string, floorplan: any, desiredName: string): Promise<any> {
    const normalizedDesiredName = String(desiredName || '').trim()
    if (!floorplan?.id || !normalizedDesiredName || normalizeLookupKey(floorplan.name) === normalizeLookupKey(normalizedDesiredName)) {
        return floorplan
    }
    try {
        return await fieldwire.updateFloorplan(projectId, String(floorplan.id), {
            name: normalizedDesiredName,
            is_name_confirmed: true,
            is_user_confirmed: true
        })
    } catch {
        return floorplan
    }
}

function calculateFieldwirePosition(fieldwireFloorplan: any, symbol: any): { posX: number, posY: number } {
    const sheet = Array.isArray(fieldwireFloorplan?.sheets) ? fieldwireFloorplan.sheets[0] : fieldwireFloorplan?.current_sheet
    const fileWidth = toFiniteNumber(sheet?.file_width) || toFiniteNumber(sheet?.width) || 1
    const fileHeight = toFiniteNumber(sheet?.file_height) || toFiniteNumber(sheet?.height) || 1
    const xRatio = toFiniteNumber(symbol.xRatio) || 0
    const yRatio = toFiniteNumber(symbol.yRatio) || 0
    return {
        posX: Math.round(fileWidth * xRatio),
        posY: Math.round(fileHeight * yRatio)
    }
}

function findExistingFieldwireTaskForSymbol(existingTasks: any[], taskName: string, fieldwireFloorplan: any, symbol: any): any | null {
    const matchingNameTasks = (existingTasks || [])
        .filter((task: any) => normalizeLookupKey(task?.name) === normalizeLookupKey(taskName))
    if (matchingNameTasks.length <= 0) {
        return null
    }
    const expectedPosition = calculateFieldwirePosition(fieldwireFloorplan, symbol)
    return matchingNameTasks.find((task: any) => {
        const taskX = toFiniteNumber(task?.pos_x ?? task?.posX)
        const taskY = toFiniteNumber(task?.pos_y ?? task?.posY)
        if (taskX === null || taskY === null) {
            return false
        }
        return Math.abs(taskX - expectedPosition.posX) <= 6
            && Math.abs(taskY - expectedPosition.posY) <= 6
    }) || null
}

function normalizeArray(value: any): any[] {
    if (Array.isArray(value)) {
        return value
    }
    if (Array.isArray(value?.rows)) {
        return value.rows
    }
    if (Array.isArray(value?.data)) {
        return value.data
    }
    return value ? [value] : []
}

async function loadProjectDocLibraryPayload(sqldb: SqlDb, workspaceKey: string): Promise<any> {
    const record = await sqldb.getWorkspaceStorage('project-doc-library', workspaceKey)
    if (!record?.payloadJson) {
        return { files: [] }
    }
    try {
        return JSON.parse(record.payloadJson)
    } catch {
        return { files: [] }
    }
}

function getFirewireFloorplans(workspace: any): any[] {
    return (Array.isArray(workspace?.files) ? workspace.files : [])
        .filter((file: any) => String(file?.folderId || '') === 'floorplans')
        .sort((left: any, right: any) => String(left?.name || '').localeCompare(String(right?.name || ''), undefined, {
            numeric: true,
            sensitivity: 'base'
        }))
}

function getFloorplanSymbols(file: any): any[] {
    return (Array.isArray(file?.floorplanDesign?.annotations) ? file.floorplanDesign.annotations : [])
        .filter((annotation: any) => annotation?.kind === 'symbol')
}

function latestFileVersion(file: any): any | null {
    const versions = Array.isArray(file?.versions) ? file.versions : []
    return versions.length > 0 ? versions[versions.length - 1] : null
}

function findMatchingFieldwireFloorplan(fieldwireFloorplans: any[], fileName: string, baseName: string, sheetUploadId?: string): any | null {
    const fileKey = normalizeLookupKey(fileName)
    const baseKey = normalizeLookupKey(baseName)
    const uploadKey = normalizeLookupKey(sheetUploadId)
    return (fieldwireFloorplans || []).find((floorplan: any) => {
        const sheets = getFieldwireFloorplanSheets(floorplan)
        if (uploadKey && sheets.some((sheet: any) => normalizeLookupKey(sheet?.sheet_upload_id) === uploadKey || normalizeLookupKey(sheet?.sheet_upload?.id) === uploadKey)) {
            return true
        }
        const candidateNames = [
            floorplan?.name,
            floorplan?.description,
            ...(sheets.map((sheet: any) => sheet?.file_name || sheet?.name || sheet?.source_file_name || sheet?.original_filename))
        ]
        return candidateNames.some((candidate) => {
            const key = normalizeLookupKey(candidate)
            return key && (key === fileKey || key === baseKey)
        })
    }) || null
}

function getFieldwireFloorplanSheets(floorplan: any): any[] {
    const sheets = Array.isArray(floorplan?.sheets) ? floorplan.sheets : []
    const currentSheet = floorplan?.current_sheet || floorplan?.currentSheet
    return currentSheet ? [currentSheet, ...sheets] : sheets
}

function isFieldwireFloorplanReady(floorplan: any): boolean {
    if (!floorplan) {
        return false
    }
    const processState = normalizeLookupKey(floorplan.process_state || floorplan.processing_state || floorplan.state)
    if (processState && !['complete', 'completed', 'processed', 'ready'].includes(processState)) {
        return false
    }
    return getFieldwireFloorplanSheets(floorplan).some((sheet: any) => {
        const width = toFiniteNumber(sheet?.file_width) || toFiniteNumber(sheet?.width)
        const height = toFiniteNumber(sheet?.file_height) || toFiniteNumber(sheet?.height)
        return !!sheet?.id && !!width && !!height
    })
}

function describeFieldwireFloorplanPending(floorplan: any): string {
    const name = floorplan?.name ? ` ${floorplan.name}` : ''
    const processState = floorplan?.process_state || floorplan?.processing_state || floorplan?.state
    const reason = processState ? ` Current Fieldwire state: ${processState}.` : ''
    return `Fieldwire has accepted floorplan${name}, but it is not ready for task placement yet. Resolve any Fieldwire processing/version conflict and run Execute again.${reason}`
}

function getFileBaseName(fileName: string): string {
    const value = String(fileName || '').trim()
    const match = value.match(/\.([a-z0-9]{2,8})$/i)
    if (!match) {
        return value
    }
    const extension = match[1].toLowerCase()
    const knownExtensions = new Set([
        'pdf',
        'png',
        'jpg',
        'jpeg',
        'gif',
        'webp',
        'bmp',
        'tif',
        'tiff',
        'dwg',
        'dxf'
    ])
    return knownExtensions.has(extension)
        ? value.slice(0, -(extension.length + 1)).trim()
        : value
}

function normalizeLookupKey(value: any): string {
    return String(value || '').trim().toLowerCase()
}

function toFiniteNumber(value: any): number | null {
    const numeric = Number(value)
    return Number.isFinite(numeric) ? numeric : null
}

function formatPercent(value: number | null): string {
    return typeof value === 'number' ? `${Math.round(value * 1000) / 10}%` : 'unknown'
}

function toIsoString(value: any): string | null {
    if (!value) {
        return null
    }
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
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
