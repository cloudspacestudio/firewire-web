import * as path from 'node:path'
import * as XLSX from 'xlsx'
import { Bootstrap } from './core/bootstrap'
import { SqlDb } from './workspaces/fieldwire/repository/sqldb'
import { Vendor } from './workspaces/fieldwire/repository/vendor'
import { Part } from './workspaces/fieldwire/repository/part'

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
    await sqldb.ensurePartsSchema()

    const workbook = XLSX.readFile(workbookPath, { cellDates: false, raw: false })
    let totalRows = 0
    const summaries: string[] = []

    for (const sheetName of workbook.SheetNames) {
        if (sheetName.startsWith('~')) {
            continue
        }
        const sheet = workbook.Sheets[sheetName]
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
            defval: '',
            raw: false
        })
        const normalizedRows = rows
            .map((row) => normalizeWorkbookRow(sheetName, row))
            .filter((row): row is Part => !!row)

        if (normalizedRows.length <= 0) {
            summaries.push(`${sheetName}: skipped, no part rows found.`)
            continue
        }

        const vendor = await upsertWorkbookVendor(sqldb, sheetName)
        const existingRows = await sqldb.getRawPartsByVendor(vendor.vendorId)
        const snapshotId = await sqldb.createVendorImportSnapshot({
            vendorId: vendor.vendorId,
            targetTable: 'parts',
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

        await sqldb.replacePartsForVendor(vendor.vendorId, normalizedRows)
        await sqldb.createVendorImportRun({
            vendorId: vendor.vendorId,
            targetTable: 'parts',
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
        targetTable: 'parts',
        filePattern: 'security-pricing.xlsx',
        sourceWorksheet: name,
        expectedHeaders: WORKBOOK_HEADERS,
        headerMap: {
            BRAND: 'parentCategory',
            CATEGORY: 'category',
            'PRODUCT/SERVICE PART NUMBER': 'partNumber',
            'PRODUCT DESCRIPTION': 'description',
            'MSRP (USD)': 'msrp',
            'DIR CUSTOMER PRICE': 'cost'
        },
        columnTypes: {
            parentCategory: 'string',
            category: 'string',
            partNumber: 'string',
            description: 'string',
            msrp: 'money',
            cost: 'money'
        },
        normalizationSteps: [
            'Each worksheet is treated as one vendor.',
            'Rows are loaded into parts while preserving the original source row JSON.',
            'DIR CUSTOMER PRICE maps to cost for downstream device/material creation.',
            'MSRP maps to msrp for customer-facing retail pricing.',
            'BRAND maps to parentCategory and CATEGORY maps to category.'
        ],
        analysisSummary: [
            'Imported from resources/security-pricing.xlsx.',
            'parts is the canonical master parts repository.'
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

function normalizeWorkbookRow(sheetName: string, row: Record<string, unknown>): Part | null {
    const partNumber = readPartNumber(row, 'PRODUCT/SERVICE PART NUMBER')
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
        parentCategory: brand,
        category,
        partNumber: limitText(partNumber, 120),
        description: limitText(description || serviceDescription || partNumber, 2000),
        msrp: readMoney(row, 'MSRP (USD)'),
        cost: readMoney(row, 'DIR CUSTOMER PRICE'),
        minQty: null,
        productStatus: '',
        agency: '',
        countryOfOrigin: '',
        upc: '',
        rawJson: JSON.stringify({
            ...row,
            serviceDescription: limitText(serviceDescription, 2000),
            manufacturerOrReseller: limitText(manufacturerOrReseller, 500),
            discountPercent: readPercent(row, 'DISCOUNT % OFF MSRP'),
            dirAdminFee: readMoney(row, 'DIR ADMIN FEE')
        })
    }
}

function readText(row: Record<string, unknown>, key: string): string {
    return String(row[key] ?? '').trim()
}

function readPartNumber(row: Record<string, unknown>, key: string): string {
    const value = readText(row, key)
    if (!value) {
        return ''
    }
    const currencyMatch = value.match(/^\$?\s*([0-9]{1,3}(?:,[0-9]{3})+)(?:\.0+)?$/)
    if (currencyMatch) {
        return currencyMatch[1].replace(/,/g, '')
    }
    const plainDecimalMatch = value.match(/^([0-9]+)\.0+$/)
    if (plainDecimalMatch) {
        return plainDecimalMatch[1]
    }
    return value
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

main().catch((err) => {
    console.error(err)
    process.exitCode = 1
})
