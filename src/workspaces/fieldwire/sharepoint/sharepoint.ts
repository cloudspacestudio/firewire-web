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
        FieldwireSharePoint.uploadDocument()
    ]

    static uploadDocument() {
        return {
            method: 'post',
            path: '/api/fieldwire/sharepoint/upload',
            fx: async (req: express.Request, res: express.Response) => {
                try {
                    const file = await this.getUpload(req, res)
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        })
                    }

                    const client = new SharePointClient()
                    const siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID)
                    const driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID)
                    if (!siteId || !driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide siteId and driveId in form fields or set SHAREPOINT_SITE_ID and SHAREPOINT_DRIVE_ID.'
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
        if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim()
        }
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
            return fallback.trim()
        }
        return undefined
    }
}
