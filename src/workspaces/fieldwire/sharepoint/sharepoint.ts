import * as express from 'express'
import multer from 'multer'
import { SharePointClient } from './sharepoint.client'

const uploadToMemory = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: Number(process.env.SHAREPOINT_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
    }
}).single('file')

export class FieldwireSharePoint {
    static manifestItems = [
        FieldwireSharePoint.uploadDocument(),
        FieldwireSharePoint.listLibraryItems(),
        FieldwireSharePoint.createFolder(),
        FieldwireSharePoint.readFile()
    ]

    static uploadDocument() {
        return {
            method: 'post',
            path: '/api/fieldwire/sharepoint/upload',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const bearerToken = this.resolveBearerToken(req)
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' })
                    }
                    const file = await this.getUpload(req, res)
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        })
                    }

                    const client = new SharePointClient(bearerToken)
                    const siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID)
                    const driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID)
                    if (!driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId in form fields or set SHAREPOINT_DRIVE_ID.'
                        })
                    }

                    const folderPath = this.resolveString(req.body.folderPath)
                    const fileName = this.resolveString(req.body.fileName)
                    const metadata = this.parseMetadata(req.body.metadata)

                    const result = await client.uploadToLibrary({
                        siteId,
                        driveId,
                        folderPath,
                        fileName,
                        metadata,
                        buffer: file.buffer,
                        originalName: file.originalname,
                        contentType: file.mimetype
                    })

                    return res.status(201).json({
                        uploaded: result,
                        target: {
                            siteId,
                            driveId,
                            folderPath: folderPath || '/'
                        }
                    })
                } catch (err: any) {
                    if (err instanceof multer.MulterError) {
                        const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400
                        return res.status(statusCode).json({
                            message: err.message,
                            code: err.code
                        })
                    }
                    if (err && typeof err.message === 'string' && err.message.startsWith('metadata must')) {
                        return res.status(400).json({
                            message: err.message
                        })
                    }
                    if (err && typeof err.message === 'string' && err.message.startsWith('File exceeds')) {
                        return res.status(413).json({
                            message: err.message
                        })
                    }
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        }
    }

    static listLibraryItems() {
        return {
            method: 'get',
            path: '/api/fieldwire/sharepoint/library',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const bearerToken = this.resolveBearerToken(req)
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' })
                    }

                    const client = new SharePointClient(bearerToken)
                    let siteId = this.resolveString(req.query.siteId, process.env.SHAREPOINT_SITE_ID)
                    let driveId = this.resolveString(req.query.driveId, process.env.SHAREPOINT_DRIVE_ID)
                    const libraryUrl = this.resolveString(req.query.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL)
                    if (!driveId && libraryUrl) {
                        const resolved = await client.resolveTargetFromLibraryUrl(libraryUrl)
                        siteId = siteId || resolved.siteId
                        driveId = driveId || resolved.driveId
                    }
                    if (!driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId or libraryUrl.'
                        })
                    }

                    const folderPath = this.resolveString(req.query.folderPath)
                    const result = await client.listLibraryItems({
                        siteId,
                        driveId,
                        folderPath
                    })
                    return res.json(result)
                } catch (err: any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        }
    }

    static createFolder() {
        return {
            method: 'post',
            path: '/api/fieldwire/sharepoint/folders',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const bearerToken = this.resolveBearerToken(req)
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' })
                    }

                    const client = new SharePointClient(bearerToken)
                    let siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID)
                    let driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID)
                    const libraryUrl = this.resolveString(req.body.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL)
                    if (!driveId && libraryUrl) {
                        const resolved = await client.resolveTargetFromLibraryUrl(libraryUrl)
                        siteId = siteId || resolved.siteId
                        driveId = driveId || resolved.driveId
                    }
                    const folderPath = this.resolveString(req.body.folderPath)
                    if (!driveId || !folderPath) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId and folderPath, or provide libraryUrl with folderPath.'
                        })
                    }

                    const result = await client.createFolderIfMissing({
                        siteId,
                        driveId,
                        folderPath
                    })
                    return res.status(201).json(result)
                } catch (err: any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        }
    }

    static readFile() {
        return {
            method: 'get',
            path: '/api/fieldwire/sharepoint/file',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const bearerToken = this.resolveBearerToken(req)
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' })
                    }

                    const client = new SharePointClient(bearerToken)
                    let siteId = this.resolveString(req.query.siteId, process.env.SHAREPOINT_SITE_ID)
                    let driveId = this.resolveString(req.query.driveId, process.env.SHAREPOINT_DRIVE_ID)
                    const libraryUrl = this.resolveString(req.query.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL)
                    if (!driveId && libraryUrl) {
                        const resolved = await client.resolveTargetFromLibraryUrl(libraryUrl)
                        siteId = siteId || resolved.siteId
                        driveId = driveId || resolved.driveId
                    }
                    const itemPath = this.resolveString(req.query.itemPath)
                    if (!driveId || !itemPath) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId and itemPath, or provide libraryUrl with itemPath.'
                        })
                    }

                    const result = await client.readFileContent({
                        siteId,
                        driveId,
                        itemPath
                    })

                    res.setHeader('Content-Type', result.contentType)
                    res.setHeader('Content-Disposition', `inline; filename="${result.fileName.replace(/"/g, '')}"`)
                    return res.status(200).send(result.buffer)
                } catch (err: any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            }
        }
    }

    private static getUpload(req: express.Request, res: express.Response): Promise<Express.Multer.File | undefined> {
        return new Promise((resolve, reject) => {
            uploadToMemory(req, res, (err) => {
                if (err instanceof multer.MulterError) {
                    return reject(err)
                }
                if (err) {
                    return reject(err)
                }
                return resolve(req.file)
            })
        })
    }

    private static parseMetadata(raw: unknown): Record<string, string | number | boolean> | undefined {
        if (typeof raw === 'undefined' || raw === null || raw === '') {
            return undefined
        }
        if (typeof raw !== 'string') {
            throw new Error('metadata must be a JSON string object.')
        }
        let parsed: unknown
        try {
            parsed = JSON.parse(raw)
        } catch (err) {
            throw new Error('metadata must be valid JSON.')
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('metadata must be a JSON object.')
        }

        const output: Record<string, string | number | boolean> = {}
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                output[key] = value
            }
        }
        return Object.keys(output).length > 0 ? output : undefined
    }

    private static resolveString(raw: unknown, fallback?: string): string | undefined {
        if (Array.isArray(raw) && raw.length > 0) {
            return this.resolveString(raw[0], fallback)
        }
        if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim()
        }
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
            return fallback.trim()
        }
        return undefined
    }

    private static resolveBearerToken(req: express.Request): string | undefined {
        return (req as any).bearerToken
    }
}
