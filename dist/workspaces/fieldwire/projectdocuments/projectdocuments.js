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
exports.FieldwireProjectDocuments = void 0;
const multer_1 = __importDefault(require("multer"));
const sharepoint_client_1 = require("../sharepoint/sharepoint.client");
const uploadToMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: Number(process.env.SHAREPOINT_MAX_UPLOAD_BYTES || 25 * 1024 * 1024)
    }
}).single('file');
class FieldwireProjectDocuments {
    static uploadProjectDocument() {
        return {
            method: 'post',
            path: '/api/fieldwire/projects/:projectId/projectdocuments/upload',
            fx: (req, res) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const projectId = this.resolveString(req.params.projectId);
                    if (!projectId) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing projectId route parameter.'
                        });
                    }
                    const file = yield this.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const client = new sharepoint_client_1.SharePointClient();
                    let siteId = this.resolveString(req.body.siteId, process.env.SHAREPOINT_SITE_ID);
                    let driveId = this.resolveString(req.body.driveId, process.env.SHAREPOINT_DRIVE_ID);
                    const libraryUrl = this.resolveString(req.body.libraryUrl, process.env.SHAREPOINT_LIBRARY_URL);
                    if ((!siteId || !driveId) && libraryUrl) {
                        const resolved = yield client.resolveTargetFromLibraryUrl(libraryUrl);
                        siteId = siteId || resolved.siteId;
                        driveId = driveId || resolved.driveId;
                    }
                    if (!siteId || !driveId) {
                        return res.status(400).json({
                            message: 'Missing target values. Provide siteId/driveId or set SHAREPOINT_SITE_ID/SHAREPOINT_DRIVE_ID. You can also provide libraryUrl or set SHAREPOINT_LIBRARY_URL for automatic resolution.'
                        });
                    }
                    // TODO: Replace with actual project-code lookup.
                    const projectCode = this.resolveString(req.body.projectCode, '47-000000') || '47-000000';
                    const folderRoot = this.resolveString(req.body.folderRoot, process.env.SHAREPOINT_PROJECTDOCUMENTS_FOLDER_ROOT);
                    const folderPath = this.resolveString(req.body.folderPath) || (folderRoot ? `${folderRoot}/${projectCode}` : projectCode);
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
                            folderPath
                        },
                        projectId,
                        projectCode
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
    static resolveString(raw, ...fallbacks) {
        if (typeof raw === 'string' && raw.trim().length > 0) {
            return raw.trim();
        }
        for (const fallback of fallbacks) {
            if (typeof fallback === 'string' && fallback.trim().length > 0) {
                return fallback.trim();
            }
        }
        return undefined;
    }
}
exports.FieldwireProjectDocuments = FieldwireProjectDocuments;
FieldwireProjectDocuments.manifestItems = [
    FieldwireProjectDocuments.uploadProjectDocument()
];
