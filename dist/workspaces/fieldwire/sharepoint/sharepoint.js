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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldwireSharePoint = void 0;
const multer_1 = __importDefault(require("multer"));
const sharepoint_client_1 = require("./sharepoint.client");
const uploadToMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: Number(process.env.SHAREPOINT_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
    }
}).single('file');
class FieldwireSharePoint {
    static uploadDocument() {
        return {
            method: 'post',
            path: '/api/fieldwire/sharepoint/upload',
            fx: (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bearerToken = this.resolveBearerToken(req);
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' });
                    }
                    const file = yield this.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const client = new sharepoint_client_1.SharePointClient(bearerToken);
                    const siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID);
                    const driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID);
                    if (!driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId in form fields or set SHAREPOINT_DRIVE_ID.'
                        });
                    }
                    const folderPath = this.resolveString(req.body.folderPath);
                    const fileName = this.resolveString(req.body.fileName);
                    const metadata = this.parseMetadata(req.body.metadata);
                    const result = yield client.uploadToLibrary({
                        siteId,
                        driveId,
                        folderPath,
                        fileName,
                        metadata,
                        buffer: file.buffer,
                        originalName: file.originalname,
                        contentType: file.mimetype
                    });
                    return res.status(201).json({
                        uploaded: result,
                        target: {
                            siteId,
                            driveId,
                            folderPath: folderPath || '/'
                        }
                    });
                }
                catch (err) {
                    if (err instanceof multer_1.default.MulterError) {
                        const statusCode = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
                        return res.status(statusCode).json({
                            message: err.message,
                            code: err.code
                        });
                    }
                    if (err && typeof err.message === 'string' && err.message.startsWith('metadata must')) {
                        return res.status(400).json({
                            message: err.message
                        });
                    }
                    if (err && typeof err.message === 'string' && err.message.startsWith('File exceeds')) {
                        return res.status(413).json({
                            message: err.message
                        });
                    }
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            })
        };
    }
    static listLibraryItems() {
        return {
            method: 'get',
            path: '/api/fieldwire/sharepoint/library',
            fx: (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bearerToken = this.resolveBearerToken(req);
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' });
                    }
                    const client = new sharepoint_client_1.SharePointClient(bearerToken);
                    let siteId = this.resolveString(req.query.siteId, process.env.SHAREPOINT_SITE_ID);
                    let driveId = this.resolveString(req.query.driveId, process.env.SHAREPOINT_DRIVE_ID);
                    const libraryUrl = this.resolveString(req.query.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL);
                    if (!driveId && libraryUrl) {
                        const resolved = yield client.resolveTargetFromLibraryUrl(libraryUrl);
                        siteId = siteId || resolved.siteId;
                        driveId = driveId || resolved.driveId;
                    }
                    if (!driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId or libraryUrl.'
                        });
                    }
                    const folderPath = this.resolveString(req.query.folderPath);
                    const result = yield client.listLibraryItems({
                        siteId,
                        driveId,
                        folderPath
                    });
                    return res.json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            })
        };
    }
    static createFolder() {
        return {
            method: 'post',
            path: '/api/fieldwire/sharepoint/folders',
            fx: (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bearerToken = this.resolveBearerToken(req);
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' });
                    }
                    const client = new sharepoint_client_1.SharePointClient(bearerToken);
                    let siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID);
                    let driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID);
                    const libraryUrl = this.resolveString(req.body.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL);
                    if (!driveId && libraryUrl) {
                        const resolved = yield client.resolveTargetFromLibraryUrl(libraryUrl);
                        siteId = siteId || resolved.siteId;
                        driveId = driveId || resolved.driveId;
                    }
                    const folderPath = this.resolveString(req.body.folderPath);
                    if (!driveId || !folderPath) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId and folderPath, or provide libraryUrl with folderPath.'
                        });
                    }
                    const result = yield client.createFolderIfMissing({
                        siteId,
                        driveId,
                        folderPath
                    });
                    return res.status(201).json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            })
        };
    }
    static readFile() {
        return {
            method: 'get',
            path: '/api/fieldwire/sharepoint/file',
            fx: (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const bearerToken = this.resolveBearerToken(req);
                    if (!bearerToken) {
                        return res.status(401).json({ message: 'Unauthorized' });
                    }
                    const client = new sharepoint_client_1.SharePointClient(bearerToken);
                    let siteId = this.resolveString(req.query.siteId, process.env.SHAREPOINT_SITE_ID);
                    let driveId = this.resolveString(req.query.driveId, process.env.SHAREPOINT_DRIVE_ID);
                    const libraryUrl = this.resolveString(req.query.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL);
                    if (!driveId && libraryUrl) {
                        const resolved = yield client.resolveTargetFromLibraryUrl(libraryUrl);
                        siteId = siteId || resolved.siteId;
                        driveId = driveId || resolved.driveId;
                    }
                    const itemPath = this.resolveString(req.query.itemPath);
                    if (!driveId || !itemPath) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide driveId and itemPath, or provide libraryUrl with itemPath.'
                        });
                    }
                    const result = yield client.readFileContent({
                        siteId,
                        driveId,
                        itemPath
                    });
                    res.setHeader('Content-Type', result.contentType);
                    res.setHeader('Content-Disposition', `inline; filename="${result.fileName.replace(/"/g, '')}"`);
                    return res.status(200).send(result.buffer);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            })
        };
    }
    static getUpload(req, res) {
        return new Promise((resolve, reject) => {
            uploadToMemory(req, res, (err) => {
                if (err instanceof multer_1.default.MulterError) {
                    return reject(err);
                }
                if (err) {
                    return reject(err);
                }
                return resolve(req.file);
            });
        });
    }
    static parseMetadata(raw) {
        if (typeof raw === 'undefined' || raw === null || raw === '') {
            return undefined;
        }
        if (typeof raw !== 'string') {
            throw new Error('metadata must be a JSON string object.');
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch (err) {
            throw new Error('metadata must be valid JSON.');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
            throw new Error('metadata must be a JSON object.');
        }
        const output = {};
        for (const [key, value] of Object.entries(parsed)) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                output[key] = value;
            }
        }
        return Object.keys(output).length > 0 ? output : undefined;
    }
    static resolveString(raw, fallback) {
        if (Array.isArray(raw) && raw.length > 0) {
            return this.resolveString(raw[0], fallback);
        }
        if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim();
        }
        if (typeof fallback === 'string' && fallback.trim().length > 0) {
            return fallback.trim();
        }
        return undefined;
    }
    static resolveBearerToken(req) {
        return req.bearerToken;
    }
}
exports.FieldwireSharePoint = FieldwireSharePoint;
FieldwireSharePoint.manifestItems = [
    FieldwireSharePoint.uploadDocument(),
    FieldwireSharePoint.listLibraryItems(),
    FieldwireSharePoint.createFolder(),
    FieldwireSharePoint.readFile()
];
