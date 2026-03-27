export interface VendorImportSnapshot {
    snapshotId: string
    vendorId: string
    targetTable: string
    fileName: string
    summaryJson: string
    rowsJson: string
    rowCount: number
    createdAt: Date
    createdBy: string
}
