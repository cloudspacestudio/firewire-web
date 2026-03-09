export interface SharePointUploadParams {
    driveId: string
    siteId: string
    buffer: Buffer
    originalName: string
    contentType?: string
    folderPath?: string
    fileName?: string
    metadata?: Record<string, string | number | boolean>
}

export interface SharePointUploadResult {
    id: string
    name: string
    webUrl: string
    size: number
    eTag: string
    metadataApplied: boolean
}

interface AccessTokenResponse {
    access_token: string
}

interface DriveItemResponse {
    id: string
    name: string
    webUrl: string
    size: number
    eTag: string
}

export class SharePointClient {
    private readonly tenantId: string
    private readonly clientId: string
    private readonly clientSecret: string
    private readonly graphBaseUrl = 'https://graph.microsoft.com/v1.0'
    private readonly graphScope = 'https://graph.microsoft.com/.default'
    private readonly maxSimpleUploadBytes = 250 * 1024 * 1024

    constructor() {
        this.tenantId = process.env.SHAREPOINT_TENANT_ID || ''
        this.clientId = process.env.SHAREPOINT_CLIENT_ID || ''
        this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET || ''
    }

    hasRequiredAppConfig(): boolean {
        return !!(this.tenantId && this.clientId && this.clientSecret)
    }

    async uploadToLibrary(params: SharePointUploadParams): Promise<SharePointUploadResult> {
        if (!this.hasRequiredAppConfig()) {
            throw new Error('Missing SharePoint app configuration. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET.')
        }
        if (!params.buffer || params.buffer.length <= 0) {
            throw new Error('Invalid upload payload: file content is empty.')
        }
        if (params.buffer.length > this.maxSimpleUploadBytes) {
            throw new Error(`File exceeds ${this.maxSimpleUploadBytes} bytes. Use an upload session for large files.`)
        }

        const token = await this.getAccessToken()
        const safeFileName = (params.fileName || params.originalName || '').trim()
        if (!safeFileName) {
            throw new Error('Unable to determine a target filename.')
        }

        const targetPath = this.buildGraphPath(params.folderPath, safeFileName)
        const uploadUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(params.siteId)}/drives/${encodeURIComponent(params.driveId)}/root:${targetPath}:/content`

        const uploadRes = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': params.contentType || 'application/octet-stream'
            },
            body: params.buffer
        })

        if (uploadRes.status >= 300) {
            const errBody = await uploadRes.text()
            throw new Error(`SharePoint upload failed (${uploadRes.status}): ${errBody}`)
        }

        const item = await uploadRes.json() as DriveItemResponse
        let metadataApplied = false
        const metadata = params.metadata || {}
        if (Object.keys(metadata).length > 0) {
            await this.patchMetadata(token, params.siteId, params.driveId, item.id, metadata)
            metadataApplied = true
        }

        return {
            id: item.id,
            name: item.name,
            webUrl: item.webUrl,
            size: item.size,
            eTag: item.eTag,
            metadataApplied
        }
    }

    private async getAccessToken(): Promise<string> {
        const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`
        const body = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            scope: this.graphScope,
            grant_type: 'client_credentials'
        })

        const tokenRes = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        })

        if (tokenRes.status >= 300) {
            const errBody = await tokenRes.text()
            throw new Error(`Unable to acquire Microsoft Graph token (${tokenRes.status}): ${errBody}`)
        }
        const tokenJson = await tokenRes.json() as AccessTokenResponse
        if (!tokenJson.access_token) {
            throw new Error('Microsoft Graph token response did not include access_token.')
        }
        return tokenJson.access_token
    }

    private async patchMetadata(token: string, siteId: string, driveId: string, itemId: string, metadata: Record<string, string | number | boolean>) {
        const fieldsUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/listItem/fields`
        const metadataRes = await fetch(fieldsUrl, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(metadata)
        })
        if (metadataRes.status >= 300) {
            const errBody = await metadataRes.text()
            throw new Error(`SharePoint metadata update failed (${metadataRes.status}): ${errBody}`)
        }
    }

    private buildGraphPath(folderPath: string | undefined, fileName: string): string {
        const folder = (folderPath || '')
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => !!segment)
            .map(segment => encodeURIComponent(segment))
            .join('/')

        const encodedFileName = encodeURIComponent(fileName)
        if (!folder) {
            return `/${encodedFileName}`
        }
        return `/${folder}/${encodedFileName}`
    }
}
