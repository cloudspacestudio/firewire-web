"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SharePointClient = void 0;
class SharePointClient {
    constructor() {
        this.graphBaseUrl = 'https://graph.microsoft.com/v1.0';
        this.graphScope = 'https://graph.microsoft.com/.default';
        this.maxSimpleUploadBytes = 250 * 1024 * 1024;
        this.tenantId = process.env.SHAREPOINT_TENANT_ID || '';
        this.clientId = process.env.SHAREPOINT_CLIENT_ID || '';
        this.clientSecret = process.env.SHAREPOINT_CLIENT_SECRET || '';
    }
    hasRequiredAppConfig() {
        return !!(this.tenantId && this.clientId && this.clientSecret);
    }
    uploadToLibrary(params) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasRequiredAppConfig()) {
                throw new Error('Missing SharePoint app configuration. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET.');
            }
            if (!params.buffer || params.buffer.length <= 0) {
                throw new Error('Invalid upload payload: file content is empty.');
            }
            if (params.buffer.length > this.maxSimpleUploadBytes) {
                throw new Error(`File exceeds ${this.maxSimpleUploadBytes} bytes. Use an upload session for large files.`);
            }
            const token = yield this.getAccessToken();
            const safeFileName = (params.fileName || params.originalName || '').trim();
            if (!safeFileName) {
                throw new Error('Unable to determine a target filename.');
            }
            yield this.ensureFolderPathExists(token, params.siteId, params.driveId, params.folderPath);
            const targetPath = this.buildGraphPath(params.folderPath, safeFileName);
            const uploadUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(params.siteId)}/drives/${encodeURIComponent(params.driveId)}/root:${targetPath}:/content`;
            const uploadRes = yield fetch(uploadUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': params.contentType || 'application/octet-stream'
                },
                body: params.buffer
            });
            if (uploadRes.status >= 300) {
                const errBody = yield uploadRes.text();
                throw new Error(`SharePoint upload failed (${uploadRes.status}): ${errBody}`);
            }
            const item = yield uploadRes.json();
            let metadataApplied = false;
            const metadata = params.metadata || {};
            if (Object.keys(metadata).length > 0) {
                yield this.patchMetadata(token, params.siteId, params.driveId, item.id, metadata);
                metadataApplied = true;
            }
            return {
                id: item.id,
                name: item.name,
                webUrl: item.webUrl,
                size: item.size,
                eTag: item.eTag,
                metadataApplied
            };
        });
    }
    resolveTargetFromLibraryUrl(libraryUrl) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.hasRequiredAppConfig()) {
                throw new Error('Missing SharePoint app configuration. Set SHAREPOINT_TENANT_ID, SHAREPOINT_CLIENT_ID, and SHAREPOINT_CLIENT_SECRET.');
            }
            const parsed = this.parseLibraryUrl(libraryUrl);
            const token = yield this.getAccessToken();
            const siteLookupUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(parsed.hostname)}:${parsed.sitePath}?$select=id`;
            const siteRes = yield fetch(siteLookupUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                }
            });
            if (siteRes.status >= 300) {
                const errBody = yield siteRes.text();
                throw new Error(`Unable to resolve SharePoint site from URL (${siteRes.status}): ${errBody}`);
            }
            const siteJson = yield siteRes.json();
            if (!siteJson.id) {
                throw new Error('Unable to resolve SharePoint site id from library URL.');
            }
            const drivesUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteJson.id)}/drives?$select=id,name,webUrl`;
            const drivesRes = yield fetch(drivesUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                }
            });
            if (drivesRes.status >= 300) {
                const errBody = yield drivesRes.text();
                throw new Error(`Unable to list SharePoint drives for resolved site (${drivesRes.status}): ${errBody}`);
            }
            const drivesJson = yield drivesRes.json();
            const drives = drivesJson.value || [];
            if (drives.length <= 0) {
                throw new Error('No SharePoint drives were found for resolved site.');
            }
            const targetLibraryPath = this.normalizePath(parsed.libraryPath);
            const targetLibraryName = this.lastSegment(targetLibraryPath);
            let matchedDrive = drives.find(d => {
                const driveWebPath = d.webUrl ? this.normalizePath(new URL(d.webUrl).pathname) : '';
                return !!targetLibraryPath && driveWebPath.endsWith(targetLibraryPath);
            });
            if (!matchedDrive) {
                matchedDrive = drives.find(d => {
                    const name = this.normalizeName(d.name);
                    return !!targetLibraryName && name === this.normalizeName(targetLibraryName);
                });
            }
            if (!matchedDrive) {
                matchedDrive = drives.find(d => this.normalizeName(d.name) === 'shared documents')
                    || drives.find(d => this.normalizeName(d.name) === 'documents')
                    || drives[0];
            }
            return {
                siteId: siteJson.id,
                driveId: matchedDrive.id
            };
        });
    }
    getAccessToken() {
        return __awaiter(this, void 0, void 0, function* () {
            const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(this.tenantId)}/oauth2/v2.0/token`;
            const body = new URLSearchParams({
                client_id: this.clientId,
                client_secret: this.clientSecret,
                scope: this.graphScope,
                grant_type: 'client_credentials'
            });
            const tokenRes = yield fetch(tokenUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: body.toString()
            });
            if (tokenRes.status >= 300) {
                const errBody = yield tokenRes.text();
                throw new Error(`Unable to acquire Microsoft Graph token (${tokenRes.status}): ${errBody}`);
            }
            const tokenJson = yield tokenRes.json();
            if (!tokenJson.access_token) {
                throw new Error('Microsoft Graph token response did not include access_token.');
            }
            return tokenJson.access_token;
        });
    }
    patchMetadata(token, siteId, driveId, itemId, metadata) {
        return __awaiter(this, void 0, void 0, function* () {
            const fieldsUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodeURIComponent(itemId)}/listItem/fields`;
            const metadataRes = yield fetch(fieldsUrl, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(metadata)
            });
            if (metadataRes.status >= 300) {
                const errBody = yield metadataRes.text();
                throw new Error(`SharePoint metadata update failed (${metadataRes.status}): ${errBody}`);
            }
        });
    }
    ensureFolderPathExists(token, siteId, driveId, folderPath) {
        return __awaiter(this, void 0, void 0, function* () {
            const segments = (folderPath || '')
                .split('/')
                .map(segment => segment.trim())
                .filter(segment => !!segment);
            if (segments.length <= 0) {
                return;
            }
            let parentItemId = 'root';
            for (const segment of segments) {
                parentItemId = yield this.getOrCreateChildFolder(token, siteId, driveId, parentItemId, segment);
            }
        });
    }
    getOrCreateChildFolder(token, siteId, driveId, parentItemId, folderName) {
        return __awaiter(this, void 0, void 0, function* () {
            const encodedParent = encodeURIComponent(parentItemId);
            const childrenUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodedParent}/children?$select=id,name,folder`;
            const childrenRes = yield fetch(childrenUrl, {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                }
            });
            if (childrenRes.status >= 300) {
                const errBody = yield childrenRes.text();
                throw new Error(`Unable to list SharePoint folder children (${childrenRes.status}): ${errBody}`);
            }
            const childrenJson = yield childrenRes.json();
            const existing = (childrenJson.value || []).find(item => item.folder && item.name === folderName);
            if (existing && existing.id) {
                return existing.id;
            }
            const createUrl = `${this.graphBaseUrl}/sites/${encodeURIComponent(siteId)}/drives/${encodeURIComponent(driveId)}/items/${encodedParent}/children`;
            const createRes = yield fetch(createUrl, {
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
            });
            // Another request may have created it first.
            if (createRes.status === 409) {
                const refreshRes = yield fetch(childrenUrl, {
                    method: 'GET',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        Accept: 'application/json'
                    }
                });
                if (refreshRes.status >= 300) {
                    const errBody = yield refreshRes.text();
                    throw new Error(`Unable to refresh SharePoint folder children (${refreshRes.status}): ${errBody}`);
                }
                const refreshJson = yield refreshRes.json();
                const concurrent = (refreshJson.value || []).find(item => item.folder && item.name === folderName);
                if (concurrent && concurrent.id) {
                    return concurrent.id;
                }
            }
            if (createRes.status >= 300) {
                const errBody = yield createRes.text();
                throw new Error(`Unable to create SharePoint folder (${createRes.status}): ${errBody}`);
            }
            const created = yield createRes.json();
            if (!created.id) {
                throw new Error('SharePoint folder create response did not include id.');
            }
            return created.id;
        });
    }
    buildGraphPath(folderPath, fileName) {
        const folder = (folderPath || '')
            .split('/')
            .map(segment => segment.trim())
            .filter(segment => !!segment)
            .map(segment => encodeURIComponent(segment))
            .join('/');
        const encodedFileName = encodeURIComponent(fileName);
        if (!folder) {
            return `/${encodedFileName}`;
        }
        return `/${folder}/${encodedFileName}`;
    }
    parseLibraryUrl(rawUrl) {
        let parsedUrl;
        try {
            parsedUrl = new URL(rawUrl);
        }
        catch (_a) {
            throw new Error('Invalid SharePoint library URL.');
        }
        const pathname = decodeURIComponent(parsedUrl.pathname || '');
        const pathSegments = pathname.split('/').filter(segment => !!segment);
        if (pathSegments.length < 2) {
            throw new Error('SharePoint library URL is missing site path segments.');
        }
        // /sites/Firewire/...
        const sitePath = `/${pathSegments[0]}/${pathSegments[1]}`;
        let libraryPath = '';
        if (pathSegments.length > 2) {
            // Typical library URL includes library segment before Forms/AllItems.aspx
            const formsIndex = pathSegments.findIndex(segment => segment.toLowerCase() === 'forms');
            const librarySegments = formsIndex > 2 ? pathSegments.slice(2, formsIndex) : pathSegments.slice(2);
            libraryPath = librarySegments.length > 0 ? `/${librarySegments.join('/')}` : '';
        }
        // If library path cannot be derived from pathname, try query param "id"
        if (!libraryPath) {
            const idParam = parsedUrl.searchParams.get('id');
            if (idParam) {
                const idPath = decodeURIComponent(idParam);
                const idx = idPath.toLowerCase().indexOf(sitePath.toLowerCase());
                if (idx >= 0) {
                    const afterSite = idPath.slice(idx + sitePath.length);
                    libraryPath = afterSite || '';
                }
            }
        }
        return {
            hostname: parsedUrl.hostname,
            sitePath,
            libraryPath
        };
    }
    normalizePath(path) {
        return (path || '')
            .replace(/\\/g, '/')
            .replace(/\/{2,}/g, '/')
            .trim()
            .replace(/\/$/, '')
            .toLowerCase();
    }
    normalizeName(name) {
        return (name || '').trim().toLowerCase();
    }
    lastSegment(path) {
        const segments = (path || '').split('/').filter(segment => !!segment);
        return segments.length > 0 ? segments[segments.length - 1] : '';
    }
}
exports.SharePointClient = SharePointClient;
