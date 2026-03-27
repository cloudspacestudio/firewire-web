import * as express from 'express'
import multer from 'multer'
import { parse as parseCsv } from 'csv-parse/sync'
import { SqlDb } from '../../fieldwire/repository/sqldb'
import { Vendor } from '../../fieldwire/repository/vendor'
import { VwEddyPricelist } from '../../fieldwire/repository/vwEddyPricelist'
import { EddyPricelist } from '../../fieldwire/repository/EddyPricelist'

const uploadToMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_PARTS_IMPORT_MAX_BYTES || 15 * 1024 * 1024)
    }
}).single('file')

const uploadVendorLogoToMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_VENDOR_LOGO_MAX_BYTES || 2 * 1024 * 1024)
    }
}).single('file')

interface VendorImportConfig {
    partsVendorKey: string
    sourceLabel: string
    targetTable: string
    filePattern?: string
    expectedHeaders: string[]
    headerMap: Record<string, keyof EddyPricelist>
    columnTypes: Partial<Record<keyof EddyPricelist, 'string' | 'money' | 'int' | 'date'>>
    normalizationSteps: string[]
    analysisSummary: string[]
    verifiedSampleFile?: string
    verifiedOn?: string
    replaceMode?: 'truncate-and-load'
    snapshotTable?: string
}

interface VendorImportPreview {
    valid: boolean
    vendorId: string
    fileName: string
    targetTable: string
    rowCount: number
    actualHeaders: string[]
    missingHeaders: string[]
    unexpectedHeaders: string[]
    issues: string[]
    sampleErrors: string[]
    sampleRows: EddyPricelist[]
    snapshotStrategy: string
}

interface NormalizedImportResult {
    config: VendorImportConfig
    preview: VendorImportPreview
    normalizedRows: EddyPricelist[]
}

interface DeviceVendorLinkIssue {
    deviceId: string
    deviceName: string
    vendorId: string
    vendorName: string
    partNumber: string
    sourceKind: 'device' | 'material'
    sourceLabel: string
    ignored: boolean
    ignoreReason?: string | null
}

interface CategoryReconcileRow {
    categoryId: string
    name: string
    shortName: string
    handle: string
    createat?: Date
    createby?: string
    updateat?: Date
    updateby?: string
    referencedByDeviceParts: boolean
    devicePartReferenceCount: number
    sourceVendors: string[]
    createdByReconcile?: boolean
}

interface DeviceSetSummaryRow {
    deviceSetId: string
    name: string
    deviceCount: number
    vendors: string[]
    createat?: Date
    updateat?: Date
}

interface DeviceSetDetailRow {
    deviceSetId: string
    name: string
    devices: any[]
}

interface StoredWorkspaceResponse {
    workspaceKey: string
    payload: any
    updatedAt?: Date
}

export class FirewireData {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/storage/design-train-ai',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const sqldb = new SqlDb(req.app)
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'design-train-ai', 'default', {
                        folders: [{
                            id: 'root',
                            parentFolderId: null,
                            name: 'Train AI',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }],
                        files: [],
                        annotations: []
                    })
                    return res.status(200).json({ data: result })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'put',
            path: '/api/firewire/storage/design-train-ai',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const sqldb = new SqlDb(req.app)
                    await sqldb.saveWorkspaceStorage('design-train-ai', 'default', JSON.stringify(req.body?.payload || req.body || {}), 'system')
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'design-train-ai', 'default', {
                        folders: [{
                            id: 'root',
                            parentFolderId: null,
                            name: 'Train AI',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }],
                        files: [],
                        annotations: []
                    })
                    return res.status(200).json({ data: result })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'get',
            path: '/api/firewire/storage/project-doc-library/:workspaceKey',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const workspaceKey = String(req.params.workspaceKey || '').trim()
                    if (!workspaceKey) {
                        return res.status(400).json({ message: 'workspaceKey is required.' })
                    }
                    const sqldb = new SqlDb(req.app)
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] })
                    return res.status(200).json({ data: result })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'put',
            path: '/api/firewire/storage/project-doc-library/:workspaceKey',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const workspaceKey = String(req.params.workspaceKey || '').trim()
                    if (!workspaceKey) {
                        return res.status(400).json({ message: 'workspaceKey is required.' })
                    }
                    const sqldb = new SqlDb(req.app)
                    await sqldb.saveWorkspaceStorage('project-doc-library', workspaceKey, JSON.stringify(req.body?.payload || req.body || {}), 'system')
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] })
                    return res.status(200).json({ data: result })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        // Get Devices
        {
            method: 'get',
            path: '/api/firewire/devices',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDevices()
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
        // Get Device
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDevice(deviceId)
                        return res.status(200).json(result)
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Delete Device
        {
            method: 'delete',
            path: '/api/firewire/devices/:deviceId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = String(req.params.deviceId || '').trim()
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'deviceId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getDevice(deviceId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Device ${deviceId} not found.`
                            })
                        }

                        await sqldb.deleteDeviceMaterialMapsByDeviceId(deviceId)
                        await sqldb.deleteMaterialAttributesByMaterialId(deviceId)
                        await sqldb.deleteMaterialSubTasksByMaterialId(deviceId)
                        await sqldb.deleteDeviceVendorLinkIgnoresByDeviceId(deviceId)
                        await sqldb.deleteDeviceSetDevicesByDeviceId(deviceId)
                        await sqldb.deleteDevice(deviceId)

                        return res.status(200).json({
                            data: {
                                deviceId
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Update Device Detail
        {
            method: 'put',
            path: '/api/firewire/devices/:deviceId/detail',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = String(req.params.deviceId || '').trim()
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'deviceId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getDevice(deviceId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Device ${deviceId} not found.`
                            })
                        }

                        const vendorId = String(req.body?.device?.vendorId || existing.vendorId || '').trim()
                        const categoryId = String(req.body?.device?.categoryId || existing.categoryId || '').trim()
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        await sqldb.updateDevice({
                            deviceId,
                            name: String(req.body?.device?.name || existing.name || '').trim(),
                            shortName: String(req.body?.device?.shortName || existing.shortName || '').trim(),
                            vendorId,
                            categoryId,
                            partNumber: String(req.body?.device?.partNumber || existing.partNumber || '').trim(),
                            link: String(req.body?.device?.link || '').trim(),
                            cost: Number(req.body?.device?.cost ?? existing.cost ?? 0),
                            defaultLabor: Number(req.body?.device?.defaultLabor ?? existing.defaultLabor ?? 0),
                            slcAddress: String(req.body?.device?.slcAddress || '').trim(),
                            serialNumber: String(req.body?.device?.serialNumber || '').trim(),
                            strobeAddress: String(req.body?.device?.strobeAddress || '').trim(),
                            speakerAddress: String(req.body?.device?.speakerAddress || '').trim()
                        })

                        const desiredPartNumbers: string[] = Array.isArray(req.body?.partNumbers)
                            ? Array.from(new Set(req.body.partNumbers
                                .map((value: unknown) => String(value || '').trim())
                                .filter((value: string): value is string => !!value)))
                            : []

                        await FirewireData.ensureCategoriesExistForVendorPartNumbers(sqldb, vendor, [
                            String(req.body?.device?.partNumber || existing.partNumber || '').trim()
                        ])

                        const materialIds: string[] = []
                        for (const partNumber of desiredPartNumbers) {
                            let material = await sqldb.getMaterialByVendorAndPartNumber(vendorId, partNumber)
                            if (!material) {
                                const partRecord = await FirewireData.resolveVendorPartRecord(sqldb, vendor, partNumber)
                                if (!partRecord) {
                                    return res.status(400).json({
                                        message: `Part ${partNumber} does not exist in the configured vendor source for ${vendor.name}.`
                                    })
                                }
                                await sqldb.createMaterial({
                                    materialId: '',
                                    name: String(partRecord.LongDescription || partNumber),
                                    shortName: partNumber,
                                    vendorId,
                                    categoryId,
                                    partNumber,
                                    link: '',
                                    cost: Number(partRecord.SalesPrice || partRecord.MSRPPrice || existing.cost || 0),
                                    defaultLabor: Number(existing.defaultLabor || 0),
                                    slcAddress: '',
                                    serialNumber: '',
                                    strobeAddress: '',
                                    speakerAddress: ''
                                })
                                material = await sqldb.getMaterialByVendorAndPartNumber(vendorId, partNumber)
                            }
                            if (material?.materialId) {
                                materialIds.push(material.materialId)
                            }
                        }

                        await sqldb.deleteDeviceMaterialMapsByDeviceId(deviceId)
                        for (const materialId of materialIds) {
                            await sqldb.createDeviceMaterialMap(deviceId, materialId)
                        }

                        await sqldb.deleteMaterialAttributesByMaterialId(deviceId)
                        const attributes = Array.isArray(req.body?.attributes) ? req.body.attributes : []
                        for (let index = 0; index < attributes.length; index++) {
                            const attribute = attributes[index]
                            const name = String(attribute?.name || '').trim()
                            if (!name) {
                                continue
                            }
                            await sqldb.createMaterialAttribute({
                                materialAttributeId: '',
                                name,
                                statusId: String(attribute?.statusId || name).trim(),
                                materialId: deviceId,
                                projectId: '',
                                valueType: String(attribute?.valueType || 'text').trim(),
                                defaultValue: String(attribute?.defaultValue || '').trim(),
                                ordinal: Number(attribute?.ordinal ?? index),
                                toBeValue: null
                            })
                        }

                        await sqldb.deleteMaterialSubTasksByMaterialId(deviceId)
                        const subTasks = Array.isArray(req.body?.subTasks) ? req.body.subTasks : []
                        for (let index = 0; index < subTasks.length; index++) {
                            const subTask = subTasks[index]
                            const statusName = String(subTask?.statusName || '').trim()
                            if (!statusName) {
                                continue
                            }
                            await sqldb.createMaterialSubTask({
                                materialSubTaskId: '',
                                materialId: deviceId,
                                statusName,
                                taskNameFormat: String(subTask?.taskNameFormat || '').trim(),
                                laborHours: Number(subTask?.laborHours ?? 0),
                                ordinal: Number(subTask?.ordinal ?? index),
                                projectId: '',
                                org: ''
                            })
                        }

                        const updated = await sqldb.getDevice(deviceId)
                        return res.status(200).json({
                            data: updated
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get View Devices
        {
            method: 'get',
            path: '/api/firewire/vwdevices',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwDevices()
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
        // Get Device Sets
        {
            method: 'get',
            path: '/api/firewire/device-sets',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await FirewireData.buildDeviceSetSummaries(sqldb)
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
        // Get Device Set Membership Summary
        {
            method: 'get',
            path: '/api/firewire/device-sets/device-membership-summary',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const rows = await sqldb.getDeviceSetDevices()
                        const counts = new Map<string, number>()
                        for (const row of rows) {
                            const deviceId = String(row.deviceId || '').trim()
                            if (!deviceId) {
                                continue
                            }
                            counts.set(deviceId, (counts.get(deviceId) || 0) + 1)
                        }
                        return res.status(200).json({
                            rows: Array.from(counts.entries()).map(([deviceId, deviceSetCount]) => ({
                                deviceId,
                                deviceSetCount
                            }))
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Create Device Set
        {
            method: 'post',
            path: '/api/firewire/device-sets',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const name = String(req.body?.name || '').trim()
                        if (!name) {
                            return res.status(400).json({
                                message: 'name is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const deviceSetId = await sqldb.createDeviceSet({
                            name,
                            createdBy: 'device-sets'
                        })
                        const result = await FirewireData.buildDeviceSetDetail(sqldb, deviceSetId)
                        return res.status(201).json({
                            data: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Device Set Detail
        {
            method: 'get',
            path: '/api/firewire/device-sets/:deviceSetId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceSetId = String(req.params.deviceSetId || '').trim()
                        if (!deviceSetId) {
                            return res.status(400).json({
                                message: 'deviceSetId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await FirewireData.buildDeviceSetDetail(sqldb, deviceSetId)
                        if (!result) {
                            return res.status(404).json({
                                message: `Device Set ${deviceSetId} not found.`
                            })
                        }
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
        },
        // Update Device Set
        {
            method: 'patch',
            path: '/api/firewire/device-sets/:deviceSetId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceSetId = String(req.params.deviceSetId || '').trim()
                        const name = String(req.body?.name || '').trim()
                        if (!deviceSetId || !name) {
                            return res.status(400).json({
                                message: 'deviceSetId and name are required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getDeviceSet(deviceSetId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Device Set ${deviceSetId} not found.`
                            })
                        }
                        await sqldb.updateDeviceSet({
                            deviceSetId,
                            name,
                            updatedBy: 'device-sets'
                        })
                        const result = await FirewireData.buildDeviceSetDetail(sqldb, deviceSetId)
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
        },
        // Replace Device Set Devices
        {
            method: 'put',
            path: '/api/firewire/device-sets/:deviceSetId/devices',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceSetId = String(req.params.deviceSetId || '').trim()
                        if (!deviceSetId) {
                            return res.status(400).json({
                                message: 'deviceSetId is required.'
                            })
                        }
                        const deviceIds: string[] = Array.isArray(req.body?.deviceIds)
                            ? Array.from<string>(new Set(
                                req.body.deviceIds
                                    .map((value: unknown) => String(value || '').trim())
                                    .filter((value: string): value is string => !!value)
                            ))
                            : []
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getDeviceSet(deviceSetId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Device Set ${deviceSetId} not found.`
                            })
                        }
                        const allDevices = await sqldb.getVwDevices()
                        const invalidDeviceIds = deviceIds.filter((deviceId) => !allDevices.some((row) => row.deviceId === deviceId))
                        if (invalidDeviceIds.length > 0) {
                            return res.status(400).json({
                                message: `Unknown device ids: ${invalidDeviceIds.join(', ')}`
                            })
                        }
                        await sqldb.replaceDeviceSetDevices(deviceSetId, deviceIds, 'device-sets')
                        const result = await FirewireData.buildDeviceSetDetail(sqldb, deviceSetId)
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
        },
        // Delete Device Set
        {
            method: 'delete',
            path: '/api/firewire/device-sets/:deviceSetId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceSetId = String(req.params.deviceSetId || '').trim()
                        if (!deviceSetId) {
                            return res.status(400).json({
                                message: 'deviceSetId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getDeviceSet(deviceSetId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Device Set ${deviceSetId} not found.`
                            })
                        }
                        await sqldb.deleteDeviceSet(deviceSetId)
                        return res.status(200).json({
                            data: {
                                deviceSetId
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Reconcile Device Vendor Part Links
        {
            method: 'get',
            path: '/api/firewire/devices/vendor-link-issues',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const state = String(req.query?.state || 'active').trim().toLowerCase()
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const issues = await FirewireData.buildDeviceVendorLinkIssues(sqldb)
                        const filtered = issues.filter((issue) => {
                            if (state === 'ignored') {
                                return issue.ignored
                            }
                            if (state === 'all') {
                                return true
                            }
                            return !issue.ignored
                        })
                        return res.status(200).json({
                            rows: filtered,
                            summary: {
                                active: issues.filter((issue) => !issue.ignored).length,
                                ignored: issues.filter((issue) => issue.ignored).length
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Ignore Device Vendor Part Link Issue
        {
            method: 'post',
            path: '/api/firewire/devices/vendor-link-issues/ignore',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = String(req.body?.deviceId || '').trim()
                        const vendorId = String(req.body?.vendorId || '').trim()
                        const partNumber = String(req.body?.partNumber || '').trim()
                        const sourceKind = String(req.body?.sourceKind || '').trim()
                        const reason = String(req.body?.reason || '').trim()
                        if (!deviceId || !vendorId || !partNumber || !sourceKind) {
                            return res.status(400).json({
                                message: 'deviceId, vendorId, partNumber, and sourceKind are required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const ignoreId = await sqldb.createDeviceVendorLinkIgnore({
                            deviceId,
                            vendorId,
                            partNumber,
                            sourceKind,
                            reason: reason || null,
                            createdBy: 'system'
                        })
                        return res.status(201).json({
                            data: {
                                ignoreId
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Unignore Device Vendor Part Link Issue
        {
            method: 'post',
            path: '/api/firewire/devices/vendor-link-issues/unignore',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = String(req.body?.deviceId || '').trim()
                        const vendorId = String(req.body?.vendorId || '').trim()
                        const partNumber = String(req.body?.partNumber || '').trim()
                        const sourceKind = String(req.body?.sourceKind || '').trim()
                        if (!deviceId || !vendorId || !partNumber || !sourceKind) {
                            return res.status(400).json({
                                message: 'deviceId, vendorId, partNumber, and sourceKind are required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        await sqldb.removeDeviceVendorLinkIgnore({
                            deviceId,
                            vendorId,
                            partNumber,
                            sourceKind
                        })
                        return res.status(200).json({
                            data: true
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get View Device Materials
        {
            method: 'get',
            path: '/api/firewire/vwdevicematerials',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwDeviceMaterials()
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
        // Get View Device Materials by Device Id
        {
            method: 'get',
            path: '/api/firewire/vwdevicematerials/:deviceId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDeviceMaterialByDeviceId(deviceId)
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
        // Get Device Attributes by Device Id
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/attributes',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getMaterialAttributesByDeviceId(deviceId)
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
        // Get Device Sub Tasks by Device Id
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/subtasks',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getMaterialSubTasksByDeviceId(deviceId)
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
        // Get View Materials
        {
            method: 'get',
            path: '/api/firewire/vwmaterials',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwMaterials()
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
        // Get Categories
        {
            method: 'get',
            path: '/api/firewire/categories',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getCategories()
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
        // Get Category
        {
            method: 'get',
            path: '/api/firewire/categories/:categoryId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const categoryId = String(req.params.categoryId || '').trim()
                        if (!categoryId) {
                            return res.status(400).json({
                                message: 'categoryId is required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getCategoryById(categoryId)
                        if (!result) {
                            return res.status(404).json({
                                message: `Category ${categoryId} not found.`
                            })
                        }
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
        },
        // Get Devices Using Category
        {
            method: 'get',
            path: '/api/firewire/categories/:categoryId/devices',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const categoryId = String(req.params.categoryId || '').trim()
                        if (!categoryId) {
                            return res.status(400).json({
                                message: 'categoryId is required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const devices = await sqldb.getVwDevices()
                        return res.status(200).json({
                            rows: devices.filter((row) => String(row.categoryId || '').trim() === categoryId)
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Update Category
        {
            method: 'patch',
            path: '/api/firewire/categories/:categoryId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const categoryId = String(req.params.categoryId || req.body?.categoryId || '').trim()
                        if (!categoryId) {
                            return res.status(400).json({
                                message: 'categoryId is required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getCategoryById(categoryId)
                        if (!existing) {
                            return res.status(404).json({
                                message: `Category ${categoryId} not found.`
                            })
                        }

                        const name = String(req.body?.name || existing.name || '').trim()
                        const shortName = String(req.body?.shortName || existing.shortName || '').trim()
                        const handle = String(req.body?.handle || existing.handle || '').trim()
                        const defaultLabor = req.body?.defaultLabor === null || typeof req.body?.defaultLabor === 'undefined' || req.body?.defaultLabor === ''
                            ? null
                            : Number(req.body.defaultLabor)
                        const includeOnFloorplan = !!req.body?.includeOnFloorplan
                        const slcAddress = String(req.body?.slcAddress ?? existing.slcAddress ?? '').trim()
                        const speakerAddress = String(req.body?.speakerAddress ?? existing.speakerAddress ?? '').trim()
                        const strobeAddress = String(req.body?.strobeAddress ?? existing.strobeAddress ?? '').trim()
                        if (!name || !shortName || !handle) {
                            return res.status(400).json({
                                message: 'name, shortName, and handle are required.'
                            })
                        }
                        if (handle.length > 10) {
                            return res.status(400).json({
                                message: 'handle must be 10 characters or fewer.'
                            })
                        }

                        const allCategories = await sqldb.getCategories()
                        const duplicate = allCategories.find((row) =>
                            row.categoryId !== categoryId &&
                            String(row.handle || '').trim().toLowerCase() === handle.toLowerCase()
                        )
                        if (duplicate) {
                            return res.status(409).json({
                                message: `Handle ${handle} is already used by category ${duplicate.name}.`
                            })
                        }

                        await sqldb.updateCategory({
                            ...existing,
                            categoryId,
                            name,
                            shortName,
                            handle,
                            defaultLabor,
                            includeOnFloorplan,
                            slcAddress,
                            speakerAddress,
                            strobeAddress,
                            updateby: 'category-grid-edit'
                        })

                        return res.status(200).json({
                            data: {
                                categoryId,
                                name,
                                shortName,
                                handle,
                                defaultLabor,
                                includeOnFloorplan,
                                slcAddress,
                                speakerAddress,
                                strobeAddress
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Delete Category
        {
            method: 'delete',
            path: '/api/firewire/categories/:categoryId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const categoryId = String(req.params.categoryId || '').trim()
                        if (!categoryId) {
                            return res.status(400).json({
                                message: 'categoryId is required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const categories = await sqldb.getCategories()
                        const existing = categories.find((row) => String(row.categoryId || '').trim() === categoryId) || null
                        if (!existing) {
                            return res.status(404).json({
                                message: `Category ${categoryId} not found.`
                            })
                        }

                        const [devices, materials] = await Promise.all([sqldb.getVwDevices(), sqldb.getMaterials()])
                        const deviceCount = devices.filter((row) => String(row.categoryId || '').trim() === categoryId).length
                        const materialCount = materials.filter((row) => String(row.categoryId || '').trim() === categoryId).length
                        if (deviceCount > 0 || materialCount > 0) {
                            return res.status(409).json({
                                message: `Category ${existing.name} is still in use by ${deviceCount} devices and ${materialCount} materials.`
                            })
                        }

                        await sqldb.deleteCategory(categoryId)
                        return res.status(200).json({
                            data: {
                                categoryId
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Reconcile Categories Used By Device Parts
        {
            method: 'post',
            path: '/api/firewire/categories/reconcile',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await FirewireData.reconcileCategoriesFromDeviceParts(sqldb)
                        return res.status(200).json(result)
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Vendors
        {
            method: 'get',
            path: '/api/firewire/vendors',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVendors()
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
        // Update Vendor
        {
            method: 'patch',
            path: '/api/firewire/vendors/:vendorId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || req.body?.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const existing = await sqldb.getVendors()
                        const vendor = existing.find((row) => row.vendorId === vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        await sqldb.updateVendor({
                            vendorId,
                            name: String(req.body?.name ?? vendor.name ?? ''),
                            desc: String(req.body?.desc ?? vendor.desc ?? ''),
                            link: String(req.body?.link ?? vendor.link ?? ''),
                            importConfigJson: vendor.importConfigJson ?? null,
                            logoFileName: vendor.logoFileName ?? null,
                            logoDataUrl: vendor.logoDataUrl ?? null
                        })

                        return res.status(200).json({
                            data: {
                                vendorId,
                                name: String(req.body?.name ?? vendor.name ?? ''),
                                desc: String(req.body?.desc ?? vendor.desc ?? ''),
                                link: String(req.body?.link ?? vendor.link ?? ''),
                                logoFileName: vendor.logoFileName ?? null,
                                logoDataUrl: vendor.logoDataUrl ?? null
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Upload Vendor Logo
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/logo',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }
                        const file = await FirewireData.getVendorLogoUpload(req, res)
                        if (!file) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing file form field.'
                            })
                        }
                        if (!String(file.mimetype || '').startsWith('image/')) {
                            return res.status(400).json({
                                message: 'Vendor logo must be an image file.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        const logoDataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`
                        await sqldb.updateVendorLogo(vendorId, String(file.originalname || 'vendor-logo'), logoDataUrl)

                        return res.status(200).json({
                            data: {
                                vendorId,
                                logoFileName: String(file.originalname || 'vendor-logo'),
                                logoDataUrl
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(err instanceof multer.MulterError ? 400 : 500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Vendor Import Config
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/import-config',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }
                        const resolved = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
                        if (!resolved.config) {
                            return res.status(404).json({
                                message: `No import configuration exists for vendor ${vendor.name}.`
                            })
                        }
                        return res.status(200).json({
                            data: resolved.config,
                            seeded: resolved.seeded
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Update Vendor Import Config
        {
            method: 'patch',
            path: '/api/firewire/vendors/:vendorId/import-config',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const rawConfig = req.body?.config
                        if (!vendorId || !rawConfig || typeof rawConfig !== 'object') {
                            return res.status(400).json({
                                message: 'vendorId and config object are required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        const config = FirewireData.sanitizeVendorImportConfig(rawConfig)
                        await sqldb.updateVendorImportConfig(vendorId, JSON.stringify(config, null, 2))

                        return res.status(200).json({
                            data: config
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Eddy Products
        {
            method: 'get',
            path: '/api/firewire/eddyproducts',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getEddyProducts()
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
        // Get Eddy Pricelist
        {
            method: 'get',
            path: '/api/firewire/eddypricelist',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getEddyPricelist()
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
        // Get View Eddy Pricelist combined with Eddy Products
        {
            method: 'get',
            path: '/api/firewire/vweddypricelist',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwEddyPricelist()
                        const vendor = await FirewireData.resolveEdwardsVendor(sqldb)
                        return res.status(200).json({
                            rows: result.map((row) => ({
                                ...row,
                                vendorId: vendor?.vendorId || null,
                                vendorName: vendor?.name || 'Edwards'
                            }))
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get View Eddy Pricelist combined with Eddy Products by Part Number
        {
            method: 'get',
            path: '/api/firewire/vweddypricelist/:partNumber',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const partNumber = req.params.partNumber
                        if (!partNumber) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing partNumber parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
                        const vendor = await FirewireData.resolveEdwardsVendor(sqldb)
                        return res.status(200).json({
                            rows: result.map((row) => ({
                                ...row,
                                vendorId: vendor?.vendorId || null,
                                vendorName: vendor?.name || 'Edwards'
                            }))
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Create Device using Edwards Part
        {
            method: 'post',
            path: '/api/firewire/eddypricelist/:partNumber/create-device',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const partNumber = String(req.params.partNumber || '').trim()
                        const name = String(req.body?.name || '').trim()
                        const shortName = String(req.body?.shortName || '').trim()
                        const categoryId = String(req.body?.categoryId || '').trim()
                        const categoryName = String(req.body?.categoryName || '').trim()

                        if (!partNumber || !name || !shortName || !categoryId) {
                            return res.status(400).json({
                                message: 'partNumber, name, shortName, and categoryId are required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const partRows = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
                        const part = Array.isArray(partRows) && partRows.length > 0 ? partRows[0] as VwEddyPricelist : null
                        if (!part) {
                            return res.status(404).json({
                                message: `Part ${partNumber} not found in Edwards pricelist.`
                            })
                        }

                        const vendor = await FirewireData.requireEdwardsVendor(sqldb, res)
                        if (!vendor) {
                            return
                        }

                        const safeDeviceName = FirewireData.getSafeDeviceName(name, partNumber)
                        const safeShortName = FirewireData.limitText(shortName || partNumber, 50) || partNumber
                        const safeMaterialName = FirewireData.getSafeDeviceName(name || String(part?.LongDescription || ''), partNumber)

                        await FirewireData.ensureCategoriesExistForVendorPartNumbers(sqldb, vendor, [partNumber])
                        if (categoryName) {
                            await FirewireData.ensureCategoryExistsByName(sqldb, categoryName, 'device-category-sync')
                        }

                        const categories = await sqldb.getCategories()
                        const normalizedCategoryName = FirewireData.normalizeCategoryName(categoryName)
                        const category = categories.find((row) =>
                            row.categoryId === categoryId
                            || (!!normalizedCategoryName && FirewireData.normalizeCategoryName(row.name) === normalizedCategoryName)
                        )
                        if (!category) {
                            return res.status(404).json({
                                message: `Category ${categoryName || categoryId} not found.`
                            })
                        }

                        const existingDevice = await sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber)
                        if (existingDevice) {
                            return res.status(409).json({
                                message: `A device already exists for ${partNumber} under vendor ${vendor.name}.`,
                                data: existingDevice
                            })
                        }

                        let material = await sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber)
                        let createdMaterial = false
                        const categoryDefaultLabor = typeof category.defaultLabor === 'number' ? Number(category.defaultLabor) : 2
                        const categorySlcAddress = String(category.slcAddress || '').trim()
                        const categorySpeakerAddress = String(category.speakerAddress || '').trim()
                        const categoryStrobeAddress = String(category.strobeAddress || '').trim()
                        if (!material) {
                            await sqldb.createMaterial({
                                materialId: '',
                                name: safeMaterialName,
                                shortName: safeShortName,
                                vendorId: vendor.vendorId,
                                categoryId: category.categoryId,
                                partNumber,
                                link: '',
                                cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                                defaultLabor: categoryDefaultLabor,
                                slcAddress: categorySlcAddress,
                                serialNumber: '',
                                strobeAddress: categoryStrobeAddress,
                                speakerAddress: categorySpeakerAddress
                            })
                            material = await sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber)
                            createdMaterial = true
                        }

                        await sqldb.createDevice({
                            deviceId: '',
                            name: safeDeviceName,
                            shortName: safeShortName,
                            vendorId: vendor.vendorId,
                            categoryId: category.categoryId,
                            partNumber,
                            link: '',
                            cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                            defaultLabor: categoryDefaultLabor,
                            slcAddress: categorySlcAddress,
                            serialNumber: '',
                            strobeAddress: categoryStrobeAddress,
                            speakerAddress: categorySpeakerAddress
                        })

                        const device = await sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber)
                        if (!device) {
                            return res.status(500).json({
                                message: 'Device was created but could not be reloaded.'
                            })
                        }

                        if (material) {
                            const existingMap = await sqldb.getDeviceMaterialByIds(device.deviceId, material.materialId)
                            if (!existingMap) {
                                await sqldb.createDeviceMaterialMap(device.deviceId, material.materialId)
                            }
                        }

                        return res.status(201).json({
                            data: {
                                device,
                                material,
                                createdMaterial
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Add Edwards Part to Existing Device
        {
            method: 'post',
            path: '/api/firewire/eddypricelist/:partNumber/add-to-device',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const partNumber = String(req.params.partNumber || '').trim()
                        const deviceId = String(req.body?.deviceId || '').trim()

                        if (!partNumber || !deviceId) {
                            return res.status(400).json({
                                message: 'partNumber and deviceId are required.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const device = await sqldb.getDevice(deviceId)
                        if (!device) {
                            return res.status(404).json({
                                message: `Device ${deviceId} not found.`
                            })
                        }

                        const partRows = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
                        const part = Array.isArray(partRows) && partRows.length > 0 ? partRows[0] as VwEddyPricelist : null
                        if (!part) {
                            return res.status(404).json({
                                message: `Part ${partNumber} not found in Edwards pricelist.`
                            })
                        }

                        let material = await sqldb.getMaterialByVendorAndPartNumber(device.vendorId, partNumber)
                        let createdMaterial = false
                        if (!material) {
                            await sqldb.createMaterial({
                                materialId: '',
                                name: part.LongDescription || device.name,
                                shortName: device.shortName || partNumber,
                                vendorId: device.vendorId,
                                categoryId: device.categoryId,
                                partNumber,
                                link: '',
                                cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                                defaultLabor: Number(device.defaultLabor || 2),
                                slcAddress: '',
                                serialNumber: '',
                                strobeAddress: '',
                                speakerAddress: ''
                            })
                            material = await sqldb.getMaterialByVendorAndPartNumber(device.vendorId, partNumber)
                            createdMaterial = true
                        }

                        if (!material) {
                            return res.status(500).json({
                                message: 'Material could not be created or loaded.'
                            })
                        }

                        const existingMap = await sqldb.getDeviceMaterialByIds(device.deviceId, material.materialId)
                        if (existingMap) {
                            return res.status(200).json({
                                data: {
                                    device,
                                    material,
                                    createdMaterial,
                                    createdMap: false
                                }
                            })
                        }

                        await sqldb.createDeviceMaterialMap(device.deviceId, material.materialId)
                        return res.status(201).json({
                            data: {
                                device,
                                material,
                                createdMaterial,
                                createdMap: true
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Preview Vendor Parts Import
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/parts-import/preview',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }

                        const file = await FirewireData.getUpload(req, res)
                        if (!file) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing file form field.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        const normalized = await FirewireData.buildNormalizedImportResult(sqldb, vendor, file.originalname, file.buffer)
                        return res.status(200).json({
                            data: normalized.preview
                        })
                    } catch (err: Error|any) {
                        return res.status(err instanceof multer.MulterError ? 400 : 500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Execute Vendor Parts Import
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/parts-import',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }

                        const file = await FirewireData.getUpload(req, res)
                        if (!file) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing file form field.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({
                                message: `Vendor ${vendorId} not found.`
                            })
                        }

                        const normalized = await FirewireData.buildNormalizedImportResult(sqldb, vendor, file.originalname, file.buffer)
                        if (!normalized.preview.valid) {
                            return res.status(400).json({
                                message: 'Import verification failed.',
                                data: normalized.preview
                            })
                        }
                        if (normalized.config.targetTable !== 'EddyPricelist') {
                            return res.status(400).json({
                                message: `Unsupported target table ${normalized.config.targetTable}.`
                            })
                        }

                        const existingRows = await sqldb.getAllEddyPricelist()
                        const snapshotId = await sqldb.createVendorImportSnapshot({
                            vendorId,
                            targetTable: normalized.config.targetTable,
                            fileName: file.originalname,
                            rowCount: existingRows.length,
                            summaryJson: JSON.stringify({
                                action: 'pre-import-backup',
                                fileName: file.originalname,
                                importedRowCount: normalized.preview.rowCount,
                                createdAt: new Date().toISOString()
                            }),
                            rowsJson: JSON.stringify(existingRows),
                            createdBy: 'system'
                        })

                        await sqldb.replaceEddyPricelist(normalized.normalizedRows)
                        const runId = await sqldb.createVendorImportRun({
                            vendorId,
                            targetTable: normalized.config.targetTable,
                            fileName: file.originalname,
                            snapshotId,
                            action: 'import',
                            rowCount: normalized.normalizedRows.length,
                            createdBy: 'system',
                            notesJson: JSON.stringify({
                                preview: normalized.preview
                            })
                        })

                        return res.status(201).json({
                            data: {
                                runId,
                                snapshotId,
                                insertedRowCount: normalized.normalizedRows.length,
                                preview: normalized.preview
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(err instanceof multer.MulterError ? 400 : 500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Vendor Parts Import Snapshots
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts-import-snapshots',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const targetTable = String(req.query?.targetTable || 'EddyPricelist').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const snapshots = await sqldb.getVendorImportSnapshots(vendorId, targetTable)
                        return res.status(200).json({
                            rows: snapshots.map((row) => ({
                                snapshotId: row.snapshotId,
                                vendorId: row.vendorId,
                                targetTable: row.targetTable,
                                fileName: row.fileName,
                                rowCount: row.rowCount,
                                createdAt: row.createdAt,
                                createdBy: row.createdBy,
                                summary: FirewireData.safeJsonParse(row.summaryJson)
                            }))
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Vendor Parts Import Status
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts-import-status',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const targetTable = String(req.query?.targetTable || 'EddyPricelist').trim()
                        if (!vendorId) {
                            return res.status(400).json({
                                message: 'vendorId is required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const latestRun = await sqldb.getLatestVendorImportRun(vendorId, targetTable)
                        return res.status(200).json({
                            data: latestRun ? {
                                ...latestRun,
                                notes: FirewireData.safeJsonParse(latestRun.notesJson || '')
                            } : null
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Restore Vendor Parts Import Snapshot
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/parts-import-snapshots/:snapshotId/restore',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const snapshotId = String(req.params.snapshotId || '').trim()
                        if (!vendorId || !snapshotId) {
                            return res.status(400).json({
                                message: 'vendorId and snapshotId are required.'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const snapshot = await sqldb.getVendorImportSnapshot(snapshotId)
                        if (!snapshot || snapshot.vendorId !== vendorId) {
                            return res.status(404).json({
                                message: `Snapshot ${snapshotId} not found for vendor ${vendorId}.`
                            })
                        }
                        if (snapshot.targetTable !== 'EddyPricelist') {
                            return res.status(400).json({
                                message: `Unsupported restore target ${snapshot.targetTable}.`
                            })
                        }
                        const rows = FirewireData.safeJsonParse(snapshot.rowsJson)
                        if (!Array.isArray(rows)) {
                            return res.status(500).json({
                                message: 'Snapshot payload is invalid.'
                            })
                        }
                        await sqldb.replaceEddyPricelist(rows as EddyPricelist[])
                        const runId = await sqldb.createVendorImportRun({
                            vendorId,
                            targetTable: snapshot.targetTable,
                            fileName: snapshot.fileName,
                            snapshotId: snapshot.snapshotId,
                            action: 'restore',
                            rowCount: rows.length,
                            createdBy: 'system',
                            notesJson: JSON.stringify({
                                restoredFromSnapshotId: snapshot.snapshotId
                            })
                        })
                        return res.status(200).json({
                            data: {
                                runId,
                                snapshotId,
                                restoredRowCount: rows.length
                            }
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Category Labor
        {
            method: 'get',
            path: '/api/firewire/categorylabors',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getCategoryLabors()
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
        }
    ]

    static legacyFieldwireAliasItems = FirewireData.manifestItems.map((item) => {
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

    private static async resolveEdwardsVendor(sqldb: SqlDb): Promise<Vendor | null> {
        const vendors = await sqldb.getVendors()
        return vendors.find((row) => /edwards|edward/i.test(String(row.name || ''))) || null
    }

    private static async requireEdwardsVendor(sqldb: SqlDb, res: express.Response): Promise<Vendor | null> {
        const vendor = await FirewireData.resolveEdwardsVendor(sqldb)
        if (!vendor) {
            res.status(400).json({
                message: 'No Edwards vendor record was found. Create the Edwards vendor first before creating devices from the Edwards parts list.'
            })
            return null
        }
        return vendor
    }
    private static async getUpload(req: express.Request, res: express.Response): Promise<Express.Multer.File | undefined> {
        return new Promise((resolve, reject) => {
            uploadToMemory(req, res, (err) => {
                if (err) {
                    return reject(err)
                }
                return resolve(req.file)
            })
        })
    }
    private static async getVendorLogoUpload(req: express.Request, res: express.Response): Promise<Express.Multer.File | undefined> {
        return new Promise((resolve, reject) => {
            uploadVendorLogoToMemory(req, res, (err) => {
                if (err) {
                    return reject(err)
                }
                return resolve(req.file)
            })
        })
    }
    private static safeJsonParse(raw: string | null | undefined): any {
        if (!raw) {
            return null
        }
        try {
            return JSON.parse(raw)
        } catch {
            return null
        }
    }
    private static async resolveVendorImportConfig(sqldb: SqlDb, vendor: Vendor): Promise<{ config: VendorImportConfig | null, seeded: boolean }> {
        if (vendor.importConfigJson) {
            return {
                config: FirewireData.sanitizeVendorImportConfig(FirewireData.safeJsonParse(vendor.importConfigJson)),
                seeded: false
            }
        }
        const fallback = FirewireData.buildDefaultVendorImportConfig(vendor)
        if (!fallback) {
            return { config: null, seeded: false }
        }
        await sqldb.updateVendorImportConfig(vendor.vendorId, JSON.stringify(fallback, null, 2))
        return {
            config: fallback,
            seeded: true
        }
    }
    private static buildDefaultVendorImportConfig(vendor: Vendor): VendorImportConfig | null {
        if (!/edwards|edward/i.test(String(vendor.name || ''))) {
            return null
        }
        return {
            partsVendorKey: 'edwards',
            sourceLabel: 'myEddie Edwards price list CSV export',
            targetTable: 'EddyPricelist',
            filePattern: '*.csv',
            expectedHeaders: [
                'Parent Category',
                'Category',
                'Part Number',
                'Long Description',
                'MSRP/Trade Price',
                'Sales Price',
                'Future MSRP/Trade Price',
                'Future MSRP/Trade Price Effective Date',
                'Future Sales Price',
                'Future Sales Price Effective Date',
                'Minimum Order Quantity',
                'Product Status',
                'Agency',
                'COO',
                'UPC'
            ],
            headerMap: {
                'Parent Category': 'ParentCategory',
                'Category': 'Category',
                'Part Number': 'PartNumber',
                'Long Description': 'LongDescription',
                'MSRP/Trade Price': 'MSRPPrice',
                'Sales Price': 'SalesPrice',
                'Future MSRP/Trade Price': 'FuturePrice',
                'Future MSRP/Trade Price Effective Date': 'FutureEffectiveDate',
                'Future Sales Price': 'FutureSalesPrice',
                'Future Sales Price Effective Date': 'FutureSalesEffectiveDate',
                'Minimum Order Quantity': 'MinOrderQuantity',
                'Product Status': 'ProductStatus',
                'Agency': 'Agency',
                'COO': 'CountryOfOrigin',
                'UPC': 'UPC'
            },
            columnTypes: {
                ParentCategory: 'string',
                Category: 'string',
                PartNumber: 'string',
                LongDescription: 'string',
                MSRPPrice: 'money',
                SalesPrice: 'money',
                FuturePrice: 'money',
                FutureEffectiveDate: 'date',
                FutureSalesPrice: 'money',
                FutureSalesEffectiveDate: 'date',
                MinOrderQuantity: 'int',
                ProductStatus: 'string',
                Agency: 'string',
                CountryOfOrigin: 'string',
                UPC: 'string'
            },
            normalizationSteps: [
                'Map CSV headers to EddyPricelist column names before load.',
                'Strip currency symbols and commas from price fields.',
                'Convert future effective date values like M/D/YYYY 12:00:00 AM into SQL date values.',
                'Normalize straight double quotes in text fields into smart quotes during import.',
                'Allow blanks to load as NULL for nullable columns.',
                'Backup the current EddyPricelist rows before replacing them.'
            ],
            analysisSummary: [
                'Verified against file 82001474_074054.csv on 2026-03-26.',
                'Header names do not directly match the EddyPricelist table and require mapping.',
                'Observed 5,351 data rows in the verified sample export.',
                'Column lengths observed in the sample fit within the current SQL schema.'
            ],
            verifiedSampleFile: '82001474_074054.csv',
            verifiedOn: '2026-03-26',
            replaceMode: 'truncate-and-load',
            snapshotTable: 'vendorImportSnapshots'
        }
    }
    private static sanitizeVendorImportConfig(raw: any): VendorImportConfig {
        const base = raw && typeof raw === 'object' ? raw : {}
        return {
            partsVendorKey: String(base.partsVendorKey || '').trim() || 'vendor',
            sourceLabel: String(base.sourceLabel || '').trim() || 'Vendor CSV import',
            targetTable: String(base.targetTable || '').trim() || 'EddyPricelist',
            filePattern: String(base.filePattern || '').trim() || '*.csv',
            expectedHeaders: Array.isArray(base.expectedHeaders) ? base.expectedHeaders.map((value: unknown) => String(value || '').trim()).filter(Boolean) : [],
            headerMap: FirewireData.normalizeHeaderMap(base.headerMap),
            columnTypes: FirewireData.normalizeColumnTypes(base.columnTypes),
            normalizationSteps: Array.isArray(base.normalizationSteps) ? base.normalizationSteps.map((value: unknown) => String(value || '').trim()).filter(Boolean) : [],
            analysisSummary: Array.isArray(base.analysisSummary) ? base.analysisSummary.map((value: unknown) => String(value || '').trim()).filter(Boolean) : [],
            verifiedSampleFile: String(base.verifiedSampleFile || '').trim() || undefined,
            verifiedOn: String(base.verifiedOn || '').trim() || undefined,
            replaceMode: 'truncate-and-load',
            snapshotTable: String(base.snapshotTable || '').trim() || 'vendorImportSnapshots'
        }
    }
    private static normalizeHeaderMap(raw: any): Record<string, keyof EddyPricelist> {
        const output: Record<string, keyof EddyPricelist> = {}
        if (!raw || typeof raw !== 'object') {
            return output
        }
        for (const [key, value] of Object.entries(raw)) {
            const header = String(key || '').trim()
            const target = String(value || '').trim() as keyof EddyPricelist
            if (header && target) {
                output[header] = target
            }
        }
        return output
    }
    private static normalizeColumnTypes(raw: any): Partial<Record<keyof EddyPricelist, 'string' | 'money' | 'int' | 'date'>> {
        const output: Partial<Record<keyof EddyPricelist, 'string' | 'money' | 'int' | 'date'>> = {}
        if (!raw || typeof raw !== 'object') {
            return output
        }
        for (const [key, value] of Object.entries(raw)) {
            const type = String(value || '').trim()
            if (type === 'string' || type === 'money' || type === 'int' || type === 'date') {
                output[key as keyof EddyPricelist] = type
            }
        }
        return output
    }
    private static async buildNormalizedImportResult(sqldb: SqlDb, vendor: Vendor, fileName: string, fileBuffer: Buffer): Promise<NormalizedImportResult> {
        const resolved = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
        if (!resolved.config) {
            throw new Error(`No import configuration exists for vendor ${vendor.name}.`)
        }
        const config = resolved.config
        const parsedRows = parseCsv(fileBuffer.toString('utf-8'), {
            bom: true,
            skip_empty_lines: true
        }) as string[][]
        const actualHeaders = Array.isArray(parsedRows[0]) ? parsedRows[0].map((value) => String(value || '').trim()) : []
        const bodyRows = parsedRows.slice(1)
        const missingHeaders = config.expectedHeaders.filter((header) => !actualHeaders.includes(header))
        const unexpectedHeaders = actualHeaders.filter((header) => !config.expectedHeaders.includes(header))
        const issues: string[] = []
        const sampleErrors: string[] = []
        const normalizedRows: EddyPricelist[] = []

        const lengthLimits: Partial<Record<keyof EddyPricelist, number>> = {
            ParentCategory: 500,
            Category: 500,
            PartNumber: 100,
            LongDescription: 1000,
            ProductStatus: 500,
            Agency: 50,
            CountryOfOrigin: 50,
            UPC: 50
        }

        if (missingHeaders.length > 0) {
            issues.push(`Missing required headers: ${missingHeaders.join(', ')}`)
        }
        if (unexpectedHeaders.length > 0) {
            issues.push(`Unexpected headers detected: ${unexpectedHeaders.join(', ')}`)
        }

        for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex++) {
            const rowValues = Array.isArray(bodyRows[rowIndex]) ? bodyRows[rowIndex] : []
            const sourceRow: Record<string, string> = {}
            actualHeaders.forEach((header, index) => {
                sourceRow[header] = String(rowValues[index] ?? '').trim()
            })
            const normalizedRow: EddyPricelist = {
                ParentCategory: '',
                Category: '',
                PartNumber: '',
                LongDescription: '',
                MSRPPrice: null as any,
                SalesPrice: null as any,
                FuturePrice: null as any,
                FutureEffectiveDate: null as any,
                FutureSalesPrice: null as any,
                FutureSalesEffectiveDate: null as any,
                MinOrderQuantity: null as any,
                ProductStatus: '',
                Agency: '',
                CountryOfOrigin: '',
                UPC: ''
            }

            for (const [sourceHeader, targetColumn] of Object.entries(config.headerMap)) {
                const rawValue = sourceRow[sourceHeader] ?? ''
                const type = config.columnTypes[targetColumn] || 'string'
                const normalizedValue = FirewireData.normalizeImportValue(rawValue, type)
                ;(normalizedRow as any)[targetColumn] = normalizedValue

                const maxLength = lengthLimits[targetColumn]
                if (maxLength && typeof normalizedValue === 'string' && normalizedValue.length > maxLength && sampleErrors.length < 12) {
                    sampleErrors.push(`Row ${rowIndex + 2}: ${targetColumn} exceeds ${maxLength} characters.`)
                }
            }

            if (!normalizedRow.PartNumber && sampleErrors.length < 12) {
                sampleErrors.push(`Row ${rowIndex + 2}: Part Number is blank.`)
            }
            normalizedRows.push(normalizedRow)
        }

        const preview: VendorImportPreview = {
            valid: issues.length <= 0 && sampleErrors.length <= 0,
            vendorId: vendor.vendorId,
            fileName,
            targetTable: config.targetTable,
            rowCount: normalizedRows.length,
            actualHeaders,
            missingHeaders,
            unexpectedHeaders,
            issues,
            sampleErrors,
            sampleRows: normalizedRows.slice(0, 3),
            snapshotStrategy: `Existing ${config.targetTable} rows will be backed up into ${config.snapshotTable || 'vendorImportSnapshots'} before replace import.`
        }

        return {
            config,
            preview,
            normalizedRows
        }
    }
    private static normalizeImportValue(rawValue: string, type: 'string' | 'money' | 'int' | 'date'): any {
        const value = String(rawValue || '').trim()
        if (!value) {
            return null
        }
        if (type === 'money') {
            const parsed = Number(value.replace(/\$/g, '').replace(/,/g, ''))
            return Number.isFinite(parsed) ? parsed : null
        }
        if (type === 'int') {
            const parsed = Number(value)
            return Number.isFinite(parsed) ? Math.trunc(parsed) : null
        }
        if (type === 'date') {
            const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
            if (usMatch) {
                return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`
            }
            const parsed = new Date(value)
            return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
        }
        return FirewireData.normalizeImportText(value)
    }
    private static normalizeImportText(value: string): string {
        if (!value) {
            return value
        }
        let useOpening = true
        return value.replace(/"/g, () => {
            const next = useOpening ? '“' : '”'
            useOpening = !useOpening
            return next
        })
    }
    private static async buildDeviceSetSummaries(sqldb: SqlDb): Promise<DeviceSetSummaryRow[]> {
        const [deviceSets, deviceSetDevices, devices] = await Promise.all([
            sqldb.getDeviceSets(),
            sqldb.getDeviceSetDevices(),
            sqldb.getVwDevices()
        ])
        const devicesById = new Map(devices.map((row) => [row.deviceId, row] as const))
        const linksBySetId = new Map<string, string[]>()
        for (const row of deviceSetDevices) {
            const existing = linksBySetId.get(row.deviceSetId) || []
            existing.push(row.deviceId)
            linksBySetId.set(row.deviceSetId, existing)
        }

        return deviceSets.map((row) => {
            const linkedDeviceIds = linksBySetId.get(row.deviceSetId) || []
            const linkedDevices = linkedDeviceIds.map((deviceId) => devicesById.get(deviceId)).filter(Boolean)
            const vendorNames = Array.from(new Set(linkedDevices.map((device) => String(device?.vendorName || '').trim()).filter(Boolean)))
            return {
                deviceSetId: row.deviceSetId,
                name: row.name,
                deviceCount: linkedDevices.length,
                vendors: vendorNames,
                createat: row.createat,
                updateat: row.updateat
            }
        })
    }
    private static async buildDeviceSetDetail(sqldb: SqlDb, deviceSetId: string): Promise<DeviceSetDetailRow | null> {
        const [deviceSet, deviceSetDevices, devices] = await Promise.all([
            sqldb.getDeviceSet(deviceSetId),
            sqldb.getDeviceSetDevices(deviceSetId),
            sqldb.getVwDevices()
        ])
        if (!deviceSet) {
            return null
        }
        const devicesById = new Map(devices.map((row) => [row.deviceId, row] as const))
        const linkedDevices = deviceSetDevices
            .map((row) => devicesById.get(row.deviceId))
            .filter(Boolean)
            .sort((left, right) => String(left?.name || '').localeCompare(String(right?.name || '')))

        return {
            deviceSetId: deviceSet.deviceSetId,
            name: deviceSet.name,
            devices: linkedDevices
        }
    }
    private static async buildDeviceVendorLinkIssues(sqldb: SqlDb): Promise<DeviceVendorLinkIssue[]> {
        const devices = await sqldb.getVwDevices()
        const deviceMaterials = await sqldb.getVwDeviceMaterials()
        const ignores = await sqldb.getDeviceVendorLinkIgnores()
        const vendors = await sqldb.getVendors()
        const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor] as const))
        const materialsByDeviceId = new Map<string, VwEddyPricelist[] | any[]>()
        for (const row of deviceMaterials) {
            const existing = materialsByDeviceId.get(row.deviceId) || []
            existing.push(row)
            materialsByDeviceId.set(row.deviceId, existing)
        }

        const issues: DeviceVendorLinkIssue[] = []
        for (const device of devices) {
            const vendor = vendorById.get(device.vendorId)
            if (!vendor) {
                continue
            }
            const resolvedConfig = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
            const config = resolvedConfig.config
            if (!config) {
                continue
            }

            const candidates = [
                { partNumber: String(device.partNumber || '').trim(), sourceKind: 'device' as const, sourceLabel: 'Device default part' },
                ...((materialsByDeviceId.get(device.deviceId) || []).map((row: any) => ({
                    partNumber: String(row.partNumber || '').trim(),
                    sourceKind: 'material' as const,
                    sourceLabel: 'Linked material part'
                })))
            ].filter((row) => !!row.partNumber)

            for (const candidate of candidates) {
                const exists = await FirewireData.checkVendorPartExists(sqldb, vendor, config, candidate.partNumber)
                if (exists) {
                    continue
                }
                const ignored = ignores.find((row) =>
                    row.deviceId === device.deviceId &&
                    row.vendorId === device.vendorId &&
                    row.partNumber === candidate.partNumber &&
                    row.sourceKind === candidate.sourceKind
                )
                issues.push({
                    deviceId: device.deviceId,
                    deviceName: device.name,
                    vendorId: device.vendorId,
                    vendorName: device.vendorName,
                    partNumber: candidate.partNumber,
                    sourceKind: candidate.sourceKind,
                    sourceLabel: candidate.sourceLabel,
                    ignored: !!ignored,
                    ignoreReason: ignored?.reason || null
                })
            }
        }

        return issues
    }
    private static async checkVendorPartExists(sqldb: SqlDb, vendor: Vendor, config: VendorImportConfig, partNumber: string): Promise<boolean> {
        if (config.targetTable === 'EddyPricelist') {
            const rows = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
            return Array.isArray(rows) && rows.length > 0
        }
        return false
    }
    private static async resolveVendorPartRecord(sqldb: SqlDb, vendor: Vendor, partNumber: string): Promise<VwEddyPricelist | null> {
        const resolved = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
        const config = resolved.config
        if (!config) {
            return null
        }
        if (config.targetTable === 'EddyPricelist') {
            const rows = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
            return Array.isArray(rows) && rows.length > 0 ? rows[0] as VwEddyPricelist : null
        }
        return null
    }

    private static async reconcileCategoriesFromDeviceParts(sqldb: SqlDb): Promise<{ rows: CategoryReconcileRow[], summary: { createdCount: number, referencedCategoryCount: number, unreferencedCategoryCount: number } }> {
        const [categories, devices] = await Promise.all([
            sqldb.getCategories(),
            sqldb.getVwDevices()
        ])

        const referencedCategoryCounts = new Map<string, number>()
        const referencedCategorySources = new Map<string, Set<string>>()
        const referencedCategoryDisplayNames = new Map<string, string>()

        for (const device of devices) {
            const categoryName = String(device.categoryName || '').trim()
            if (!categoryName) {
                continue
            }
            const normalizedCategory = FirewireData.normalizeCategoryName(categoryName)
            referencedCategoryCounts.set(normalizedCategory, (referencedCategoryCounts.get(normalizedCategory) || 0) + 1)
            if (!referencedCategoryDisplayNames.has(normalizedCategory)) {
                referencedCategoryDisplayNames.set(normalizedCategory, categoryName)
            }
            const sourceVendors = referencedCategorySources.get(normalizedCategory) || new Set<string>()
            sourceVendors.add(String(device.vendorName || '').trim())
            referencedCategorySources.set(normalizedCategory, sourceVendors)
        }

        const categoriesByNormalizedName = new Map(categories.map((category) => [FirewireData.normalizeCategoryName(category.name), category]))
        const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean))
        const createdCategoryNames = new Set<string>()

        for (const normalizedCategory of referencedCategoryCounts.keys()) {
            if (categoriesByNormalizedName.has(normalizedCategory)) {
                continue
            }
            const displayName = referencedCategoryDisplayNames.get(normalizedCategory) || FirewireData.restoreCategoryDisplayName(normalizedCategory)
            await FirewireData.createCategoryIfMissing(sqldb, displayName, categoriesByNormalizedName, existingHandles, 'category-reconcile')
            createdCategoryNames.add(normalizedCategory)
        }

        const refreshedCategories = await sqldb.getCategories()
        const rows: CategoryReconcileRow[] = refreshedCategories.map((category) => {
            const normalizedCategory = FirewireData.normalizeCategoryName(category.name)
            return {
                ...category,
                referencedByDeviceParts: referencedCategoryCounts.has(normalizedCategory),
                devicePartReferenceCount: referencedCategoryCounts.get(normalizedCategory) || 0,
                sourceVendors: [...(referencedCategorySources.get(normalizedCategory) || new Set<string>())],
                createdByReconcile: createdCategoryNames.has(normalizedCategory)
            }
        })

        return {
            rows,
            summary: {
                createdCount: createdCategoryNames.size,
                referencedCategoryCount: rows.filter((row) => row.referencedByDeviceParts).length,
                unreferencedCategoryCount: rows.filter((row) => !row.referencedByDeviceParts).length
            }
        }
    }

    private static async ensureCategoriesExistForVendorPartNumbers(sqldb: SqlDb, vendor: Vendor, partNumbers: string[]): Promise<void> {
        const uniquePartNumbers = Array.from(new Set(partNumbers.map((value) => String(value || '').trim()).filter(Boolean)))
        if (uniquePartNumbers.length <= 0) {
            return
        }

        const categories = await sqldb.getCategories()
        const categoriesByNormalizedName = new Map(categories.map((category) => [FirewireData.normalizeCategoryName(category.name), category]))
        const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean))

        for (const partNumber of uniquePartNumbers) {
            const partRecord = await FirewireData.resolveVendorPartRecord(sqldb, vendor, partNumber)
            const categoryName = String(partRecord?.Category || '').trim()
            if (!categoryName) {
                continue
            }
            await FirewireData.createCategoryIfMissing(sqldb, categoryName, categoriesByNormalizedName, existingHandles, 'device-category-sync')
        }
    }

    private static async ensureCategoryExistsByName(sqldb: SqlDb, categoryName: string, createdBy: string): Promise<void> {
        const normalizedCategory = FirewireData.normalizeCategoryName(categoryName)
        if (!normalizedCategory) {
            return
        }
        const categories = await sqldb.getCategories()
        const categoriesByNormalizedName = new Map(categories.map((category) => [FirewireData.normalizeCategoryName(category.name), category]))
        const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean))
        await FirewireData.createCategoryIfMissing(sqldb, categoryName, categoriesByNormalizedName, existingHandles, createdBy)
    }

    private static async createCategoryIfMissing(
        sqldb: SqlDb,
        displayName: string,
        categoriesByNormalizedName: Map<string, any>,
        existingHandles: Set<string>,
        createdBy: string
    ): Promise<void> {
        const normalizedCategory = FirewireData.normalizeCategoryName(displayName)
        if (!normalizedCategory || categoriesByNormalizedName.has(normalizedCategory)) {
            return
        }
        const resolvedDisplayName = String(displayName || '').trim() || FirewireData.restoreCategoryDisplayName(normalizedCategory)
        const handle = FirewireData.buildUniqueCategoryHandle(resolvedDisplayName, existingHandles)
        await sqldb.createCategory({
            categoryId: '',
            name: resolvedDisplayName,
            shortName: resolvedDisplayName,
            handle,
            createby: createdBy,
            updateby: createdBy
        })
        existingHandles.add(handle.toLowerCase())
        categoriesByNormalizedName.set(normalizedCategory, {
            categoryId: '',
            name: resolvedDisplayName,
            shortName: resolvedDisplayName,
            handle
        })
    }

    private static normalizeCategoryName(value: string): string {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    }

    private static limitText(value: string, maxLength: number): string {
        return String(value || '').trim().slice(0, Math.max(0, maxLength))
    }

    private static getSafeDeviceName(name: string, partNumber: string): string {
        const trimmedName = String(name || '').trim()
        const trimmedPartNumber = String(partNumber || '').trim()
        if (!trimmedName || trimmedName.length > 30) {
            return FirewireData.limitText(trimmedPartNumber, 100)
        }
        return FirewireData.limitText(trimmedName, 100)
    }

    private static restoreCategoryDisplayName(normalizedValue: string): string {
        return String(normalizedValue || '')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ')
    }

    private static buildUniqueCategoryHandle(name: string, existingHandles: Set<string>): string {
        const maxLength = 10
        const rawBaseHandle = String(name || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '') || 'CATEGORY'
        const baseHandle = rawBaseHandle.slice(0, maxLength) || 'CATEGORY'.slice(0, maxLength)
        let nextHandle = baseHandle
        let suffix = 2
        while (existingHandles.has(nextHandle.toLowerCase())) {
            const suffixText = String(suffix)
            const allowedBaseLength = Math.max(1, maxLength - suffixText.length)
            const truncatedBase = baseHandle.slice(0, allowedBaseLength) || baseHandle.slice(0, allowedBaseLength)
            nextHandle = `${truncatedBase}${suffixText}`.slice(0, maxLength)
            suffix += 1
        }
        return nextHandle
    }

    private static async loadStoredWorkspace(sqldb: SqlDb, area: string, workspaceKey: string, defaultPayload: any): Promise<StoredWorkspaceResponse> {
        const record = await sqldb.getWorkspaceStorage(area, workspaceKey)
        if (!record?.payloadJson) {
            return {
                workspaceKey,
                payload: defaultPayload
            }
        }

        try {
            return {
                workspaceKey,
                payload: JSON.parse(record.payloadJson),
                updatedAt: record.updateat
            }
        } catch {
            return {
                workspaceKey,
                payload: defaultPayload,
                updatedAt: record.updateat
            }
        }
    }
}
