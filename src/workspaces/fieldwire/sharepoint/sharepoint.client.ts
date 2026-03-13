export interface SharePointUploadParams {
    driveId: string
    siteId?: string
    buffer: Buffer
    originalName: string
    contentType?: string
    folderPath?: string
    fileName?: string
    metadata?: Record<string, string | number | boolean>
}

export interface SharePointListParams {
    driveId: string
    siteId?: string
    folderPath?: string
}

export interface SharePointCreateFolderParams {
    driveId: string
    siteId?: string
    folderPath: string
}

export interface SharePointFileContentParams {
    driveId: string
    siteId?: string
    itemPath: string
}

export interface SharePointUploadResult {
    id: string
    name: string
    webUrl: string
    size: number
    eTag: string
    metadataApplied: boolean
}

export interface SharePointFolderItem {
    id: string
    name: string
    webUrl?: string
}

export interface SharePointFileItem {
    id: string
    name: string
    webUrl?: string
    size?: number
    lastModifiedDateTime?: string
}

export interface SharePointListResult {
    siteId?: string
    driveId: string
    folderPath: string
    folders: SharePointFolderItem[]
    files: SharePointFileItem[]
}

export interface SharePointFileContentResult {
    fileName: string
    contentType: string
    buffer: Buffer
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

interface SharePointSiteResponse {
    id: string
}

interface SharePointDrivesResponse {
    value?: Array<{
        id: string
        name: string
        webUrl?: string
    }>
}

export class SharePointClient {
    private readonly tenantId: string
    private readonly clientId: string
    private readonly clientSecret: string
    private readonly userAssertionToken: string
    private readonly graphBaseUrl = 'https://graph.microsoft.com/v1.0'
    private readonly graphScope = 'https://graph.microsoft.com/.default'
    private readonly maxSimpleUploadBytes = 250 * 1024 * 1024

    constructor(userAssertionToken: string) {
        this.tenantId = process.env.SHAREPOINT_TENANT_ID || ''
        this.clientId = process.env.SHAREPOINT_CLIENT_ID || ''
        this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET || ''
        this.userAssertionToken = userAssertionToken || ''
    }

    hasRequiredAppConfig(): boolean {
        return !!(this.tenantId && this.clientId && this.clientSecret)
    }

    hasRequiredUserContext(): boolean {
        return !!this.userAssertionToken
    }

    async uploadToLibrary(params: SharePointUploadParams): Promise<SharePointUploadResult> {
        this.ensureClientCanCallGraph()
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

        await this.ensureFolderPathExists(token, params.siteId, params.driveId, params.folderPath)

        const targetPath = this.buildGraphPath(params.folderPath, safeFileName)
        const uploadUrl = this.buildDriveRootContentUrl(params.driveId, targetPath, params.siteId)

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

    async listLibraryItems(params: SharePointListParams): Promise<SharePointListResult> {
        this.ensureClientCanCallGraph()
        const token = await this.getAccessToken()
        const folderPath = this.normalizeFolderPath(params.folderPath)
        const listUrl = folderPath
            ? `${this.buildDriveRootBaseUrl(params.driveId, params.siteId)}:${this.buildGraphPath(folderPath, '')}:/children?$select=id,name,webUrl,size,lastModifiedDateTime,folder,file`
            : `${this.buildDriveRootBaseUrl(params.driveId, params.siteId)}/children?$select=id,name,webUrl,size,lastModifiedDateTime,folder,file`

        const listRes = await fetch(listUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        })
        if (listRes.status >= 300) {
            const errBody = await listRes.text()
            throw new Error(`Unable to list SharePoint library items (${listRes.status}): ${errBody}`)
        }

        const listJson = await listRes.json() as { value?: Array<{ id: string; name: string; webUrl?: string; size?: number; lastModifiedDateTime?: string; folder?: unknown; file?: unknown }> }
        const items = listJson.value || []
        return {
            siteId: params.siteId,
            driveId: params.driveId,
            folderPath: folderPath || '/',
            folders: items.filter(item => !!item.folder).map(item => ({
                id: item.id,
                name: item.name,
                webUrl: item.webUrl
            })),
            files: items.filter(item => !!item.file).map(item => ({
                id: item.id,
                name: item.name,
                webUrl: item.webUrl,
                size: item.size,
                lastModifiedDateTime: item.lastModifiedDateTime
            }))
        }
    }

    async createFolderIfMissing(params: SharePointCreateFolderParams): Promise<{ siteId?: string; driveId: string; folderPath: string }> {
        this.ensureClientCanCallGraph()
        const token = await this.getAccessToken()
        const folderPath = this.normalizeFolderPath(params.folderPath)
        if (!folderPath) {
            throw new Error('Folder path is required.')
        }
        await this.ensureFolderPathExists(token, params.siteId, params.driveId, folderPath)
        return {
            siteId: params.siteId,
            driveId: params.driveId,
            folderPath
        }
    }

    async readFileContent(params: SharePointFileContentParams): Promise<SharePointFileContentResult> {
        this.ensureClientCanCallGraph()
        const token = await this.getAccessToken()
        const normalizedPath = this.normalizeFolderPath(params.itemPath)
        if (!normalizedPath) {
            throw new Error('Item path is required.')
        }

        const metadataUrl = `${this.buildDriveRootBaseUrl(params.driveId, params.siteId)}:${this.buildGraphPath(normalizedPath, '')}`
        const metadataRes = await fetch(metadataUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        })
        if (metadataRes.status >= 300) {
            const errBody = await metadataRes.text()
            throw new Error(`Unable to read SharePoint file metadata (${metadataRes.status}): ${errBody}`)
        }
        const metadata = await metadataRes.json() as { name?: string }

        const contentUrl = `${metadataUrl}:/content`
        const contentRes = await fetch(contentUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: '*/*'
            }
        })
        if (contentRes.status >= 300) {
            const errBody = await contentRes.text()
            throw new Error(`Unable to read SharePoint file content (${contentRes.status}): ${errBody}`)
        }

        const contentType = contentRes.headers.get('content-type') || 'application/octet-stream'
        const arrayBuffer = await contentRes.arrayBuffer()
        return {
            fileName: metadata.name || this.lastSegment(normalizedPath),
            contentType,
            buffer: Buffer.from(arrayBuffer)
        }
    }

    async resolveTargetFromLibraryUrl(libraryUrl: string): Promise<{ siteId: string; driveId: string }> {
        this.ensureClientCanCallGraph()

        const parsed = this.parseLibraryUrl(libraryUrl)
        const token = await this.getAccessToken()

        const siteLookupUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(parsed.hostname)}:${parsed.sitePath}?$select=id`
        const siteRes = await fetch(siteLookupUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        })
        if (siteRes.status >= 300) {
            const errBody = await siteRes.text()
            throw new Error(`Unable to resolve SharePoint site from URL (${siteRes.status}): ${errBody}`)
        }

        const siteJson = await siteRes.json() as SharePointSiteResponse
        if (!siteJson.id) {
            throw new Error('Unable to resolve SharePoint site id from library URL.')
        }

        const drivesUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteJson.id)}/drives?$select=id,name,webUrl`
        const drivesRes = await fetch(drivesUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        })
        if (drivesRes.status >= 300) {
            const errBody = await drivesRes.text()
            throw new Error(`Unable to list SharePoint drives for resolved site (${drivesRes.status}): ${errBody}`)
        }

        const drivesJson = await drivesRes.json() as SharePointDrivesResponse
        const drives = drivesJson.value || []
        if (drives.length <= 0) {
            throw new Error('No SharePoint drives were found for resolved site.')
        }

        const targetLibraryPath = this.normalizePath(parsed.libraryPath)
        const targetLibraryName = this.lastSegment(targetLibraryPath)

        let matchedDrive = drives.find(d => {
            const driveWebPath = d.webUrl ? this.normalizePath(new URL(d.webUrl).pathname) : ''
            return !!targetLibraryPath && driveWebPath.endsWith(targetLibraryPath)
        })

        if (!matchedDrive) {
            matchedDrive = drives.find(d => {
                const name = this.normalizeName(d.name)
                return !!targetLibraryName && name === this.normalizeName(targetLibraryName)
            })
        }

        if (!matchedDrive) {
            matchedDrive = drives.find(d => this.normalizeName(d.name) === 'shared documents')
                || drives.find(d => this.normalizeName(d.name) === 'documents')
                || drives[0]
        }

        return {
            siteId: siteJson.id,
            driveId: matchedDrive.id
        }
    }

    private async getAccessToken(): Promise<string> {
        this.ensureClientCanCallGraph()
        const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`
        const body = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            scope: this.graphScope,
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            requested_token_use: 'on_behalf_of',
            assertion: this.userAssertionToken
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

    private ensureClientCanCallGraph(): void {
        if (!this.hasRequiredAppConfig()) {
            throw new Error('Missing SharePoint app configuration. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET.')
        }
        if (!this.hasRequiredUserContext()) {
            throw new Error('Missing user bearer token required for SharePoint on-behalf-of access.')
        }
    }

    private async patchMetadata(token: string, siteId: string | undefined, driveId: string, itemId: string, metadata: Record<string, string | number | boolean>) {
        const fieldsUrl = `${this.buildDriveItemBaseUrl(driveId, itemId, siteId)}/listItem/fields`
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

    private async ensureFolderPathExists(token: string, siteId: string | undefined, driveId: string, folderPath?: string): Promise<void> {
        const segments = (folderPath || '')
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => !!segment)
        if (segments.length <= 0) {
            return
        }

        let parentItemId = 'root'
        for (const segment of segments) {
            parentItemId = await this.getOrCreateChildFolder(token, siteId, driveId, parentItemId, segment)
        }
    }

    private async getOrCreateChildFolder(token: string, siteId: string | undefined, driveId: string, parentItemId: string, folderName: string): Promise<string> {
        const encodedParent = encodeURIComponent(parentItemId)
        const childrenUrl = `${this.buildDriveItemBaseUrl(driveId, parentItemId, siteId)}/children?$select=id,name,folder`
        const childrenRes = await fetch(childrenUrl, {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${token}`,
                Accept: 'application/json'
            }
        })
        if (childrenRes.status >= 300) {
            const errBody = await childrenRes.text()
            throw new Error(`Unable to list SharePoint folder children (${childrenRes.status}): ${errBody}`)
        }

        const childrenJson = await childrenRes.json() as { value?: Array<{ id: string; name: string; folder?: unknown }> }
        const existing = (childrenJson.value || []).find(item => item.folder && item.name === folderName)
        if (existing && existing.id) {
            return existing.id
        }

        const createUrl = `${this.buildDriveItemBaseUrl(driveId, parentItemId, siteId)}/children`
        const createRes = await fetch(createUrl, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: folderName,
                folder: {},
                '@microsoft.graph.conflictBehavior': 'fail'
            })
        })

        // Another request may have created it first.
        if (createRes.status === 409) {
            const refreshRes = await fetch(childrenUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                }
            })
            if (refreshRes.status >= 300) {
                const errBody = await refreshRes.text()
                throw new Error(`Unable to refresh SharePoint folder children (${refreshRes.status}): ${errBody}`)
            }
            const refreshJson = await refreshRes.json() as { value?: Array<{ id: string; name: string; folder?: unknown }> }
            const concurrent = (refreshJson.value || []).find(item => item.folder && item.name === folderName)
            if (concurrent && concurrent.id) {
                return concurrent.id
            }
        }

        if (createRes.status >= 300) {
            const errBody = await createRes.text()
            throw new Error(`Unable to create SharePoint folder (${createRes.status}): ${errBody}`)
        }

        const created = await createRes.json() as { id?: string }
        if (!created.id) {
            throw new Error('SharePoint folder create response did not include id.')
        }
        return created.id
    }

    private buildGraphPath(folderPath: string | undefined, fileName: string): string {
        const folder = (folderPath || '')
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => !!segment)
            .map(segment => encodeURIComponent(segment))
            .join('/')

        const encodedFileName = encodeURIComponent(fileName)
        if (!encodedFileName) {
            return folder ? `/${folder}` : ''
        }
        if (!folder) {
            return `/${encodedFileName}`
        }
        return `/${folder}/${encodedFileName}`
    }

    private normalizeFolderPath(path: string | undefined): string {
        return (path || '')
            .replace(/\\/g, '/')
            .replace(/^\/+/, '')
            .replace(/\/+$/, '')
            .trim()
    }

    private buildDriveRootBaseUrl(driveId: string, siteId?: string): string {
        if (siteId) {
            return `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/root`
        }
        return `${this.graphBaseUrl}/drives/${encodeURIComponent(driveId)}/root`
    }

    private buildDriveItemBaseUrl(driveId: string, itemId: string, siteId?: string): string {
        if (siteId) {
            return `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`
        }
        return `${this.graphBaseUrl}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}`
    }

    private buildDriveRootContentUrl(driveId: string, targetPath: string, siteId?: string): string {
        if (siteId) {
            return `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/root:${targetPath}:/content`
        }
        return `${this.graphBaseUrl}/drives/${encodeURIComponent(driveId)}/root:${targetPath}:/content`
    }

    private parseLibraryUrl(rawUrl: string): { hostname: string; sitePath: string; libraryPath: string } {
        let parsedUrl: URL
        try {
            parsedUrl = new URL(rawUrl)
        } catch {
            throw new Error('Invalid SharePoint library URL.')
        }

        const pathname = decodeURIComponent(parsedUrl.pathname || '')
        const pathSegments = pathname.split('/').filter(segment => !!segment)
        if (pathSegments.length < 2) {
            throw new Error('SharePoint library URL is missing site path segments.')
        }

        // /sites/Firewire/...
        const sitePath = `/${pathSegments[0]}/${pathSegments[1]}`

        let libraryPath = ''
        if (pathSegments.length > 2) {
            // Typical library URL includes library segment before Forms/AllItems.aspx
            const formsIndex = pathSegments.findIndex(segment => segment.toLowerCase() === 'forms')
            const librarySegments = formsIndex > 2 ? pathSegments.slice(2, formsIndex) : pathSegments.slice(2)
            libraryPath = librarySegments.length > 0 ? `/${librarySegments.join('/')}` : ''
        }

        // If library path cannot be derived from pathname, try query param "id"
        if (!libraryPath) {
            const idParam = parsedUrl.searchParams.get('id')
            if (idParam) {
                const idPath = decodeURIComponent(idParam)
                const idx = idPath.toLowerCase().indexOf(sitePath.toLowerCase())
                if (idx >= 0) {
                    const afterSite = idPath.slice(idx + sitePath.length)
                    libraryPath = afterSite || ''
                }
            }
        }

        return {
            hostname: parsedUrl.hostname,
            sitePath,
            libraryPath
        }
    }

    private normalizePath(path: string): string {
        return (path || '')
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .trim()
            .replace(/\/$/, '')
            .toLowerCase()
    }

    private normalizeName(name: string): string {
        return (name || '').trim().toLowerCase()
    }

    private lastSegment(path: string): string {
        const segments = (path || '').split('/').filter(segment => !!segment)
        return segments.length > 0 ? segments[segments.length - 1] : ''
    }
}
