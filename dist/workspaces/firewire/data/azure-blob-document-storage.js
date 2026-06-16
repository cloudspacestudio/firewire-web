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
exports.AzureBlobDocumentStorage = void 0;
const storage_blob_1 = require("@azure/storage-blob");
const node_crypto_1 = require("node:crypto");
class AzureBlobDocumentStorage {
    constructor() {
        this.connectionString = process.env.FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING || '';
    }
    isConfigured() {
        return !!this.connectionString;
    }
    upload(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const container = yield this.getContainer(params.containerName);
            const blockBlob = container.getBlockBlobClient(params.blobName);
            yield blockBlob.uploadData(params.buffer, {
                blobHTTPHeaders: {
                    blobContentType: params.contentType || 'application/octet-stream'
                },
                metadata: params.metadata
            });
        });
    }
    download(containerName, blobName) {
        return __awaiter(this, void 0, void 0, function* () {
            const container = yield this.getContainer(containerName);
            const blockBlob = container.getBlockBlobClient(blobName);
            const response = yield blockBlob.downloadToBuffer();
            const properties = yield blockBlob.getProperties();
            return {
                buffer: response,
                contentType: properties.contentType || 'application/octet-stream'
            };
        });
    }
    deleteIfExists(containerName, blobName) {
        return __awaiter(this, void 0, void 0, function* () {
            const container = yield this.getContainer(containerName);
            const blockBlob = container.getBlockBlobClient(blobName);
            const response = yield blockBlob.deleteIfExists();
            return !!response.succeeded;
        });
    }
    getProjectContainerName(projectKey) {
        const normalized = String(projectKey || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
        if (normalized.length >= 3 && normalized.length <= 63 && /^[a-z0-9]/.test(normalized) && /[a-z0-9]$/.test(normalized)) {
            return normalized;
        }
        const hash = (0, node_crypto_1.createHash)('sha256').update(String(projectKey || 'project-doc-library')).digest('hex').slice(0, 24);
        return `project-${hash}`;
    }
    getContainer(projectKey) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.connectionString) {
                throw new Error('Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.');
            }
            const client = storage_blob_1.BlobServiceClient.fromConnectionString(this.connectionString);
            const container = client.getContainerClient(this.getProjectContainerName(projectKey));
            yield container.createIfNotExists();
            return container;
        });
    }
}
exports.AzureBlobDocumentStorage = AzureBlobDocumentStorage;
