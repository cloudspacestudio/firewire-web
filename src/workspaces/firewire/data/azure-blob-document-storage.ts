import { BlobServiceClient, ContainerClient } from '@azure/storage-blob'
import { createHash } from 'node:crypto'

export interface AzureBlobDocumentUploadParams {
    buffer: Buffer
    containerName: string
    blobName: string
    contentType: string
    metadata?: Record<string, string>
}

export interface AzureBlobDocumentDownloadResult {
    buffer: Buffer
    contentType: string
}

export class AzureBlobDocumentStorage {
    private readonly connectionString = process.env.FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING || ''

    isConfigured(): boolean {
        return !!this.connectionString
    }

    async upload(params: AzureBlobDocumentUploadParams): Promise<void> {
        const container = await this.getContainer(params.containerName)
        const blockBlob = container.getBlockBlobClient(params.blobName)
        await blockBlob.uploadData(params.buffer, {
            blobHTTPHeaders: {
                blobContentType: params.contentType || 'application/octet-stream'
            },
            metadata: params.metadata
        })
    }

    async download(containerName: string, blobName: string): Promise<AzureBlobDocumentDownloadResult> {
        const container = await this.getContainer(containerName)
        const blockBlob = container.getBlockBlobClient(blobName)
        const response = await blockBlob.downloadToBuffer()
        const properties = await blockBlob.getProperties()
        return {
            buffer: response,
            contentType: properties.contentType || 'application/octet-stream'
        }
    }

    async deleteIfExists(containerName: string, blobName: string): Promise<boolean> {
        const container = await this.getContainer(containerName)
        const blockBlob = container.getBlockBlobClient(blobName)
        const response = await blockBlob.deleteIfExists()
        return !!response.succeeded
    }

    getProjectContainerName(projectKey: string): string {
        const normalized = String(projectKey || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '')

        if (normalized.length >= 3 && normalized.length <= 63 && /^[a-z0-9]/.test(normalized) && /[a-z0-9]$/.test(normalized)) {
            return normalized
        }

        const hash = createHash('sha256').update(String(projectKey || 'project-doc-library')).digest('hex').slice(0, 24)
        return `project-${hash}`
    }

    private async getContainer(projectKey: string): Promise<ContainerClient> {
        if (!this.connectionString) {
            throw new Error('Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.')
        }

        const client = BlobServiceClient.fromConnectionString(this.connectionString)
        const container = client.getContainerClient(this.getProjectContainerName(projectKey))
        await container.createIfNotExists()
        return container
    }
}
