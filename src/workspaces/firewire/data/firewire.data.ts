import * as express from 'express'
import multer from 'multer'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { SqlDb } from '../../fieldwire/repository/sqldb'
import { Vendor } from '../../fieldwire/repository/vendor'
import { VwPart } from '../../fieldwire/repository/vwpart'
import { Part } from '../../fieldwire/repository/part'
import { AzureBlobDocumentStorage } from './azure-blob-document-storage'

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

const uploadDocLibraryFileToMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_DOC_LIBRARY_MAX_FILE_BYTES || 250 * 1024 * 1024)
    }
}).single('file')

interface VendorImportConfig {
    partsVendorKey: string
    sourceLabel: string
    targetTable: string
    filePattern?: string
    expectedHeaders: string[]
    headerMap: Record<string, keyof Part>
    columnTypes: Partial<Record<keyof Part, 'string' | 'money' | 'int' | 'date'>>
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
    sampleRows: Part[]
    snapshotStrategy: string
}

interface NormalizedImportResult {
    config: VendorImportConfig
    preview: VendorImportPreview
    normalizedRows: Part[]
}

interface BulkPartsWorkbookVendorResult {
    sheetName: string
    vendorId?: string
    vendorName?: string
    matched: boolean
    valid: boolean
    rowCount: number
    importedRowCount?: number
    snapshotId?: string
    runId?: string
    issues: string[]
    sampleErrors: string[]
}

interface BulkPartsWorkbookResult {
    fileName: string
    sheetCount: number
    matchedVendorCount: number
    skippedSheetCount: number
    importedVendorCount: number
    importedRowCount: number
    valid: boolean
    results: BulkPartsWorkbookVendorResult[]
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

interface DeviceSetSummaryRow {
    deviceSetId: string
    name: string
    visibility: string[]
    ownerUserId?: string | null
    deviceCount: number
    vendors: string[]
    createat?: Date
    updateat?: Date
}

interface DeviceSetDetailRow {
    deviceSetId: string
    name: string
    visibility: string[]
    ownerUserId?: string | null
    devices: any[]
}

interface StoredWorkspaceResponse {
    workspaceKey: string
    payload: any
    updatedAt?: Date
}

interface DeviceMediaFile {
    id: string
    fileName: string
    mimeType: string
    sizeBytes: number
    uploadedAt: string
    uploadedBy: string
    blobContainerName: string
    blobName: string
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
        {
            method: 'post',
            path: '/api/firewire/storage/project-doc-library/:workspaceKey/files',
            fx: async (req: express.Request, res: express.Response) => {
                uploadDocLibraryFileToMemory(req, res, async(err) => {
                    try {
                        if (err instanceof multer.MulterError) {
                            return res.status(400).json({ message: err.message })
                        }
                        if (err) {
                            return res.status(500).json({ message: err.message || err })
                        }

                        const workspaceKey = String(req.params.workspaceKey || '').trim()
                        if (!workspaceKey) {
                            return res.status(400).json({ message: 'workspaceKey is required.' })
                        }
                        if (!req.file?.buffer?.length) {
                            return res.status(400).json({ message: 'file is required.' })
                        }

                        const storage = new AzureBlobDocumentStorage()
                        if (!storage.isConfigured()) {
                            return res.status(500).json({
                                message: 'Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.'
                            })
                        }

                        const fileId = FirewireData.resolveUploadField(req.body?.fileId) || FirewireData.createClientSafeId('doc')
                        const versionId = FirewireData.resolveUploadField(req.body?.versionId) || FirewireData.createClientSafeId('ver')
                        const folderId = FirewireData.resolveUploadField(req.body?.folderId) || 'unfiled'
                        const versionNumber = Number(FirewireData.resolveUploadField(req.body?.versionNumber) || 1)
                        const uploadedAt = new Date().toISOString()
                        const safeName = FirewireData.sanitizeBlobPathSegment(req.file.originalname || 'document')
                        const blobName = [
                            'project-doc-library',
                            FirewireData.sanitizeBlobPathSegment(workspaceKey),
                            FirewireData.sanitizeBlobPathSegment(fileId),
                            `${String(versionNumber).padStart(4, '0')}-${FirewireData.sanitizeBlobPathSegment(versionId)}-${safeName}`
                        ].join('/')

                        await storage.upload({
                            buffer: req.file.buffer,
                            containerName: workspaceKey,
                            blobName,
                            contentType: req.file.mimetype || 'application/octet-stream',
                            metadata: {
                                workspaceKey,
                                fileId,
                                versionId,
                                folderId
                            }
                        })

                        return res.status(200).json({
                            data: {
                                id: versionId,
                                versionNumber,
                                uploadedAt,
                                uploadedBy: 'Current User',
                                sourceFileName: req.file.originalname,
                                sizeBytes: req.file.size,
                                mimeType: req.file.mimetype || 'application/octet-stream',
                                lastModified: Number(FirewireData.resolveUploadField(req.body?.lastModified) || Date.now()),
                                blobContainerName: storage.getProjectContainerName(workspaceKey),
                                blobName
                            }
                        })
                    } catch (uploadErr: Error|any) {
                        return res.status(500).json({
                            message: uploadErr && uploadErr.message ? uploadErr.message : uploadErr
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/firewire/storage/project-doc-library/:workspaceKey/files/:fileId/versions/:versionId/content',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const workspaceKey = String(req.params.workspaceKey || '').trim()
                    const fileId = String(req.params.fileId || '').trim()
                    const versionId = String(req.params.versionId || '').trim()
                    if (!workspaceKey || !fileId || !versionId) {
                        return res.status(400).json({ message: 'workspaceKey, fileId, and versionId are required.' })
                    }

                    const sqldb = new SqlDb(req.app)
                    const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] })
                    const file = Array.isArray(workspace.payload?.files)
                        ? workspace.payload.files.find((item: any) => item?.id === fileId)
                        : undefined
                    const version = file?.versions?.find((item: any) => item?.id === versionId)
                    if (!file || !version) {
                        const storage = new AzureBlobDocumentStorage()
                        if (storage.isConfigured()) {
                            const blobPrefix = [
                                'project-doc-library',
                                FirewireData.sanitizeBlobPathSegment(workspaceKey),
                                FirewireData.sanitizeBlobPathSegment(fileId),
                                ''
                            ].join('/')
                            const safeVersionId = FirewireData.sanitizeBlobPathSegment(versionId)
                            const blobNames = await storage.listBlobNamesByPrefix(workspaceKey, blobPrefix)
                            const blobName = blobNames.find((name) => name.includes(`-${safeVersionId}-`))
                            if (blobName) {
                                const result = await storage.download(workspaceKey, blobName)
                                res.setHeader('Content-Type', result.contentType)
                                res.setHeader('Content-Disposition', `inline; filename="${FirewireData.escapeHeaderFileName(file?.name || 'document')}"`)
                                return res.status(200).send(result.buffer)
                            }
                        }
                        return res.status(404).json({ message: 'Document version was not found.' })
                    }

                    if (version.blobName) {
                        const storage = new AzureBlobDocumentStorage()
                        const result = await storage.download(version.blobContainerName || workspaceKey, version.blobName)
                        res.setHeader('Content-Type', result.contentType)
                        res.setHeader('Content-Disposition', `inline; filename="${FirewireData.escapeHeaderFileName(version.sourceFileName || file.name || 'document')}"`)
                        return res.status(200).send(result.buffer)
                    }

                    if (version.dataUrl) {
                        const dataUrl = String(version.dataUrl)
                        const commaIndex = dataUrl.indexOf(',')
                        const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : ''
                        const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl
                        const mimeTypeMatch = header.match(/data:(.*?);base64/)
                        res.setHeader('Content-Type', mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream')
                        res.setHeader('Content-Disposition', `inline; filename="${FirewireData.escapeHeaderFileName(version.sourceFileName || file.name || 'document')}"`)
                        return res.status(200).send(Buffer.from(base64, 'base64'))
                    }

                    return res.status(404).json({ message: 'Document version content was not found.' })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'delete',
            path: '/api/firewire/storage/project-doc-library/:workspaceKey/files/:fileId',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const workspaceKey = String(req.params.workspaceKey || '').trim()
                    const fileId = String(req.params.fileId || '').trim()
                    if (!workspaceKey || !fileId) {
                        return res.status(400).json({ message: 'workspaceKey and fileId are required.' })
                    }

                    const sqldb = new SqlDb(req.app)
                    const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] })
                    const files = Array.isArray(workspace.payload?.files) ? workspace.payload.files : []
                    const file = files.find((item: any) => item?.id === fileId)
                    if (!file) {
                        return res.status(404).json({ message: 'Document file was not found.' })
                    }

                    const storage = new AzureBlobDocumentStorage()
                    const deletedBlobs: string[] = []
                    const missingBlobs: string[] = []
                    for (const version of Array.isArray(file.versions) ? file.versions : []) {
                        if (!version?.blobName) {
                            continue
                        }
                        const deleted = await storage.deleteIfExists(version.blobContainerName || workspaceKey, version.blobName)
                        if (deleted) {
                            deletedBlobs.push(version.blobName)
                        } else {
                            missingBlobs.push(version.blobName)
                        }
                    }

                    const nextPayload = {
                        ...(workspace.payload || {}),
                        files: files.filter((item: any) => item?.id !== fileId)
                    }
                    await sqldb.saveWorkspaceStorage('project-doc-library', workspaceKey, JSON.stringify(nextPayload), 'system')
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] })
                    return res.status(200).json({
                        data: {
                            payload: result.payload,
                            deletedBlobs,
                            missingBlobs
                        }
                    })
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
        {
            method: 'get',
            path: '/api/firewire/device-icons',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const rows = await sqldb.getDeviceIconGroups()
                        return resolve(res.status(200).json({ rows }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'post',
            path: '/api/firewire/device-icons/groups',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const name = String(req.body?.name || '').trim()
                        if (!name) {
                            return resolve(res.status(400).json({ message: 'Icon group name is required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const iconGroupId = await sqldb.createDeviceIconGroup(name)
                        return resolve(res.status(201).json({ iconGroupId }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'put',
            path: '/api/firewire/device-icons/groups/:iconGroupId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const iconGroupId = String(req.params.iconGroupId || '').trim()
                        const name = String(req.body?.name || '').trim()
                        if (!iconGroupId || !name) {
                            return resolve(res.status(400).json({ message: 'Icon group id and name are required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        await sqldb.updateDeviceIconGroup(iconGroupId, name)
                        return resolve(res.status(200).json({ success: true }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'delete',
            path: '/api/firewire/device-icons/groups/:iconGroupId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const iconGroupId = String(req.params.iconGroupId || '').trim()
                        if (!iconGroupId) {
                            return resolve(res.status(400).json({ message: 'Icon group id is required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        await sqldb.deleteDeviceIconGroup(iconGroupId)
                        return resolve(res.status(200).json({ success: true }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'post',
            path: '/api/firewire/device-icons/groups/:iconGroupId/icons',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const iconGroupId = String(req.params.iconGroupId || '').trim()
                        const label = String(req.body?.label || '').trim()
                        const fileName = String(req.body?.fileName || '').trim()
                        const mimeType = String(req.body?.mimeType || '').trim()
                        const dataUrl = String(req.body?.dataUrl || '').trim()
                        if (!iconGroupId || !label || !dataUrl) {
                            return resolve(res.status(400).json({ message: 'Icon group id, label, and image data are required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const iconId = await sqldb.createDeviceIcon({ iconGroupId, label, fileName, mimeType, dataUrl })
                        return resolve(res.status(201).json({ iconId }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'put',
            path: '/api/firewire/device-icons/icons/:iconId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const iconId = String(req.params.iconId || '').trim()
                        if (!iconId) {
                            return resolve(res.status(400).json({ message: 'Icon id is required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        await sqldb.updateDeviceIcon({
                            iconId,
                            label: typeof req.body?.label === 'string' ? req.body.label : undefined,
                            fileName: typeof req.body?.fileName === 'string' ? req.body.fileName : undefined,
                            mimeType: typeof req.body?.mimeType === 'string' ? req.body.mimeType : undefined,
                            dataUrl: typeof req.body?.dataUrl === 'string' ? req.body.dataUrl : undefined
                        })
                        return resolve(res.status(200).json({ success: true }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
                    }
                })
            }
        },
        {
            method: 'delete',
            path: '/api/firewire/device-icons/icons/:iconId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve) => {
                    try {
                        const iconId = String(req.params.iconId || '').trim()
                        if (!iconId) {
                            return resolve(res.status(400).json({ message: 'Icon id is required.' }))
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        await sqldb.deleteDeviceIcon(iconId)
                        return resolve(res.status(200).json({ success: true }))
                    } catch (err: any) {
                        console.error(err)
                        return resolve(res.status(500).json({ message: err?.message || err }))
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

                        const linkedDeviceParts = await sqldb.getDeviceMaterialByDeviceId(deviceId) || []
                        await sqldb.deleteDeviceMaterialMapsByDeviceId(deviceId)
                        await sqldb.deleteMaterialAttributesByMaterialId(deviceId)
                        await sqldb.deleteMaterialSubTasksByMaterialId(deviceId)
                        await sqldb.deleteDeviceVendorLinkIgnoresByDeviceId(deviceId)
                        await sqldb.deleteDeviceSetDevicesByDeviceId(deviceId)
                        const deletedMediaBlobs = await FirewireData.deleteDeviceMediaWorkspace(sqldb, deviceId)
                        await sqldb.deleteDevice(deviceId)

                        return res.status(200).json({
                            data: {
                                deviceId,
                                deletedDevicePartIds: linkedDeviceParts
                                    .map((row: any) => String(row.devicePartId || row.materialId || '').trim())
                                    .filter(Boolean),
                                deletedMediaBlobs
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
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/media',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const deviceId = String(req.params.deviceId || '').trim()
                    if (!deviceId) {
                        return res.status(400).json({ message: 'deviceId is required.' })
                    }
                    const sqldb = new SqlDb(req.app)
                    const result = await FirewireData.loadStoredWorkspace(sqldb, 'device-media', deviceId, { files: [] })
                    return res.status(200).json({ data: result.payload })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'post',
            path: '/api/firewire/devices/:deviceId/media',
            fx: async (req: express.Request, res: express.Response) => {
                uploadDocLibraryFileToMemory(req, res, async(err) => {
                    try {
                        if (err instanceof multer.MulterError) {
                            return res.status(400).json({ message: err.message })
                        }
                        if (err) {
                            return res.status(500).json({ message: err.message || err })
                        }

                        const deviceId = String(req.params.deviceId || '').trim()
                        if (!deviceId) {
                            return res.status(400).json({ message: 'deviceId is required.' })
                        }
                        if (!req.file?.buffer?.length) {
                            return res.status(400).json({ message: 'file is required.' })
                        }

                        const sqldb = new SqlDb(req.app)
                        const device = await sqldb.getDevice(deviceId)
                        if (!device) {
                            return res.status(404).json({ message: `Device ${deviceId} not found.` })
                        }

                        const storage = new AzureBlobDocumentStorage()
                        if (!storage.isConfigured()) {
                            return res.status(500).json({
                                message: 'Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.'
                            })
                        }

                        const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'device-media', deviceId, { files: [] })
                        const files = Array.isArray(workspace.payload?.files) ? workspace.payload.files : []
                        const fileId = FirewireData.createClientSafeId('media')
                        const uploadedAt = new Date().toISOString()
                        const safeName = FirewireData.sanitizeBlobPathSegment(req.file.originalname || 'device-media')
                        const blobName = [
                            'device-media',
                            FirewireData.sanitizeBlobPathSegment(deviceId),
                            `${FirewireData.sanitizeBlobPathSegment(fileId)}-${safeName}`
                        ].join('/')

                        await storage.upload({
                            buffer: req.file.buffer,
                            containerName: deviceId,
                            blobName,
                            contentType: req.file.mimetype || 'application/octet-stream',
                            metadata: {
                                deviceId,
                                fileId
                            }
                        })

                        const mediaFile: DeviceMediaFile = {
                            id: fileId,
                            fileName: req.file.originalname || 'device-media',
                            mimeType: req.file.mimetype || 'application/octet-stream',
                            sizeBytes: req.file.size,
                            uploadedAt,
                            uploadedBy: 'Current User',
                            blobContainerName: storage.getProjectContainerName(deviceId),
                            blobName
                        }
                        const nextPayload = {
                            ...(workspace.payload || {}),
                            files: [...files, mediaFile]
                        }
                        await sqldb.saveWorkspaceStorage('device-media', deviceId, JSON.stringify(nextPayload), 'system')
                        return res.status(200).json({ data: nextPayload })
                    } catch (uploadErr: Error|any) {
                        return res.status(500).json({
                            message: uploadErr && uploadErr.message ? uploadErr.message : uploadErr
                        })
                    }
                })
            }
        },
        {
            method: 'delete',
            path: '/api/firewire/devices/:deviceId/media/:fileId',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const deviceId = String(req.params.deviceId || '').trim()
                    const fileId = String(req.params.fileId || '').trim()
                    if (!deviceId || !fileId) {
                        return res.status(400).json({ message: 'deviceId and fileId are required.' })
                    }
                    const sqldb = new SqlDb(req.app)
                    const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'device-media', deviceId, { files: [] })
                    const files = Array.isArray(workspace.payload?.files) ? workspace.payload.files : []
                    const file = files.find((item: any) => item?.id === fileId)
                    if (!file) {
                        return res.status(404).json({ message: 'Device media file was not found.' })
                    }
                    if (file.blobName) {
                        const storage = new AzureBlobDocumentStorage()
                        await storage.deleteIfExists(file.blobContainerName || deviceId, file.blobName)
                    }
                    const nextPayload = {
                        ...(workspace.payload || {}),
                        files: files.filter((item: any) => item?.id !== fileId)
                    }
                    await sqldb.saveWorkspaceStorage('device-media', deviceId, JSON.stringify(nextPayload), 'system')
                    return res.status(200).json({ data: nextPayload })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/media/:fileId/content',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const deviceId = String(req.params.deviceId || '').trim()
                    const fileId = String(req.params.fileId || '').trim()
                    if (!deviceId || !fileId) {
                        return res.status(400).json({ message: 'deviceId and fileId are required.' })
                    }
                    const sqldb = new SqlDb(req.app)
                    const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'device-media', deviceId, { files: [] })
                    const files = Array.isArray(workspace.payload?.files) ? workspace.payload.files : []
                    const file = files.find((item: any) => item?.id === fileId)
                    if (!file?.blobName) {
                        return res.status(404).json({ message: 'Device media file was not found.' })
                    }

                    const storage = new AzureBlobDocumentStorage()
                    if (!storage.isConfigured()) {
                        return res.status(500).json({
                            message: 'Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.'
                        })
                    }

                    const result = await storage.download(file.blobContainerName || deviceId, file.blobName)
                    const disposition = String(req.query.disposition || '').toLowerCase() === 'attachment' ? 'attachment' : 'inline'
                    const fileName = FirewireData.escapeHeaderFileName(file.fileName || 'device-media')
                    res.setHeader('Content-Type', result.contentType || file.mimeType || 'application/octet-stream')
                    res.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`)
                    res.setHeader('Content-Length', String(result.buffer.length))
                    return res.status(200).send(result.buffer)
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        },
        // Sync Device Prices From Linked Parts
        {
            method: 'post',
            path: '/api/firewire/devices/:deviceId/sync-part-prices',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const deviceId = String(req.params.deviceId || '').trim()
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'deviceId is required.'
                        })
                    }

                    const sqldb = new SqlDb(req.app)
                    const result = await FirewireData.syncDevicePartPrices(sqldb, deviceId)
                    if (!result) {
                        return res.status(404).json({
                            message: `Device ${deviceId} not found.`
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
                        const categoryName = String(req.body?.device?.categoryName ?? existing.categoryName ?? '').trim()
                        const includeOnFloorplan = typeof req.body?.device?.includeOnFloorplan === 'undefined'
                            ? !!existing.includeOnFloorplan
                            : !!req.body.device.includeOnFloorplan
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
                            categoryName,
                            includeOnFloorplan,
                            partNumber: String(req.body?.device?.partNumber || existing.partNumber || '').trim(),
                            link: String(req.body?.device?.link || '').trim(),
                            cost: Number(req.body?.device?.cost ?? existing.cost ?? 0),
                            defaultLabor: Number(req.body?.device?.defaultLabor ?? existing.defaultLabor ?? 0),
                            laborRate: Number(req.body?.device?.laborRate ?? existing.laborRate ?? 56),
                            iconId: String(req.body?.device?.iconId ?? existing.iconId ?? '').trim() || null,
                            iconForegroundColor: String(req.body?.device?.iconForegroundColor ?? existing.iconForegroundColor ?? '#210507').trim() || '#210507',
                            slcAddress: String(req.body?.device?.slcAddress || '').trim(),
                            serialNumber: String(req.body?.device?.serialNumber || '').trim(),
                            strobeAddress: String(req.body?.device?.strobeAddress || '').trim(),
                            speakerAddress: String(req.body?.device?.speakerAddress || '').trim()
                        })

                        const devicePartsPayload = Array.isArray(req.body?.deviceParts)
                            ? req.body.deviceParts
                            : (Array.isArray(req.body?.partNumbers)
                                ? req.body.partNumbers.map((partNumber: unknown) => ({ partNumber, vendorId }))
                                : [])
                        const devicePartSnapshots: any[] = []
                        const seenDeviceParts = new Set<string>()
                        for (const rawPart of devicePartsPayload) {
                            const partNumber = String(rawPart?.partNumber || rawPart?.materialPartNumber || rawPart || '').trim()
                            const partVendorId = String(rawPart?.vendorId || vendorId || '').trim()
                            if (!partNumber || !partVendorId) {
                                continue
                            }
                            const dedupeKey = `${partVendorId.toLowerCase()}::${partNumber.toLowerCase()}`
                            if (seenDeviceParts.has(dedupeKey)) {
                                continue
                            }
                            const partVendor = partVendorId === vendor.vendorId ? vendor : await sqldb.getVendorById(partVendorId)
                            if (!partVendor) {
                                return res.status(404).json({
                                    message: `Vendor ${partVendorId} not found for part ${partNumber}.`
                                })
                            }
                            const partRecord = await FirewireData.resolveVendorPartRecord(sqldb, partVendor, partNumber)
                            if (!partRecord) {
                                return res.status(400).json({
                                    message: `Part ${partNumber} does not exist in the configured vendor source for ${partVendor.name}.`
                                })
                            }
                            devicePartSnapshots.push(FirewireData.createDevicePartSnapshotFromPart(partRecord, partVendorId, rawPart?.quantityPerDevice))
                            seenDeviceParts.add(dedupeKey)
                        }

                        await sqldb.replaceDeviceParts(deviceId, devicePartSnapshots, FirewireData.resolveUserId(req))

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
                        const visibility = FirewireData.normalizeDeviceSetVisibility(req.body?.visibility)
                        const userId = FirewireData.resolveUserId(req)
                        const deviceSetId = await sqldb.createDeviceSet({
                            name,
                            visibility,
                            ownerUserId: userId,
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
                        const normalizedVisibility = Array.isArray(req.body?.visibility)
                            ? FirewireData.normalizeDeviceSetVisibility(req.body.visibility)
                            : undefined
                        const userId = FirewireData.resolveUserId(req)
                        await sqldb.updateDeviceSet({
                            deviceSetId,
                            name,
                            visibility: normalizedVisibility,
                            ownerUserId: normalizedVisibility?.includes('current-user') ? userId : existing.ownerUserId || '',
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
        // Legacy materials catalog is retired. Device composition now uses deviceParts.
        {
            method: 'get',
            path: '/api/firewire/vwmaterials',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    return res.status(410).json({
                        rows: [],
                        message: 'The legacy materials catalog has been retired. Use parts and device parts.'
                    })
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
        // Get master parts
        {
            method: 'get',
            path: '/api/firewire/parts',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getParts()
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
        // Get master parts by Part Number
        {
            method: 'get',
            path: '/api/firewire/parts/:partNumber',
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
                        const result = await sqldb.getPartByPartNumber(partNumber)
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
        // Get vendor parts
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        if (!vendorId) {
                            return res.status(400).json({ message: 'vendorId is required.' })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({ message: `Vendor ${vendorId} not found.` })
                        }
                        const result = await sqldb.getPartsByVendor(vendorId)
                        return res.status(200).json({ rows: result })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get generic vendor part by part number
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts/:partNumber',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const partNumber = String(req.params.partNumber || '').trim()
                        if (!vendorId || !partNumber) {
                            return res.status(400).json({ message: 'vendorId and partNumber are required.' })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getPartByVendorAndPartNumber(vendorId, partNumber)
                        return res.status(200).json({ rows: result })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Delete generic vendor part by part number
        {
            method: 'delete',
            path: '/api/firewire/vendors/:vendorId/parts/:partNumber',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const partNumber = String(req.params.partNumber || '').trim()
                        if (!vendorId || !partNumber) {
                            return res.status(400).json({ message: 'vendorId and partNumber are required.' })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({ message: `Vendor ${vendorId} not found.` })
                        }
                        const rows = await sqldb.getPartByVendorAndPartNumber(vendorId, partNumber)
                        const part = Array.isArray(rows) && rows.length > 0 ? rows[0] as VwPart : null
                        if (!part) {
                            return res.status(404).json({ message: `Part ${partNumber} not found for ${vendor.name}.` })
                        }
                        await sqldb.deletePartByVendorAndPartNumber(vendorId, partNumber)
                        return res.status(200).json({
                            data: {
                                vendorId,
                                partNumber
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
        // Create Device using generic vendor part
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/parts/:partNumber/create-device',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const partNumber = String(req.params.partNumber || '').trim()
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({ message: `Vendor ${vendorId} not found.` })
                        }
                        const rows = await sqldb.getPartByVendorAndPartNumber(vendorId, partNumber)
                        const part = Array.isArray(rows) && rows.length > 0 ? rows[0] as VwPart : null
                        if (!part) {
                            return res.status(404).json({ message: `Part ${partNumber} not found for ${vendor.name}.` })
                        }
                        const data = await FirewireData.createDeviceFromVendorPart(sqldb, vendor, partNumber, part, req.body)
                        return res.status(201).json({ data })
                    } catch (err: Error|any) {
                        const status = err && Number(err.status) ? Number(err.status) : 500
                        return res.status(status).json({
                            message: err && err.message ? err.message : err,
                            data: err && err.data ? err.data : undefined
                        })
                    }
                })
            }
        },
        // Add generic vendor part to existing device
        {
            method: 'post',
            path: '/api/firewire/vendors/:vendorId/parts/:partNumber/add-to-device',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const partNumber = String(req.params.partNumber || '').trim()
                        const deviceId = String(req.body?.deviceId || '').trim()
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const vendor = await sqldb.getVendorById(vendorId)
                        if (!vendor) {
                            return res.status(404).json({ message: `Vendor ${vendorId} not found.` })
                        }
                        const rows = await sqldb.getPartByVendorAndPartNumber(vendorId, partNumber)
                        const part = Array.isArray(rows) && rows.length > 0 ? rows[0] as VwPart : null
                        if (!part) {
                            return res.status(404).json({ message: `Part ${partNumber} not found for ${vendor.name}.` })
                        }
                        const data = await FirewireData.addVendorPartToExistingDevice(sqldb, vendor, partNumber, part, deviceId)
                        return res.status(data.createdMap ? 201 : 200).json({ data })
                    } catch (err: Error|any) {
                        const status = err && Number(err.status) ? Number(err.status) : 500
                        return res.status(status).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Preview Vendor parts Import
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
        // Execute Vendor parts Import
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
                        if (normalized.config.targetTable !== 'parts') {
                            return res.status(400).json({
                                message: `Unsupported target table ${normalized.config.targetTable}.`
                            })
                        }

                        const existingRows = await sqldb.getRawPartsByVendor(vendorId)
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

                        await sqldb.replacePartsForVendor(vendorId, normalized.normalizedRows)
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
        // Preview All Vendor Parts Workbook Import
        {
            method: 'post',
            path: '/api/firewire/parts-import/workbook/preview',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const file = await FirewireData.getUpload(req, res)
                        if (!file) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing file form field.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await FirewireData.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, false)
                        return res.status(200).json({ data: result })
                    } catch (err: Error|any) {
                        return res.status(err instanceof multer.MulterError ? 400 : 500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Execute All Vendor Parts Workbook Import
        {
            method: 'post',
            path: '/api/firewire/parts-import/workbook',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const file = await FirewireData.getUpload(req, res)
                        if (!file) {
                            return res.status(400).json({
                                message: 'Invalid payload: missing file form field.'
                            })
                        }

                        const sqldb: SqlDb = new SqlDb(req.app)
                        const preview = await FirewireData.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, false)
                        if (!preview.valid) {
                            return res.status(400).json({
                                message: 'Workbook import verification failed.',
                                data: preview
                            })
                        }
                        const result = await FirewireData.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, true)
                        return res.status(201).json({ data: result })
                    } catch (err: Error|any) {
                        return res.status(err instanceof multer.MulterError ? 400 : 500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get Vendor parts Import Snapshots
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts-import-snapshots',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const targetTable = FirewireData.normalizePartsTargetTable(req.query?.targetTable)
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
        // Get Vendor parts Import Status
        {
            method: 'get',
            path: '/api/firewire/vendors/:vendorId/parts-import-status',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const vendorId = String(req.params.vendorId || '').trim()
                        const targetTable = FirewireData.normalizePartsTargetTable(req.query?.targetTable)
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
        // Restore Vendor parts Import Snapshot
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
                        if (snapshot.targetTable !== 'parts') {
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
                        await sqldb.replacePartsForVendor(vendorId, rows as Part[])
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
        const vendorName = String(vendor.name || 'Vendor').trim() || 'Vendor'
        const vendorKey = FirewireData.slugify(vendorName)
        return {
            partsVendorKey: vendorKey,
            sourceLabel: `${vendorName} parts import`,
            targetTable: 'parts',
            filePattern: '*.csv,*.xlsx,*.xls',
            expectedHeaders: [
                'PART NUMBER',
                'DESCRIPTION',
                'PARENT CATEGORY',
                'CATEGORY',
                'MSRP',
                'MIN QTY',
                'UPC',
                'COST'
            ],
            headerMap: {
                'PART NUMBER': 'partNumber',
                'DESCRIPTION': 'description',
                'PARENT CATEGORY': 'parentCategory',
                'CATEGORY': 'category',
                'MSRP': 'msrp',
                'MIN QTY': 'minQty',
                'UPC': 'upc',
                'COST': 'cost'
            },
            columnTypes: {
                partNumber: 'string',
                description: 'string',
                parentCategory: 'string',
                category: 'string',
                msrp: 'money',
                minQty: 'int',
                upc: 'string',
                cost: 'money'
            },
            normalizationSteps: [
                'Map vendor file headers to canonical parts column names before load.',
                'Treat part numbers as text identifiers, including values Excel formatted as currency.',
                'Strip currency symbols and commas from MSRP and cost fields.',
                'Allow blanks to load as NULL for nullable columns.',
                'Backup the current vendor parts rows before replacing them.'
            ],
            analysisSummary: [
                'Default master parts import configuration.',
                'Expected headers match the canonical master parts fields.'
            ],
            replaceMode: 'truncate-and-load',
            snapshotTable: 'vendorImportSnapshots'
        }
    }
    private static sanitizeVendorImportConfig(raw: any): VendorImportConfig {
        const base = raw && typeof raw === 'object' ? raw : {}
        return {
            partsVendorKey: String(base.partsVendorKey || '').trim() || 'vendor',
            sourceLabel: String(base.sourceLabel || '').trim() || 'Vendor parts import',
            targetTable: FirewireData.normalizePartsTargetTable(base.targetTable),
            filePattern: String(base.filePattern || '').trim() || '*.csv,*.xlsx,*.xls',
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
    private static normalizePartsTargetTable(value: unknown): string {
        return 'parts'
    }
    private static slugify(value: string): string {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'vendor'
    }
    private static normalizeHeaderMap(raw: any): Record<string, keyof Part> {
        const output: Record<string, keyof Part> = {}
        if (!raw || typeof raw !== 'object') {
            return output
        }
        for (const [key, value] of Object.entries(raw)) {
            const header = String(key || '').trim()
            const target = String(value || '').trim() as keyof Part
            if (header && target) {
                output[header] = target
            }
        }
        return output
    }
    private static normalizeColumnTypes(raw: any): Partial<Record<keyof Part, 'string' | 'money' | 'int' | 'date'>> {
        const output: Partial<Record<keyof Part, 'string' | 'money' | 'int' | 'date'>> = {}
        if (!raw || typeof raw !== 'object') {
            return output
        }
        for (const [key, value] of Object.entries(raw)) {
            const type = String(value || '').trim()
            if (type === 'string' || type === 'money' || type === 'int' || type === 'date') {
                output[key as keyof Part] = type
            }
        }
        return output
    }
    private static async buildNormalizedImportResult(sqldb: SqlDb, vendor: Vendor, fileName: string, fileBuffer: Buffer): Promise<NormalizedImportResult> {
        return FirewireData.buildNormalizedImportResultFromRows(sqldb, vendor, fileName, FirewireData.parsePartsImportRows(fileName, fileBuffer))
    }
    private static async buildNormalizedImportResultFromRows(sqldb: SqlDb, vendor: Vendor, fileName: string, parsedRows: string[][]): Promise<NormalizedImportResult> {
        const resolved = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
        if (!resolved.config) {
            throw new Error(`No import configuration exists for vendor ${vendor.name}.`)
        }
        const config = resolved.config
        const actualHeaders = Array.isArray(parsedRows[0]) ? parsedRows[0].map((value) => String(value || '').trim()) : []
        const bodyRows = parsedRows.slice(1)
        const actualHeaderByNormalized = new Map(actualHeaders.map((header) => [FirewireData.normalizeHeaderName(header), header] as const))
        const expectedHeaderSet = new Set(config.expectedHeaders.map((header) => FirewireData.normalizeHeaderName(header)))
        const missingHeaders = config.expectedHeaders.filter((header) => !actualHeaderByNormalized.has(FirewireData.normalizeHeaderName(header)))
        const unexpectedHeaders = actualHeaders.filter((header) => !expectedHeaderSet.has(FirewireData.normalizeHeaderName(header)))
        const issues: string[] = []
        const sampleErrors: string[] = []
        const normalizedRows: Part[] = []

        const lengthLimits: Partial<Record<keyof Part, number>> = {
            ParentCategory: 500,
            parentCategory: 500,
            Category: 500,
            category: 500,
            PartNumber: 120,
            partNumber: 120,
            LongDescription: 2000,
            description: 2000,
            ProductStatus: 500,
            productStatus: 500,
            Agency: 50,
            agency: 50,
            CountryOfOrigin: 50,
            countryOfOrigin: 50,
            UPC: 50,
            upc: 50
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
            const normalizedRow: Part = {
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
                const actualHeader = actualHeaderByNormalized.get(FirewireData.normalizeHeaderName(sourceHeader)) || sourceHeader
                const rawValue = sourceRow[actualHeader] ?? ''
                const type = config.columnTypes[targetColumn] || 'string'
                const normalizedValue = FirewireData.isPartNumberColumn(targetColumn)
                    ? FirewireData.normalizePartNumberImportValue(rawValue)
                    : FirewireData.normalizeImportValue(rawValue, type)
                ;(normalizedRow as any)[targetColumn] = normalizedValue

                const maxLength = lengthLimits[targetColumn]
                if (maxLength && typeof normalizedValue === 'string' && normalizedValue.length > maxLength && sampleErrors.length < 12) {
                    sampleErrors.push(`Row ${rowIndex + 2}: ${targetColumn} exceeds ${maxLength} characters.`)
                }
            }

            const normalizedPartNumber = FirewireData.getNormalizedRowPartNumber(normalizedRow)
            if (!normalizedPartNumber && sampleErrors.length < 12) {
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
    private static async buildBulkPartsWorkbookResult(sqldb: SqlDb, fileName: string, fileBuffer: Buffer, execute: boolean): Promise<BulkPartsWorkbookResult> {
        const extension = String(fileName || '').split('.').pop()?.toLowerCase()
        if (extension !== 'xlsx' && extension !== 'xls') {
            throw new Error('All Parts import expects an Excel workbook with one vendor per worksheet.')
        }

        const workbook = XLSX.read(fileBuffer, { cellDates: false, raw: true })
        const vendors = await sqldb.getVendors()
        const vendorBySheetName = new Map(vendors.map((vendor) => [FirewireData.normalizeWorkbookVendorName(vendor.name), vendor] as const))
        const results: BulkPartsWorkbookVendorResult[] = []

        for (const sheetName of workbook.SheetNames) {
            const sheetRows = FirewireData.parsePartsImportWorksheet(workbook.Sheets[sheetName])
            if (sheetRows.length <= 0) {
                continue
            }

            const vendor = vendorBySheetName.get(FirewireData.normalizeWorkbookVendorName(sheetName))
            if (!vendor) {
                results.push({
                    sheetName,
                    matched: false,
                    valid: true,
                    rowCount: Math.max(sheetRows.length - 1, 0),
                    issues: [`No vendor named "${sheetName}" exists. Sheet skipped.`],
                    sampleErrors: []
                })
                continue
            }

            const normalized = await FirewireData.buildNormalizedImportResultFromRows(sqldb, vendor, `${fileName}:${sheetName}`, sheetRows)
            const vendorResult: BulkPartsWorkbookVendorResult = {
                sheetName,
                vendorId: vendor.vendorId,
                vendorName: vendor.name,
                matched: true,
                valid: normalized.preview.valid,
                rowCount: normalized.preview.rowCount,
                issues: normalized.preview.issues,
                sampleErrors: normalized.preview.sampleErrors
            }

            if (execute && normalized.preview.valid) {
                const existingRows = await sqldb.getRawPartsByVendor(vendor.vendorId)
                const snapshotId = await sqldb.createVendorImportSnapshot({
                    vendorId: vendor.vendorId,
                    targetTable: normalized.config.targetTable,
                    fileName: `${fileName}:${sheetName}`,
                    rowCount: existingRows.length,
                    summaryJson: JSON.stringify({
                        action: 'pre-workbook-import-backup',
                        fileName,
                        sheetName,
                        importedRowCount: normalized.preview.rowCount,
                        createdAt: new Date().toISOString()
                    }),
                    rowsJson: JSON.stringify(existingRows),
                    createdBy: 'system'
                })
                await sqldb.replacePartsForVendor(vendor.vendorId, normalized.normalizedRows)
                const runId = await sqldb.createVendorImportRun({
                    vendorId: vendor.vendorId,
                    targetTable: normalized.config.targetTable,
                    fileName: `${fileName}:${sheetName}`,
                    snapshotId,
                    action: 'import',
                    rowCount: normalized.normalizedRows.length,
                    createdBy: 'system',
                    notesJson: JSON.stringify({
                        workbookFileName: fileName,
                        sheetName,
                        preview: normalized.preview
                    })
                })
                vendorResult.snapshotId = snapshotId
                vendorResult.runId = runId
                vendorResult.importedRowCount = normalized.normalizedRows.length
            }

            results.push(vendorResult)
        }

        const matchedResults = results.filter((row) => row.matched)
        const invalidMatchedResults = matchedResults.filter((row) => !row.valid)
        return {
            fileName,
            sheetCount: workbook.SheetNames.length,
            matchedVendorCount: matchedResults.length,
            skippedSheetCount: results.filter((row) => !row.matched).length,
            importedVendorCount: execute ? results.filter((row) => row.matched && row.valid && typeof row.importedRowCount === 'number').length : 0,
            importedRowCount: execute ? results.reduce((sum, row) => sum + Number(row.importedRowCount || 0), 0) : 0,
            valid: matchedResults.length > 0 && invalidMatchedResults.length <= 0,
            results
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
    private static normalizeHeaderName(value: string): string {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    }
    private static normalizeWorkbookVendorName(value: string): string {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase()
    }
    private static parsePartsImportRows(fileName: string, fileBuffer: Buffer): string[][] {
        const extension = String(fileName || '').split('.').pop()?.toLowerCase()
        if (extension === 'xlsx' || extension === 'xls') {
            const workbook = XLSX.read(fileBuffer, { cellDates: false, raw: true })
            const firstSheetName = workbook.SheetNames[0]
            if (!firstSheetName) {
                return []
            }
            return FirewireData.parsePartsImportWorksheet(workbook.Sheets[firstSheetName])
        }
        return parseCsv(fileBuffer.toString('utf-8'), {
            bom: true,
            skip_empty_lines: true
        }) as string[][]
    }
    private static parsePartsImportWorksheet(sheet: XLSX.WorkSheet): string[][] {
        const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
            header: 1,
            defval: '',
            raw: true
        })
        return rows
            .map((row) => Array.isArray(row) ? row.map((value) => String(value ?? '').trim()) : [])
            .filter((row) => row.some((value) => !!String(value || '').trim()))
    }
    private static isPartNumberColumn(targetColumn: keyof Part): boolean {
        return String(targetColumn || '').trim().toLowerCase() === 'partnumber'
    }
    private static getNormalizedRowPartNumber(row: Part): string {
        return String(row.partNumber || row.PartNumber || '').trim()
    }
    private static normalizePartNumberImportValue(rawValue: string): string {
        const value = FirewireData.normalizeImportText(String(rawValue || '').trim())
        if (!value) {
            return ''
        }
        const currencyMatch = value.match(/^\$?\s*([0-9]{1,3}(?:,[0-9]{3})+)(?:\.0+)?$/)
        if (currencyMatch) {
            return currencyMatch[1].replace(/,/g, '')
        }
        const plainDecimalMatch = value.match(/^([0-9]+)\.0+$/)
        if (plainDecimalMatch) {
            return plainDecimalMatch[1]
        }
        return value
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
                visibility: FirewireData.parseDeviceSetVisibility(row.visibilityJson),
                ownerUserId: row.ownerUserId || null,
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
            visibility: FirewireData.parseDeviceSetVisibility(deviceSet.visibilityJson),
            ownerUserId: deviceSet.ownerUserId || null,
            devices: linkedDevices
        }
    }

    private static parseDeviceSetVisibility(value: unknown): string[] {
        if (Array.isArray(value)) {
            return FirewireData.normalizeDeviceSetVisibility(value)
        }
        if (typeof value !== 'string' || !value.trim()) {
            return ['all-users']
        }
        try {
            return FirewireData.normalizeDeviceSetVisibility(JSON.parse(value))
        } catch {
            return ['all-users']
        }
    }

    private static normalizeDeviceSetVisibility(value: unknown): string[] {
        const allowed = new Set(['all-users', 'current-user', 'fire-alarm', 'sprinkler', 'security'])
        const source = Array.isArray(value) ? value : []
        const normalized = Array.from(new Set(source
            .map((item) => String(item || '').trim().toLowerCase())
            .filter((item) => allowed.has(item))))
        return normalized.length > 0 ? normalized : ['all-users']
    }

    private static resolveUserId(req: express.Request): string {
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

        return 'device-sets'
    }
    private static async buildDeviceVendorLinkIssues(sqldb: SqlDb): Promise<DeviceVendorLinkIssue[]> {
        const devices = await sqldb.getVwDevices()
        const deviceMaterials = await sqldb.getVwDeviceMaterials()
        const ignores = await sqldb.getDeviceVendorLinkIgnores()
        const vendors = await sqldb.getVendors()
        const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor] as const))
        const materialsByDeviceId = new Map<string, VwPart[] | any[]>()
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
                {
                    partNumber: String(device.partNumber || '').trim(),
                    vendorId: device.vendorId,
                    vendorName: device.vendorName,
                    sourceKind: 'device' as const,
                    sourceLabel: 'Device default part'
                },
                ...((materialsByDeviceId.get(device.deviceId) || []).map((row: any) => ({
                    partNumber: String(row.materialPartNumber || row.partNumber || '').trim(),
                    vendorId: String(row.vendorId || device.vendorId || '').trim(),
                    vendorName: String(row.vendorName || device.vendorName || '').trim(),
                    sourceKind: 'material' as const,
                    sourceLabel: 'Linked device part'
                })))
            ].filter((row) => !!row.partNumber)

            for (const candidate of candidates) {
                const candidateVendor = vendorById.get(candidate.vendorId) || vendor
                const resolvedCandidateConfig = candidateVendor.vendorId === vendor.vendorId
                    ? { config }
                    : await FirewireData.resolveVendorImportConfig(sqldb, candidateVendor)
                if (!resolvedCandidateConfig.config) {
                    continue
                }
                const exists = await FirewireData.checkVendorPartExists(sqldb, candidateVendor, resolvedCandidateConfig.config, candidate.partNumber)
                if (exists) {
                    continue
                }
                const ignored = ignores.find((row) =>
                    row.deviceId === device.deviceId &&
                    row.vendorId === candidateVendor.vendorId &&
                    row.partNumber === candidate.partNumber &&
                    row.sourceKind === candidate.sourceKind
                )
                issues.push({
                    deviceId: device.deviceId,
                    deviceName: device.name,
                    vendorId: candidateVendor.vendorId,
                    vendorName: candidate.vendorName || candidateVendor.name,
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
        if (config.targetTable === 'parts') {
            const rows = await sqldb.getPartByVendorAndPartNumber(vendor.vendorId, partNumber)
            return Array.isArray(rows) && rows.length > 0
        }
        return false
    }
    private static async resolveVendorPartRecord(sqldb: SqlDb, vendor: Vendor, partNumber: string): Promise<VwPart | null> {
        const resolved = await FirewireData.resolveVendorImportConfig(sqldb, vendor)
        const config = resolved.config
        if (!config) {
            return null
        }
        if (config.targetTable === 'parts') {
            const rows = await sqldb.getPartByVendorAndPartNumber(vendor.vendorId, partNumber)
            return Array.isArray(rows) && rows.length > 0 ? rows[0] as VwPart : null
        }
        return null
    }

    private static async syncDevicePartPrices(sqldb: SqlDb, deviceId: string): Promise<{
        deviceId: string
        deviceName: string
        previousCost: number
        refreshedCost: number
        updated: boolean
        missingPartNumbers: string[]
    } | null> {
        const device = await sqldb.getDevice(deviceId)
        if (!device) {
            return null
        }

        const linkedDeviceParts = await sqldb.getDeviceMaterialByDeviceId(deviceId) || []
        const partRows = linkedDeviceParts.length > 0
            ? linkedDeviceParts.map((row: any) => ({
                partNumber: String(row.materialPartNumber || row.partNumber || '').trim(),
                vendorId: String(row.vendorId || device.vendorId || '').trim(),
                quantityPerDevice: Math.max(1, Math.floor(Number(row.quantityPerDevice || 1))),
                fallbackCost: Number(row.materialCost || row.cost || 0),
                snapshot: row
            }))
            : [{
                partNumber: String(device.partNumber || '').trim(),
                vendorId: String(device.vendorId || '').trim(),
                quantityPerDevice: 1,
                fallbackCost: Number(device.cost || 0),
                snapshot: null
            }]
        const filteredPartRows = partRows.filter((row) => row.partNumber && row.vendorId)
        const missingPartNumbers: string[] = []
        let refreshedCost = Number(device.cost || 0)

        if (filteredPartRows.length > 0) {
            let total = 0
            const refreshedSnapshots: any[] = []
            for (const partRow of filteredPartRows) {
                const parts = await sqldb.getPartByVendorAndPartNumber(partRow.vendorId, partRow.partNumber)
                const part = Array.isArray(parts) && parts.length > 0 ? parts[0] : null
                if (part) {
                    const unitCost = FirewireData.resolvePartCost(part)
                    total += unitCost * partRow.quantityPerDevice
                    refreshedSnapshots.push(FirewireData.createDevicePartSnapshotFromPart(part, partRow.vendorId, partRow.quantityPerDevice))
                    continue
                }

                missingPartNumbers.push(partRow.partNumber)
                total += partRow.fallbackCost * partRow.quantityPerDevice
                if (partRow.snapshot) {
                    refreshedSnapshots.push({
                        partId: partRow.snapshot.partId || null,
                        vendorId: partRow.vendorId,
                        partNumber: partRow.partNumber,
                        description: partRow.snapshot.materialName || partRow.snapshot.description || '',
                        parentCategory: partRow.snapshot.parentCategory || '',
                        category: partRow.snapshot.category || partRow.snapshot.materialCategoryName || '',
                        msrp: Number(partRow.snapshot.materialMsrp || partRow.snapshot.msrp || 0),
                        cost: partRow.fallbackCost,
                        quantityPerDevice: partRow.quantityPerDevice
                    })
                }
            }
            refreshedCost = Number(total.toFixed(2))
            if (linkedDeviceParts.length > 0) {
                await sqldb.replaceDeviceParts(deviceId, refreshedSnapshots, 'system')
            }
        }

        const previousCost = Number(device.cost || 0)
        const updated = Math.abs(previousCost - refreshedCost) >= 0.005
        if (updated) {
            await sqldb.updateDevice({
                deviceId,
                name: device.name,
                shortName: device.shortName,
                vendorId: device.vendorId,
                categoryName: device.categoryName,
                includeOnFloorplan: !!device.includeOnFloorplan,
                partNumber: device.partNumber,
                link: '',
                cost: refreshedCost,
                defaultLabor: Number(device.defaultLabor || 0),
                laborRate: Number(device.laborRate || 56),
                iconId: device.iconId || null,
                iconForegroundColor: device.iconForegroundColor || '#210507',
                slcAddress: device.slcAddress || '',
                serialNumber: device.serialNumber || '',
                strobeAddress: device.strobeAddress || '',
                speakerAddress: device.speakerAddress || ''
            })
        }

        return {
            deviceId,
            deviceName: device.name,
            previousCost,
            refreshedCost,
            updated,
            missingPartNumbers
        }
    }

    private static resolvePartCost(part: VwPart): number {
        return Number(part.cost ?? part.SalesPrice ?? part.msrp ?? part.MSRPPrice ?? 0)
    }

    private static createDevicePartSnapshotFromPart(part: VwPart, vendorId: string, quantityPerDevice: unknown = 1): any {
        const normalizedQuantity = Math.max(1, Math.floor(Number(quantityPerDevice || 1)))
        return {
            partId: String(part.partId || '').trim() || null,
            vendorId,
            partNumber: String(part.partNumber || part.PartNumber || '').trim(),
            description: String(part.description || part.LongDescription || '').trim(),
            parentCategory: String(part.parentCategory || part.ParentCategory || '').trim(),
            category: String(part.category || part.Category || '').trim(),
            msrp: Number(part.msrp ?? part.MSRPPrice ?? 0),
            cost: FirewireData.resolvePartCost(part),
            quantityPerDevice: normalizedQuantity
        }
    }

    private static normalizePartNumber(partNumber: string | null | undefined): string {
        return String(partNumber || '').trim().toLowerCase()
    }

    private static async createDeviceFromVendorPart(
        sqldb: SqlDb,
        vendor: Vendor,
        partNumber: string,
        part: VwPart,
        body: any
    ): Promise<{ device: any, material: any, devicePart: any, createdMaterial: boolean, createdDevicePart: boolean }> {
        const name = String(body?.name || '').trim()
        const shortName = String(body?.shortName || '').trim()
        const categoryName = String(body?.categoryName || part?.Category || '').trim()
        const includeOnFloorplan = typeof body?.includeOnFloorplan === 'undefined' ? !!categoryName : !!body.includeOnFloorplan

        if (!partNumber || !name || !shortName) {
            const error: any = new Error('partNumber, name, and shortName are required.')
            error.status = 400
            throw error
        }

        const existingDevice = await sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber)
        if (existingDevice) {
            const error: any = new Error(`A device already exists for ${partNumber} under vendor ${vendor.name}.`)
            error.status = 409
            error.data = existingDevice
            throw error
        }

        const safeDeviceName = FirewireData.getSafeDeviceName(name, partNumber)
        const safeShortName = FirewireData.limitText(shortName || partNumber, 50) || partNumber
        const defaultLabor = Number(body?.defaultLabor ?? 112)

        await sqldb.createDevice({
            deviceId: '',
            name: safeDeviceName,
            shortName: safeShortName,
            vendorId: vendor.vendorId,
            categoryName,
            includeOnFloorplan,
            partNumber,
            link: '',
            cost: Number(part.SalesPrice || part.MSRPPrice || 0),
            defaultLabor,
            iconId: null,
            iconForegroundColor: '#210507',
            slcAddress: '',
            serialNumber: '',
            strobeAddress: '',
            speakerAddress: ''
        })

        const device = await sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber)
        if (!device) {
            throw new Error('Device was created but could not be reloaded.')
        }

        const snapshot = FirewireData.createDevicePartSnapshotFromPart(part, vendor.vendorId, 1)
        await sqldb.replaceDeviceParts(device.deviceId, [snapshot], 'system')
        const [devicePart] = await sqldb.getDevicePartsByDeviceId(device.deviceId)

        return {
            device,
            material: devicePart || snapshot,
            devicePart: devicePart || snapshot,
            createdMaterial: false,
            createdDevicePart: !!devicePart
        }
    }

    private static async addVendorPartToExistingDevice(
        sqldb: SqlDb,
        vendor: Vendor,
        partNumber: string,
        part: VwPart,
        deviceId: string
    ): Promise<{ device: any, material: any, devicePart: any, createdMaterial: boolean, createdMap: boolean }> {
        if (!partNumber || !deviceId) {
            const error: any = new Error('partNumber and deviceId are required.')
            error.status = 400
            throw error
        }

        const device = await sqldb.getDevice(deviceId)
        if (!device) {
            const error: any = new Error(`Device ${deviceId} not found.`)
            error.status = 404
            throw error
        }

        const existingDeviceParts = await sqldb.getDevicePartsByDeviceId(device.deviceId)
        const existingDevicePart = existingDeviceParts.find((row) =>
            String(row.vendorId || '').toLowerCase() === vendor.vendorId.toLowerCase() &&
            String(row.partNumber || '').trim().toLowerCase() === partNumber.toLowerCase()
        )
        if (existingDevicePart) {
            return {
                device,
                material: existingDevicePart,
                devicePart: existingDevicePart,
                createdMaterial: false,
                createdMap: false
            }
        }

        const devicePart = await sqldb.createDevicePartFromPart(device.deviceId, part, 1, 'system')
        return {
            device,
            material: devicePart,
            devicePart,
            createdMaterial: false,
            createdMap: !!devicePart
        }
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

    private static async deleteDeviceMediaWorkspace(sqldb: SqlDb, deviceId: string): Promise<string[]> {
        const workspace = await FirewireData.loadStoredWorkspace(sqldb, 'device-media', deviceId, { files: [] })
        const files = Array.isArray(workspace.payload?.files) ? workspace.payload.files : []
        const deletedBlobs: string[] = []
        if (files.length > 0) {
            const storage = new AzureBlobDocumentStorage()
            for (const file of files) {
                if (!file?.blobName) {
                    continue
                }
                const deleted = await storage.deleteIfExists(file.blobContainerName || deviceId, file.blobName)
                if (deleted) {
                    deletedBlobs.push(file.blobName)
                }
            }
        }
        await sqldb.deleteWorkspaceStorage('device-media', deviceId)
        return deletedBlobs
    }

    private static resolveUploadField(value: unknown): string {
        if (Array.isArray(value)) {
            return String(value[0] || '').trim()
        }
        return String(value || '').trim()
    }

    private static createClientSafeId(prefix: string): string {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
    }

    private static sanitizeBlobPathSegment(value: string): string {
        const cleaned = String(value || '')
            .trim()
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean)
            .join('-')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-')
        return cleaned || 'unnamed'
    }

    private static escapeHeaderFileName(value: string): string {
        return String(value || 'document').replace(/["\r\n]/g, '_')
    }
}
