import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { Bootstrap } from './core/bootstrap'
import { SqlDb } from './workspaces/fieldwire/repository/sqldb'
import { Vendor } from './workspaces/fieldwire/repository/vendor'
import { VendorPricelist } from './workspaces/fieldwire/repository/vendorPricelist'

const WORKBOOK_HEADERS = [
    'BRAND',
    'CATEGORY',
    'PRODUCT DESCRIPTION',
    'SERVICE DESCRIPTION',
    'PRODUCT/SERVICE PART NUMBER',
    'MANUFACTURER OR RESELLER',
    'MSRP (USD)',
    'DISCOUNT % OFF MSRP',
    'DIR ADMIN FEE',
    'DIR CUSTOMER PRICE'
]

async function main() {
    const workbookPath = path.resolve(process.cwd(), process.argv[2] || '../resources/security-pricing.xlsx')
    const app = await new Bootstrap().start(true)
    const sqldb = new SqlDb(app)
    await sqldb.ensureVendorPricelistSchema()

    const workbook = XLSX.readFile(workbookPath, { cellDates: false, raw: false })
    let totalRows = 0
    const summaries: string[] = []

    for (const sheetName of workbook.SheetNames) {
        if (sheetName.startsWith('~')) {
            continue
        }
        if (isExcludedWorksheet(sheetName)) {
            summaries.push(`${sheetName}: skipped, Edwards parts continue to use the existing EddyPricelist import path.`)
            continue
        }
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
            raw: false
        })
        const normalizedRows = rows
            .map((row) => normalizeWorkbookRow(sheetName, row))
            .filter((row): row is VendorPricelist => !!row)

        if (normalizedRows.length <= 0) {
            summaries.push(`${sheetName}: skipped, no part rows found.`)
            continue
        }

        const vendor = await upsertWorkbookVendor(sqldb, sheetName)
        const existingRows = await sqldb.getRawVendorPricelist(vendor.vendorId)
        const snapshotId = await sqldb.createVendorImportSnapshot({
            vendorId: vendor.vendorId,
            targetTable: 'VendorPricelist',
            fileName: path.basename(workbookPath),
            rowCount: existingRows.length,
            summaryJson: JSON.stringify({
                action: 'pre-import-backup',
                sourceWorksheet: sheetName,
                importedRowCount: normalizedRows.length,
                createdAt: new Date().toISOString()
            }),
            rowsJson: JSON.stringify(existingRows),
            createdBy: 'security-pricing-import'
        })

        await sqldb.replaceVendorPricelist(vendor.vendorId, normalizedRows)
        await sqldb.createVendorImportRun({
            vendorId: vendor.vendorId,
            targetTable: 'VendorPricelist',
            fileName: path.basename(workbookPath),
            snapshotId,
            action: 'import',
            rowCount: normalizedRows.length,
            createdBy: 'security-pricing-import',
            notesJson: JSON.stringify({
                sourceWorksheet: sheetName,
                expectedHeaders: WORKBOOK_HEADERS
            })
        })

        totalRows += normalizedRows.length
        summaries.push(`${sheetName}: ${normalizedRows.length} parts imported for vendor ${vendor.name}.`)
    }

    console.log(`Imported ${totalRows} security pricing rows from ${workbookPath}`)
    for (const summary of summaries) {
        console.log(`- ${summary}`)
    }
}

async function upsertWorkbookVendor(sqldb: SqlDb, sheetName: string): Promise<Vendor> {
    const name = sheetName.trim()
    const partsVendorKey = slugify(name)
    const importConfigJson = JSON.stringify({
        partsVendorKey,
        sourceLabel: `Security pricing workbook worksheet "${name}"`,
        targetTable: 'VendorPricelist',
        filePattern: 'security-pricing.xlsx',
        sourceWorksheet: name,
        expectedHeaders: WORKBOOK_HEADERS,
        headerMap: {
            BRAND: 'ParentCategory',
            CATEGORY: 'Category',
            'PRODUCT/SERVICE PART NUMBER': 'PartNumber',
            'PRODUCT DESCRIPTION': 'LongDescription',
            'MSRP (USD)': 'MSRPPrice',
            'DIR CUSTOMER PRICE': 'SalesPrice'
        },
        columnTypes: {
            ParentCategory: 'string',
            Category: 'string',
            PartNumber: 'string',
            LongDescription: 'string',
            MSRPPrice: 'money',
            SalesPrice: 'money'
        },
        normalizationSteps: [
            'Each worksheet is treated as one vendor.',
            'Rows are loaded into VendorPricelist while preserving the original source row JSON.',
            'DIR CUSTOMER PRICE maps to SalesPrice for downstream device/material creation.',
            'BRAND maps to ParentCategory and CATEGORY maps to Category to match the existing parts grid.'
        ],
        analysisSummary: [
            'Imported from resources/security-pricing.xlsx.',
            'VendorPricelist uses the Eddy-compatible column names needed by the existing Parts workflow.'
        ],
        replaceMode: 'truncate-and-load',
        snapshotTable: 'vendorImportSnapshots'
    }, null, 2)

    const existing = await sqldb.getVendorByName(name)
    if (existing) {
        await sqldb.updateVendor({
            ...existing,
            desc: existing.desc || 'Imported security pricing vendor.',
            link: existing.link || '',
            importConfigJson
        })
        const reloaded = await sqldb.getVendorById(existing.vendorId)
        if (!reloaded) {
            throw new Error(`Vendor ${existing.vendorId} could not be reloaded after update.`)
        }
        return reloaded
    }

    const vendorId = await sqldb.createVendor({
        name,
        desc: 'Imported security pricing vendor.',
        link: '',
        importConfigJson
    })
    const created = await sqldb.getVendorById(vendorId)
    if (!created) {
        throw new Error(`Vendor ${name} could not be reloaded after create.`)
    }
    return created
}

function normalizeWorkbookRow(sheetName: string, row: Record<string, unknown>): VendorPricelist | null {
    const partNumber = readText(row, 'PRODUCT/SERVICE PART NUMBER')
    if (!partNumber) {
        return null
    }

    const brand = readText(row, 'BRAND')
    const category = readText(row, 'CATEGORY')
    const description = readText(row, 'PRODUCT DESCRIPTION')
    const serviceDescription = readText(row, 'SERVICE DESCRIPTION')
    const manufacturerOrReseller = readText(row, 'MANUFACTURER OR RESELLER')

    return {
        vendorId: '',
        sourceVendorName: sheetName,
        brand,
        ParentCategory: brand,
        Category: category,
        PartNumber: limitText(partNumber, 120),
        LongDescription: limitText(description || serviceDescription || partNumber, 1000),
        ServiceDescription: limitText(serviceDescription, 1000),
        ManufacturerOrReseller: limitText(manufacturerOrReseller, 500),
        MSRPPrice: readMoney(row, 'MSRP (USD)'),
        DiscountPercent: readPercent(row, 'DISCOUNT % OFF MSRP'),
        DirAdminFee: readMoney(row, 'DIR ADMIN FEE'),
        SalesPrice: readMoney(row, 'DIR CUSTOMER PRICE'),
        MinOrderQuantity: null,
        ProductStatus: '',
        Agency: '',
        CountryOfOrigin: '',
        UPC: '',
        RawJson: JSON.stringify(row)
    }
}

function readText(row: Record<string, unknown>, key: string): string {
    return String(row[key] ?? '').trim()
}

function readMoney(row: Record<string, unknown>, key: string): number {
    const parsed = Number(readText(row, key).replace(/\$/g, '').replace(/,/g, '').replace(/%/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
}

function readPercent(row: Record<string, unknown>, key: string): number | null {
    const raw = readText(row, key)
    if (!raw) {
        return null
    }
    const parsed = Number(raw.replace(/%/g, '').replace(/,/g, ''))
    if (!Number.isFinite(parsed)) {
        return null
    }
    return raw.includes('%') || parsed > 1 ? parsed : parsed * 100
}

function limitText(value: string, maxLength: number): string {
    return value.length > maxLength ? value.slice(0, maxLength) : value
}

function slugify(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'security-vendor'
}

function isExcludedWorksheet(sheetName: string): boolean {
    const normalized = sheetName.trim().toLowerCase()
    return normalized === 'edwards'
}

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
