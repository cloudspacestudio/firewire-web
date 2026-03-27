export interface VendorImportRun {
    runId: string
    vendorId: string
    targetTable: string
    fileName: string
    snapshotId?: string | null
    action: string
    rowCount: number
    importedAt: Date
    createdBy: string
    notesJson?: string | null
}
