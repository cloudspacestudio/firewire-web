"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirewireData = void 0;
const multer_1 = __importDefault(require("multer"));
const sync_1 = require("csv-parse/sync");
const XLSX = __importStar(require("xlsx"));
const sqldb_1 = require("../../fieldwire/repository/sqldb");
const azure_blob_document_storage_1 = require("./azure-blob-document-storage");
const uploadToMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_PARTS_IMPORT_MAX_BYTES || 15 * 1024 * 1024)
    }
}).single('file');
const uploadVendorLogoToMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_VENDOR_LOGO_MAX_BYTES || 2 * 1024 * 1024)
    }
}).single('file');
const uploadDocLibraryFileToMemory = (0, multer_1.default)({
    storage: multer_1.default.memoryStorage(),
    limits: {
        fileSize: Number(process.env.FIREWIRE_DOC_LIBRARY_MAX_FILE_BYTES || 250 * 1024 * 1024)
    }
}).single('file');
class FirewireData {
    static resolveEdwardsVendor(sqldb) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendors = yield sqldb.getVendors();
            return vendors.find((row) => /edwards|edward/i.test(String(row.name || ''))) || null;
        });
    }
    static requireEdwardsVendor(sqldb, res) {
        return __awaiter(this, void 0, void 0, function* () {
            const vendor = yield _a.resolveEdwardsVendor(sqldb);
            if (!vendor) {
                res.status(400).json({
                    message: 'No Edwards vendor record was found. Create the Edwards vendor first before creating devices from the Edwards parts list.'
                });
                return null;
            }
            return vendor;
        });
    }
    static getUpload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                uploadToMemory(req, res, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(req.file);
                });
            });
        });
    }
    static getVendorLogoUpload(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                uploadVendorLogoToMemory(req, res, (err) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve(req.file);
                });
            });
        });
    }
    static safeJsonParse(raw) {
        if (!raw) {
            return null;
        }
        try {
            return JSON.parse(raw);
        }
        catch (_b) {
            return null;
        }
    }
    static resolveVendorImportConfig(sqldb, vendor) {
        return __awaiter(this, void 0, void 0, function* () {
            if (vendor.importConfigJson) {
                return {
                    config: _a.sanitizeVendorImportConfig(_a.safeJsonParse(vendor.importConfigJson)),
                    seeded: false
                };
            }
            const fallback = _a.buildDefaultVendorImportConfig(vendor);
            if (!fallback) {
                return { config: null, seeded: false };
            }
            yield sqldb.updateVendorImportConfig(vendor.vendorId, JSON.stringify(fallback, null, 2));
            return {
                config: fallback,
                seeded: true
            };
        });
    }
    static buildDefaultVendorImportConfig(vendor) {
        const vendorName = String(vendor.name || 'Vendor').trim() || 'Vendor';
        const vendorKey = _a.slugify(vendorName);
        return {
            partsVendorKey: vendorKey,
            sourceLabel: `${vendorName} parts import`,
            targetTable: 'parts',
            filePattern: '*.csv,*.xlsx,*.xls',
            expectedHeaders: [
                'PART NUMBER',
                'DESCRIPTION',
                'PARENT CATEGORY',
                'CATEGORY',
                'MSRP',
                'MIN QTY',
                'UPC',
                'COST'
            ],
            headerMap: {
                'PART NUMBER': 'partNumber',
                'DESCRIPTION': 'description',
                'PARENT CATEGORY': 'parentCategory',
                'CATEGORY': 'category',
                'MSRP': 'msrp',
                'MIN QTY': 'minQty',
                'UPC': 'upc',
                'COST': 'cost'
            },
            columnTypes: {
                partNumber: 'string',
                description: 'string',
                parentCategory: 'string',
                category: 'string',
                msrp: 'money',
                minQty: 'int',
                upc: 'string',
                cost: 'money'
            },
            normalizationSteps: [
                'Map vendor file headers to canonical parts column names before load.',
                'Treat part numbers as text identifiers, including values Excel formatted as currency.',
                'Strip currency symbols and commas from MSRP and cost fields.',
                'Allow blanks to load as NULL for nullable columns.',
                'Backup the current vendor parts rows before replacing them.'
            ],
            analysisSummary: [
                'Default master parts import configuration.',
                'Expected headers match the canonical master parts fields.'
            ],
            replaceMode: 'truncate-and-load',
            snapshotTable: 'vendorImportSnapshots'
        };
    }
    static sanitizeVendorImportConfig(raw) {
        const base = raw && typeof raw === 'object' ? raw : {};
        return {
            partsVendorKey: String(base.partsVendorKey || '').trim() || 'vendor',
            sourceLabel: String(base.sourceLabel || '').trim() || 'Vendor parts import',
            targetTable: _a.normalizePartsTargetTable(base.targetTable),
            filePattern: String(base.filePattern || '').trim() || '*.csv,*.xlsx,*.xls',
            expectedHeaders: Array.isArray(base.expectedHeaders) ? base.expectedHeaders.map((value) => String(value || '').trim()).filter(Boolean) : [],
            headerMap: _a.normalizeHeaderMap(base.headerMap),
            columnTypes: _a.normalizeColumnTypes(base.columnTypes),
            normalizationSteps: Array.isArray(base.normalizationSteps) ? base.normalizationSteps.map((value) => String(value || '').trim()).filter(Boolean) : [],
            analysisSummary: Array.isArray(base.analysisSummary) ? base.analysisSummary.map((value) => String(value || '').trim()).filter(Boolean) : [],
            verifiedSampleFile: String(base.verifiedSampleFile || '').trim() || undefined,
            verifiedOn: String(base.verifiedOn || '').trim() || undefined,
            replaceMode: 'truncate-and-load',
            snapshotTable: String(base.snapshotTable || '').trim() || 'vendorImportSnapshots'
        };
    }
    static normalizePartsTargetTable(value) {
        return 'parts';
    }
    static slugify(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'vendor';
    }
    static normalizeHeaderMap(raw) {
        const output = {};
        if (!raw || typeof raw !== 'object') {
            return output;
        }
        for (const [key, value] of Object.entries(raw)) {
            const header = String(key || '').trim();
            const target = String(value || '').trim();
            if (header && target) {
                output[header] = target;
            }
        }
        return output;
    }
    static normalizeColumnTypes(raw) {
        const output = {};
        if (!raw || typeof raw !== 'object') {
            return output;
        }
        for (const [key, value] of Object.entries(raw)) {
            const type = String(value || '').trim();
            if (type === 'string' || type === 'money' || type === 'int' || type === 'date') {
                output[key] = type;
            }
        }
        return output;
    }
    static buildNormalizedImportResult(sqldb, vendor, fileName, fileBuffer) {
        return __awaiter(this, void 0, void 0, function* () {
            return _a.buildNormalizedImportResultFromRows(sqldb, vendor, fileName, _a.parsePartsImportRows(fileName, fileBuffer));
        });
    }
    static buildNormalizedImportResultFromRows(sqldb, vendor, fileName, parsedRows) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b;
            const resolved = yield _a.resolveVendorImportConfig(sqldb, vendor);
            if (!resolved.config) {
                throw new Error(`No import configuration exists for vendor ${vendor.name}.`);
            }
            const config = resolved.config;
            const actualHeaders = Array.isArray(parsedRows[0]) ? parsedRows[0].map((value) => String(value || '').trim()) : [];
            const bodyRows = parsedRows.slice(1);
            const actualHeaderByNormalized = new Map(actualHeaders.map((header) => [_a.normalizeHeaderName(header), header]));
            const expectedHeaderSet = new Set(config.expectedHeaders.map((header) => _a.normalizeHeaderName(header)));
            const missingHeaders = config.expectedHeaders.filter((header) => !actualHeaderByNormalized.has(_a.normalizeHeaderName(header)));
            const unexpectedHeaders = actualHeaders.filter((header) => !expectedHeaderSet.has(_a.normalizeHeaderName(header)));
            const issues = [];
            const sampleErrors = [];
            const normalizedRows = [];
            const lengthLimits = {
                ParentCategory: 500,
                parentCategory: 500,
                Category: 500,
                category: 500,
                PartNumber: 120,
                partNumber: 120,
                LongDescription: 2000,
                description: 2000,
                ProductStatus: 500,
                productStatus: 500,
                Agency: 50,
                agency: 50,
                CountryOfOrigin: 50,
                countryOfOrigin: 50,
                UPC: 50,
                upc: 50
            };
            if (missingHeaders.length > 0) {
                issues.push(`Missing required headers: ${missingHeaders.join(', ')}`);
            }
            if (unexpectedHeaders.length > 0) {
                issues.push(`Unexpected headers detected: ${unexpectedHeaders.join(', ')}`);
            }
            for (let rowIndex = 0; rowIndex < bodyRows.length; rowIndex++) {
                const rowValues = Array.isArray(bodyRows[rowIndex]) ? bodyRows[rowIndex] : [];
                const sourceRow = {};
                actualHeaders.forEach((header, index) => {
                    var _b;
                    sourceRow[header] = String((_b = rowValues[index]) !== null && _b !== void 0 ? _b : '').trim();
                });
                const normalizedRow = {
                    ParentCategory: '',
                    Category: '',
                    PartNumber: '',
                    LongDescription: '',
                    MSRPPrice: null,
                    SalesPrice: null,
                    FuturePrice: null,
                    FutureEffectiveDate: null,
                    FutureSalesPrice: null,
                    FutureSalesEffectiveDate: null,
                    MinOrderQuantity: null,
                    ProductStatus: '',
                    Agency: '',
                    CountryOfOrigin: '',
                    UPC: ''
                };
                for (const [sourceHeader, targetColumn] of Object.entries(config.headerMap)) {
                    const actualHeader = actualHeaderByNormalized.get(_a.normalizeHeaderName(sourceHeader)) || sourceHeader;
                    const rawValue = (_b = sourceRow[actualHeader]) !== null && _b !== void 0 ? _b : '';
                    const type = config.columnTypes[targetColumn] || 'string';
                    const normalizedValue = _a.isPartNumberColumn(targetColumn)
                        ? _a.normalizePartNumberImportValue(rawValue)
                        : _a.normalizeImportValue(rawValue, type);
                    normalizedRow[targetColumn] = normalizedValue;
                    const maxLength = lengthLimits[targetColumn];
                    if (maxLength && typeof normalizedValue === 'string' && normalizedValue.length > maxLength && sampleErrors.length < 12) {
                        sampleErrors.push(`Row ${rowIndex + 2}: ${targetColumn} exceeds ${maxLength} characters.`);
                    }
                }
                const normalizedPartNumber = _a.getNormalizedRowPartNumber(normalizedRow);
                if (!normalizedPartNumber && sampleErrors.length < 12) {
                    sampleErrors.push(`Row ${rowIndex + 2}: Part Number is blank.`);
                }
                normalizedRows.push(normalizedRow);
            }
            const preview = {
                valid: issues.length <= 0 && sampleErrors.length <= 0,
                vendorId: vendor.vendorId,
                fileName,
                targetTable: config.targetTable,
                rowCount: normalizedRows.length,
                actualHeaders,
                missingHeaders,
                unexpectedHeaders,
                issues,
                sampleErrors,
                sampleRows: normalizedRows.slice(0, 3),
                snapshotStrategy: `Existing ${config.targetTable} rows will be backed up into ${config.snapshotTable || 'vendorImportSnapshots'} before replace import.`
            };
            return {
                config,
                preview,
                normalizedRows
            };
        });
    }
    static buildBulkPartsWorkbookResult(sqldb, fileName, fileBuffer, execute) {
        return __awaiter(this, void 0, void 0, function* () {
            var _b;
            const extension = (_b = String(fileName || '').split('.').pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase();
            if (extension !== 'xlsx' && extension !== 'xls') {
                throw new Error('All Parts import expects an Excel workbook with one vendor per worksheet.');
            }
            const workbook = XLSX.read(fileBuffer, { cellDates: false, raw: true });
            const vendors = yield sqldb.getVendors();
            const vendorBySheetName = new Map(vendors.map((vendor) => [_a.normalizeWorkbookVendorName(vendor.name), vendor]));
            const results = [];
            for (const sheetName of workbook.SheetNames) {
                const sheetRows = _a.parsePartsImportWorksheet(workbook.Sheets[sheetName]);
                if (sheetRows.length <= 0) {
                    continue;
                }
                const vendor = vendorBySheetName.get(_a.normalizeWorkbookVendorName(sheetName));
                if (!vendor) {
                    results.push({
                        sheetName,
                        matched: false,
                        valid: true,
                        rowCount: Math.max(sheetRows.length - 1, 0),
                        issues: [`No vendor named "${sheetName}" exists. Sheet skipped.`],
                        sampleErrors: []
                    });
                    continue;
                }
                const normalized = yield _a.buildNormalizedImportResultFromRows(sqldb, vendor, `${fileName}:${sheetName}`, sheetRows);
                const vendorResult = {
                    sheetName,
                    vendorId: vendor.vendorId,
                    vendorName: vendor.name,
                    matched: true,
                    valid: normalized.preview.valid,
                    rowCount: normalized.preview.rowCount,
                    issues: normalized.preview.issues,
                    sampleErrors: normalized.preview.sampleErrors
                };
                if (execute && normalized.preview.valid) {
                    const existingRows = yield sqldb.getRawPartsByVendor(vendor.vendorId);
                    const snapshotId = yield sqldb.createVendorImportSnapshot({
                        vendorId: vendor.vendorId,
                        targetTable: normalized.config.targetTable,
                        fileName: `${fileName}:${sheetName}`,
                        rowCount: existingRows.length,
                        summaryJson: JSON.stringify({
                            action: 'pre-workbook-import-backup',
                            fileName,
                            sheetName,
                            importedRowCount: normalized.preview.rowCount,
                            createdAt: new Date().toISOString()
                        }),
                        rowsJson: JSON.stringify(existingRows),
                        createdBy: 'system'
                    });
                    yield sqldb.replacePartsForVendor(vendor.vendorId, normalized.normalizedRows);
                    const runId = yield sqldb.createVendorImportRun({
                        vendorId: vendor.vendorId,
                        targetTable: normalized.config.targetTable,
                        fileName: `${fileName}:${sheetName}`,
                        snapshotId,
                        action: 'import',
                        rowCount: normalized.normalizedRows.length,
                        createdBy: 'system',
                        notesJson: JSON.stringify({
                            workbookFileName: fileName,
                            sheetName,
                            preview: normalized.preview
                        })
                    });
                    vendorResult.snapshotId = snapshotId;
                    vendorResult.runId = runId;
                    vendorResult.importedRowCount = normalized.normalizedRows.length;
                }
                results.push(vendorResult);
            }
            const matchedResults = results.filter((row) => row.matched);
            const invalidMatchedResults = matchedResults.filter((row) => !row.valid);
            return {
                fileName,
                sheetCount: workbook.SheetNames.length,
                matchedVendorCount: matchedResults.length,
                skippedSheetCount: results.filter((row) => !row.matched).length,
                importedVendorCount: execute ? results.filter((row) => row.matched && row.valid && typeof row.importedRowCount === 'number').length : 0,
                importedRowCount: execute ? results.reduce((sum, row) => sum + Number(row.importedRowCount || 0), 0) : 0,
                valid: matchedResults.length > 0 && invalidMatchedResults.length <= 0,
                results
            };
        });
    }
    static normalizeImportValue(rawValue, type) {
        const value = String(rawValue || '').trim();
        if (!value) {
            return null;
        }
        if (type === 'money') {
            const parsed = Number(value.replace(/\$/g, '').replace(/,/g, ''));
            return Number.isFinite(parsed) ? parsed : null;
        }
        if (type === 'int') {
            const parsed = Number(value);
            return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
        }
        if (type === 'date') {
            const usMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
            if (usMatch) {
                return `${usMatch[3]}-${usMatch[1].padStart(2, '0')}-${usMatch[2].padStart(2, '0')}`;
            }
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
        }
        return _a.normalizeImportText(value);
    }
    static normalizeHeaderName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }
    static normalizeWorkbookVendorName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }
    static parsePartsImportRows(fileName, fileBuffer) {
        var _b;
        const extension = (_b = String(fileName || '').split('.').pop()) === null || _b === void 0 ? void 0 : _b.toLowerCase();
        if (extension === 'xlsx' || extension === 'xls') {
            const workbook = XLSX.read(fileBuffer, { cellDates: false, raw: true });
            const firstSheetName = workbook.SheetNames[0];
            if (!firstSheetName) {
                return [];
            }
            return _a.parsePartsImportWorksheet(workbook.Sheets[firstSheetName]);
        }
        return (0, sync_1.parse)(fileBuffer.toString('utf-8'), {
            bom: true,
            skip_empty_lines: true
        });
    }
    static parsePartsImportWorksheet(sheet) {
        const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
            raw: true
        });
        return rows
            .map((row) => Array.isArray(row) ? row.map((value) => String(value !== null && value !== void 0 ? value : '').trim()) : [])
            .filter((row) => row.some((value) => !!String(value || '').trim()));
    }
    static isPartNumberColumn(targetColumn) {
        return String(targetColumn || '').trim().toLowerCase() === 'partnumber';
    }
    static getNormalizedRowPartNumber(row) {
        return String(row.partNumber || row.PartNumber || '').trim();
    }
    static normalizePartNumberImportValue(rawValue) {
        const value = _a.normalizeImportText(String(rawValue || '').trim());
        if (!value) {
            return '';
        }
        const currencyMatch = value.match(/^\$?\s*([0-9]{1,3}(?:,[0-9]{3})+)(?:\.0+)?$/);
        if (currencyMatch) {
            return currencyMatch[1].replace(/,/g, '');
        }
        const plainDecimalMatch = value.match(/^([0-9]+)\.0+$/);
        if (plainDecimalMatch) {
            return plainDecimalMatch[1];
        }
        return value;
    }
    static normalizeImportText(value) {
        if (!value) {
            return value;
        }
        let useOpening = true;
        return value.replace(/"/g, () => {
            const next = useOpening ? '“' : '”';
            useOpening = !useOpening;
            return next;
        });
    }
    static buildDeviceSetSummaries(sqldb) {
        return __awaiter(this, void 0, void 0, function* () {
            const [deviceSets, deviceSetDevices, devices] = yield Promise.all([
                sqldb.getDeviceSets(),
                sqldb.getDeviceSetDevices(),
                sqldb.getVwDevices()
            ]);
            const devicesById = new Map(devices.map((row) => [row.deviceId, row]));
            const linksBySetId = new Map();
            for (const row of deviceSetDevices) {
                const existing = linksBySetId.get(row.deviceSetId) || [];
                existing.push(row.deviceId);
                linksBySetId.set(row.deviceSetId, existing);
            }
            return deviceSets.map((row) => {
                const linkedDeviceIds = linksBySetId.get(row.deviceSetId) || [];
                const linkedDevices = linkedDeviceIds.map((deviceId) => devicesById.get(deviceId)).filter(Boolean);
                const vendorNames = Array.from(new Set(linkedDevices.map((device) => String((device === null || device === void 0 ? void 0 : device.vendorName) || '').trim()).filter(Boolean)));
                return {
                    deviceSetId: row.deviceSetId,
                    name: row.name,
                    deviceCount: linkedDevices.length,
                    vendors: vendorNames,
                    createat: row.createat,
                    updateat: row.updateat
                };
            });
        });
    }
    static buildDeviceSetDetail(sqldb, deviceSetId) {
        return __awaiter(this, void 0, void 0, function* () {
            const [deviceSet, deviceSetDevices, devices] = yield Promise.all([
                sqldb.getDeviceSet(deviceSetId),
                sqldb.getDeviceSetDevices(deviceSetId),
                sqldb.getVwDevices()
            ]);
            if (!deviceSet) {
                return null;
            }
            const devicesById = new Map(devices.map((row) => [row.deviceId, row]));
            const linkedDevices = deviceSetDevices
                .map((row) => devicesById.get(row.deviceId))
                .filter(Boolean)
                .sort((left, right) => String((left === null || left === void 0 ? void 0 : left.name) || '').localeCompare(String((right === null || right === void 0 ? void 0 : right.name) || '')));
            return {
                deviceSetId: deviceSet.deviceSetId,
                name: deviceSet.name,
                devices: linkedDevices
            };
        });
    }
    static buildDeviceVendorLinkIssues(sqldb) {
        return __awaiter(this, void 0, void 0, function* () {
            const devices = yield sqldb.getVwDevices();
            const deviceMaterials = yield sqldb.getVwDeviceMaterials();
            const ignores = yield sqldb.getDeviceVendorLinkIgnores();
            const vendors = yield sqldb.getVendors();
            const vendorById = new Map(vendors.map((vendor) => [vendor.vendorId, vendor]));
            const materialsByDeviceId = new Map();
            for (const row of deviceMaterials) {
                const existing = materialsByDeviceId.get(row.deviceId) || [];
                existing.push(row);
                materialsByDeviceId.set(row.deviceId, existing);
            }
            const issues = [];
            for (const device of devices) {
                const vendor = vendorById.get(device.vendorId);
                if (!vendor) {
                    continue;
                }
                const resolvedConfig = yield _a.resolveVendorImportConfig(sqldb, vendor);
                const config = resolvedConfig.config;
                if (!config) {
                    continue;
                }
                const candidates = [
                    { partNumber: String(device.partNumber || '').trim(), sourceKind: 'device', sourceLabel: 'Device default part' },
                    ...((materialsByDeviceId.get(device.deviceId) || []).map((row) => ({
                        partNumber: String(row.partNumber || '').trim(),
                        sourceKind: 'material',
                        sourceLabel: 'Linked material part'
                    })))
                ].filter((row) => !!row.partNumber);
                for (const candidate of candidates) {
                    const exists = yield _a.checkVendorPartExists(sqldb, vendor, config, candidate.partNumber);
                    if (exists) {
                        continue;
                    }
                    const ignored = ignores.find((row) => row.deviceId === device.deviceId &&
                        row.vendorId === device.vendorId &&
                        row.partNumber === candidate.partNumber &&
                        row.sourceKind === candidate.sourceKind);
                    issues.push({
                        deviceId: device.deviceId,
                        deviceName: device.name,
                        vendorId: device.vendorId,
                        vendorName: device.vendorName,
                        partNumber: candidate.partNumber,
                        sourceKind: candidate.sourceKind,
                        sourceLabel: candidate.sourceLabel,
                        ignored: !!ignored,
                        ignoreReason: (ignored === null || ignored === void 0 ? void 0 : ignored.reason) || null
                    });
                }
            }
            return issues;
        });
    }
    static checkVendorPartExists(sqldb, vendor, config, partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            if (config.targetTable === 'parts') {
                const rows = yield sqldb.getPartByVendorAndPartNumber(vendor.vendorId, partNumber);
                return Array.isArray(rows) && rows.length > 0;
            }
            return false;
        });
    }
    static resolveVendorPartRecord(sqldb, vendor, partNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const resolved = yield _a.resolveVendorImportConfig(sqldb, vendor);
            const config = resolved.config;
            if (!config) {
                return null;
            }
            if (config.targetTable === 'parts') {
                const rows = yield sqldb.getPartByVendorAndPartNumber(vendor.vendorId, partNumber);
                return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
            }
            return null;
        });
    }
    static createDeviceFromVendorPart(sqldb, vendor, partNumber, part, body) {
        return __awaiter(this, void 0, void 0, function* () {
            const name = String((body === null || body === void 0 ? void 0 : body.name) || '').trim();
            const shortName = String((body === null || body === void 0 ? void 0 : body.shortName) || '').trim();
            const categoryId = String((body === null || body === void 0 ? void 0 : body.categoryId) || '').trim();
            const categoryName = String((body === null || body === void 0 ? void 0 : body.categoryName) || '').trim();
            if (!partNumber || !name || !shortName || !categoryId) {
                const error = new Error('partNumber, name, shortName, and categoryId are required.');
                error.status = 400;
                throw error;
            }
            yield _a.ensureCategoriesExistForVendorPartNumbers(sqldb, vendor, [partNumber]);
            if (categoryName) {
                yield _a.ensureCategoryExistsByName(sqldb, categoryName, 'device-category-sync');
            }
            const categories = yield sqldb.getCategories();
            const normalizedCategoryName = _a.normalizeCategoryName(categoryName);
            const category = categories.find((row) => row.categoryId === categoryId
                || (!!normalizedCategoryName && _a.normalizeCategoryName(row.name) === normalizedCategoryName));
            if (!category) {
                const error = new Error(`Category ${categoryName || categoryId} not found.`);
                error.status = 404;
                throw error;
            }
            const existingDevice = yield sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber);
            if (existingDevice) {
                const error = new Error(`A device already exists for ${partNumber} under vendor ${vendor.name}.`);
                error.status = 409;
                error.data = existingDevice;
                throw error;
            }
            const safeDeviceName = _a.getSafeDeviceName(name, partNumber);
            const safeShortName = _a.limitText(shortName || partNumber, 50) || partNumber;
            const safeMaterialName = _a.getSafeDeviceName(name || String((part === null || part === void 0 ? void 0 : part.LongDescription) || ''), partNumber);
            const categoryDefaultLabor = typeof category.defaultLabor === 'number' ? Number(category.defaultLabor) : 112;
            const categorySlcAddress = String(category.slcAddress || '').trim();
            const categorySpeakerAddress = String(category.speakerAddress || '').trim();
            const categoryStrobeAddress = String(category.strobeAddress || '').trim();
            let material = yield sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber);
            let createdMaterial = false;
            if (!material) {
                yield sqldb.createMaterial({
                    materialId: '',
                    name: safeMaterialName,
                    shortName: safeShortName,
                    vendorId: vendor.vendorId,
                    categoryId: category.categoryId,
                    partNumber,
                    link: '',
                    cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                    defaultLabor: categoryDefaultLabor,
                    slcAddress: categorySlcAddress,
                    serialNumber: '',
                    strobeAddress: categoryStrobeAddress,
                    speakerAddress: categorySpeakerAddress
                });
                material = yield sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber);
                createdMaterial = true;
            }
            yield sqldb.createDevice({
                deviceId: '',
                name: safeDeviceName,
                shortName: safeShortName,
                vendorId: vendor.vendorId,
                categoryId: category.categoryId,
                partNumber,
                link: '',
                cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                defaultLabor: categoryDefaultLabor,
                slcAddress: categorySlcAddress,
                serialNumber: '',
                strobeAddress: categoryStrobeAddress,
                speakerAddress: categorySpeakerAddress
            });
            const device = yield sqldb.getDeviceByVendorAndPartNumber(vendor.vendorId, partNumber);
            if (!device) {
                throw new Error('Device was created but could not be reloaded.');
            }
            if (material) {
                const existingMap = yield sqldb.getDeviceMaterialByIds(device.deviceId, material.materialId);
                if (!existingMap) {
                    yield sqldb.createDeviceMaterialMap(device.deviceId, material.materialId);
                }
            }
            return { device, material, createdMaterial };
        });
    }
    static addVendorPartToExistingDevice(sqldb, vendor, partNumber, part, deviceId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!partNumber || !deviceId) {
                const error = new Error('partNumber and deviceId are required.');
                error.status = 400;
                throw error;
            }
            const device = yield sqldb.getDevice(deviceId);
            if (!device) {
                const error = new Error(`Device ${deviceId} not found.`);
                error.status = 404;
                throw error;
            }
            let material = yield sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber);
            let createdMaterial = false;
            if (!material) {
                yield sqldb.createMaterial({
                    materialId: '',
                    name: part.LongDescription || device.name,
                    shortName: partNumber,
                    vendorId: vendor.vendorId,
                    categoryId: device.categoryId,
                    partNumber,
                    link: '',
                    cost: Number(part.SalesPrice || part.MSRPPrice || 0),
                    defaultLabor: Number(device.defaultLabor || 112),
                    slcAddress: '',
                    serialNumber: '',
                    strobeAddress: '',
                    speakerAddress: ''
                });
                material = yield sqldb.getMaterialByVendorAndPartNumber(vendor.vendorId, partNumber);
                createdMaterial = true;
            }
            if (!material) {
                throw new Error('Material could not be created or loaded.');
            }
            const existingMap = yield sqldb.getDeviceMaterialByIds(device.deviceId, material.materialId);
            if (existingMap) {
                return { device, material, createdMaterial, createdMap: false };
            }
            yield sqldb.createDeviceMaterialMap(device.deviceId, material.materialId);
            return { device, material, createdMaterial, createdMap: true };
        });
    }
    static reconcileCategoriesFromDeviceParts(sqldb) {
        return __awaiter(this, void 0, void 0, function* () {
            const [categories, devices] = yield Promise.all([
                sqldb.getCategories(),
                sqldb.getVwDevices()
            ]);
            const referencedCategoryCounts = new Map();
            const referencedCategorySources = new Map();
            const referencedCategoryDisplayNames = new Map();
            for (const device of devices) {
                const categoryName = String(device.categoryName || '').trim();
                if (!categoryName) {
                    continue;
                }
                const normalizedCategory = _a.normalizeCategoryName(categoryName);
                referencedCategoryCounts.set(normalizedCategory, (referencedCategoryCounts.get(normalizedCategory) || 0) + 1);
                if (!referencedCategoryDisplayNames.has(normalizedCategory)) {
                    referencedCategoryDisplayNames.set(normalizedCategory, categoryName);
                }
                const sourceVendors = referencedCategorySources.get(normalizedCategory) || new Set();
                sourceVendors.add(String(device.vendorName || '').trim());
                referencedCategorySources.set(normalizedCategory, sourceVendors);
            }
            const categoriesByNormalizedName = new Map(categories.map((category) => [_a.normalizeCategoryName(category.name), category]));
            const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean));
            const createdCategoryNames = new Set();
            for (const normalizedCategory of referencedCategoryCounts.keys()) {
                if (categoriesByNormalizedName.has(normalizedCategory)) {
                    continue;
                }
                const displayName = referencedCategoryDisplayNames.get(normalizedCategory) || _a.restoreCategoryDisplayName(normalizedCategory);
                yield _a.createCategoryIfMissing(sqldb, displayName, categoriesByNormalizedName, existingHandles, 'category-reconcile');
                createdCategoryNames.add(normalizedCategory);
            }
            const refreshedCategories = yield sqldb.getCategories();
            const rows = refreshedCategories.map((category) => {
                const normalizedCategory = _a.normalizeCategoryName(category.name);
                return Object.assign(Object.assign({}, category), { referencedByDeviceParts: referencedCategoryCounts.has(normalizedCategory), devicePartReferenceCount: referencedCategoryCounts.get(normalizedCategory) || 0, sourceVendors: [...(referencedCategorySources.get(normalizedCategory) || new Set())], createdByReconcile: createdCategoryNames.has(normalizedCategory) });
            });
            return {
                rows,
                summary: {
                    createdCount: createdCategoryNames.size,
                    referencedCategoryCount: rows.filter((row) => row.referencedByDeviceParts).length,
                    unreferencedCategoryCount: rows.filter((row) => !row.referencedByDeviceParts).length
                }
            };
        });
    }
    static ensureCategoriesExistForVendorPartNumbers(sqldb, vendor, partNumbers) {
        return __awaiter(this, void 0, void 0, function* () {
            const uniquePartNumbers = Array.from(new Set(partNumbers.map((value) => String(value || '').trim()).filter(Boolean)));
            if (uniquePartNumbers.length <= 0) {
                return;
            }
            const categories = yield sqldb.getCategories();
            const categoriesByNormalizedName = new Map(categories.map((category) => [_a.normalizeCategoryName(category.name), category]));
            const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean));
            for (const partNumber of uniquePartNumbers) {
                const partRecord = yield _a.resolveVendorPartRecord(sqldb, vendor, partNumber);
                const categoryName = String((partRecord === null || partRecord === void 0 ? void 0 : partRecord.Category) || '').trim();
                if (!categoryName) {
                    continue;
                }
                yield _a.createCategoryIfMissing(sqldb, categoryName, categoriesByNormalizedName, existingHandles, 'device-category-sync');
            }
        });
    }
    static ensureCategoryExistsByName(sqldb, categoryName, createdBy) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedCategory = _a.normalizeCategoryName(categoryName);
            if (!normalizedCategory) {
                return;
            }
            const categories = yield sqldb.getCategories();
            const categoriesByNormalizedName = new Map(categories.map((category) => [_a.normalizeCategoryName(category.name), category]));
            const existingHandles = new Set(categories.map((category) => String(category.handle || '').trim().toLowerCase()).filter(Boolean));
            yield _a.createCategoryIfMissing(sqldb, categoryName, categoriesByNormalizedName, existingHandles, createdBy);
        });
    }
    static createCategoryIfMissing(sqldb, displayName, categoriesByNormalizedName, existingHandles, createdBy) {
        return __awaiter(this, void 0, void 0, function* () {
            const normalizedCategory = _a.normalizeCategoryName(displayName);
            if (!normalizedCategory || categoriesByNormalizedName.has(normalizedCategory)) {
                return;
            }
            const resolvedDisplayName = String(displayName || '').trim() || _a.restoreCategoryDisplayName(normalizedCategory);
            const handle = _a.buildUniqueCategoryHandle(resolvedDisplayName, existingHandles);
            yield sqldb.createCategory({
                categoryId: '',
                name: resolvedDisplayName,
                shortName: resolvedDisplayName,
                handle,
                createby: createdBy,
                updateby: createdBy
            });
            existingHandles.add(handle.toLowerCase());
            categoriesByNormalizedName.set(normalizedCategory, {
                categoryId: '',
                name: resolvedDisplayName,
                shortName: resolvedDisplayName,
                handle
            });
        });
    }
    static normalizeCategoryName(value) {
        return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
    }
    static limitText(value, maxLength) {
        return String(value || '').trim().slice(0, Math.max(0, maxLength));
    }
    static getSafeDeviceName(name, partNumber) {
        const trimmedName = String(name || '').trim();
        const trimmedPartNumber = String(partNumber || '').trim();
        if (!trimmedName || trimmedName.length > 30) {
            return _a.limitText(trimmedPartNumber, 100);
        }
        return _a.limitText(trimmedName, 100);
    }
    static restoreCategoryDisplayName(normalizedValue) {
        return String(normalizedValue || '')
            .split(' ')
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    }
    static buildUniqueCategoryHandle(name, existingHandles) {
        const maxLength = 10;
        const rawBaseHandle = String(name || '')
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, '') || 'CATEGORY';
        const baseHandle = rawBaseHandle.slice(0, maxLength) || 'CATEGORY'.slice(0, maxLength);
        let nextHandle = baseHandle;
        let suffix = 2;
        while (existingHandles.has(nextHandle.toLowerCase())) {
            const suffixText = String(suffix);
            const allowedBaseLength = Math.max(1, maxLength - suffixText.length);
            const truncatedBase = baseHandle.slice(0, allowedBaseLength) || baseHandle.slice(0, allowedBaseLength);
            nextHandle = `${truncatedBase}${suffixText}`.slice(0, maxLength);
            suffix += 1;
        }
        return nextHandle;
    }
    static loadStoredWorkspace(sqldb, area, workspaceKey, defaultPayload) {
        return __awaiter(this, void 0, void 0, function* () {
            const record = yield sqldb.getWorkspaceStorage(area, workspaceKey);
            if (!(record === null || record === void 0 ? void 0 : record.payloadJson)) {
                return {
                    workspaceKey,
                    payload: defaultPayload
                };
            }
            try {
                return {
                    workspaceKey,
                    payload: JSON.parse(record.payloadJson),
                    updatedAt: record.updateat
                };
            }
            catch (_b) {
                return {
                    workspaceKey,
                    payload: defaultPayload,
                    updatedAt: record.updateat
                };
            }
        });
    }
    static resolveUploadField(value) {
        if (Array.isArray(value)) {
            return String(value[0] || '').trim();
        }
        return String(value || '').trim();
    }
    static createClientSafeId(prefix) {
        return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
    }
    static sanitizeBlobPathSegment(value) {
        const cleaned = String(value || '')
            .trim()
            .replace(/\\/g, '/')
            .split('/')
            .filter(Boolean)
            .join('-')
            .replace(/[^a-zA-Z0-9._-]/g, '-')
            .replace(/-+/g, '-');
        return cleaned || 'unnamed';
    }
    static escapeHeaderFileName(value) {
        return String(value || 'document').replace(/["\r\n]/g, '_');
    }
}
exports.FirewireData = FirewireData;
_a = FirewireData;
FirewireData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/storage/design-train-ai',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const sqldb = new sqldb_1.SqlDb(req.app);
                const result = yield _a.loadStoredWorkspace(sqldb, 'design-train-ai', 'default', {
                    folders: [{
                            id: 'root',
                            parentFolderId: null,
                            name: 'Train AI',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }],
                    files: [],
                    annotations: []
                });
                return res.status(200).json({ data: result });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'put',
        path: '/api/firewire/storage/design-train-ai',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            try {
                const sqldb = new sqldb_1.SqlDb(req.app);
                yield sqldb.saveWorkspaceStorage('design-train-ai', 'default', JSON.stringify(((_b = req.body) === null || _b === void 0 ? void 0 : _b.payload) || req.body || {}), 'system');
                const result = yield _a.loadStoredWorkspace(sqldb, 'design-train-ai', 'default', {
                    folders: [{
                            id: 'root',
                            parentFolderId: null,
                            name: 'Train AI',
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString()
                        }],
                    files: [],
                    annotations: []
                });
                return res.status(200).json({ data: result });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'get',
        path: '/api/firewire/storage/project-doc-library/:workspaceKey',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const workspaceKey = String(req.params.workspaceKey || '').trim();
                if (!workspaceKey) {
                    return res.status(400).json({ message: 'workspaceKey is required.' });
                }
                const sqldb = new sqldb_1.SqlDb(req.app);
                const result = yield _a.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] });
                return res.status(200).json({ data: result });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'put',
        path: '/api/firewire/storage/project-doc-library/:workspaceKey',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            try {
                const workspaceKey = String(req.params.workspaceKey || '').trim();
                if (!workspaceKey) {
                    return res.status(400).json({ message: 'workspaceKey is required.' });
                }
                const sqldb = new sqldb_1.SqlDb(req.app);
                yield sqldb.saveWorkspaceStorage('project-doc-library', workspaceKey, JSON.stringify(((_b = req.body) === null || _b === void 0 ? void 0 : _b.payload) || req.body || {}), 'system');
                const result = yield _a.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] });
                return res.status(200).json({ data: result });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'post',
        path: '/api/firewire/storage/project-doc-library/:workspaceKey/files',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            uploadDocLibraryFileToMemory(req, res, (err) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e, _f, _g, _h;
                try {
                    if (err instanceof multer_1.default.MulterError) {
                        return res.status(400).json({ message: err.message });
                    }
                    if (err) {
                        return res.status(500).json({ message: err.message || err });
                    }
                    const workspaceKey = String(req.params.workspaceKey || '').trim();
                    if (!workspaceKey) {
                        return res.status(400).json({ message: 'workspaceKey is required.' });
                    }
                    if (!((_c = (_b = req.file) === null || _b === void 0 ? void 0 : _b.buffer) === null || _c === void 0 ? void 0 : _c.length)) {
                        return res.status(400).json({ message: 'file is required.' });
                    }
                    const storage = new azure_blob_document_storage_1.AzureBlobDocumentStorage();
                    if (!storage.isConfigured()) {
                        return res.status(500).json({
                            message: 'Azure Blob Storage is not configured. Set FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING.'
                        });
                    }
                    const fileId = _a.resolveUploadField((_d = req.body) === null || _d === void 0 ? void 0 : _d.fileId) || _a.createClientSafeId('doc');
                    const versionId = _a.resolveUploadField((_e = req.body) === null || _e === void 0 ? void 0 : _e.versionId) || _a.createClientSafeId('ver');
                    const folderId = _a.resolveUploadField((_f = req.body) === null || _f === void 0 ? void 0 : _f.folderId) || 'unfiled';
                    const versionNumber = Number(_a.resolveUploadField((_g = req.body) === null || _g === void 0 ? void 0 : _g.versionNumber) || 1);
                    const uploadedAt = new Date().toISOString();
                    const safeName = _a.sanitizeBlobPathSegment(req.file.originalname || 'document');
                    const blobName = [
                        'project-doc-library',
                        _a.sanitizeBlobPathSegment(workspaceKey),
                        _a.sanitizeBlobPathSegment(fileId),
                        `${String(versionNumber).padStart(4, '0')}-${_a.sanitizeBlobPathSegment(versionId)}-${safeName}`
                    ].join('/');
                    yield storage.upload({
                        buffer: req.file.buffer,
                        containerName: workspaceKey,
                        blobName,
                        contentType: req.file.mimetype || 'application/octet-stream',
                        metadata: {
                            workspaceKey,
                            fileId,
                            versionId,
                            folderId
                        }
                    });
                    return res.status(200).json({
                        data: {
                            id: versionId,
                            versionNumber,
                            uploadedAt,
                            uploadedBy: 'Current User',
                            sourceFileName: req.file.originalname,
                            sizeBytes: req.file.size,
                            mimeType: req.file.mimetype || 'application/octet-stream',
                            lastModified: Number(_a.resolveUploadField((_h = req.body) === null || _h === void 0 ? void 0 : _h.lastModified) || Date.now()),
                            blobContainerName: storage.getProjectContainerName(workspaceKey),
                            blobName
                        }
                    });
                }
                catch (uploadErr) {
                    return res.status(500).json({
                        message: uploadErr && uploadErr.message ? uploadErr.message : uploadErr
                    });
                }
            }));
        })
    },
    {
        method: 'get',
        path: '/api/firewire/storage/project-doc-library/:workspaceKey/files/:fileId/versions/:versionId/content',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            var _b, _c;
            try {
                const workspaceKey = String(req.params.workspaceKey || '').trim();
                const fileId = String(req.params.fileId || '').trim();
                const versionId = String(req.params.versionId || '').trim();
                if (!workspaceKey || !fileId || !versionId) {
                    return res.status(400).json({ message: 'workspaceKey, fileId, and versionId are required.' });
                }
                const sqldb = new sqldb_1.SqlDb(req.app);
                const workspace = yield _a.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] });
                const file = Array.isArray((_b = workspace.payload) === null || _b === void 0 ? void 0 : _b.files)
                    ? workspace.payload.files.find((item) => (item === null || item === void 0 ? void 0 : item.id) === fileId)
                    : undefined;
                const version = (_c = file === null || file === void 0 ? void 0 : file.versions) === null || _c === void 0 ? void 0 : _c.find((item) => (item === null || item === void 0 ? void 0 : item.id) === versionId);
                if (!file || !version) {
                    return res.status(404).json({ message: 'Document version was not found.' });
                }
                if (version.blobName) {
                    const storage = new azure_blob_document_storage_1.AzureBlobDocumentStorage();
                    const result = yield storage.download(version.blobContainerName || workspaceKey, version.blobName);
                    res.setHeader('Content-Type', result.contentType);
                    res.setHeader('Content-Disposition', `inline; filename="${_a.escapeHeaderFileName(version.sourceFileName || file.name || 'document')}"`);
                    return res.status(200).send(result.buffer);
                }
                if (version.dataUrl) {
                    const dataUrl = String(version.dataUrl);
                    const commaIndex = dataUrl.indexOf(',');
                    const header = commaIndex >= 0 ? dataUrl.slice(0, commaIndex) : '';
                    const base64 = commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
                    const mimeTypeMatch = header.match(/data:(.*?);base64/);
                    res.setHeader('Content-Type', mimeTypeMatch ? mimeTypeMatch[1] : 'application/octet-stream');
                    res.setHeader('Content-Disposition', `inline; filename="${_a.escapeHeaderFileName(version.sourceFileName || file.name || 'document')}"`);
                    return res.status(200).send(Buffer.from(base64, 'base64'));
                }
                return res.status(404).json({ message: 'Document version content was not found.' });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    {
        method: 'delete',
        path: '/api/firewire/storage/project-doc-library/:workspaceKey/files/:fileId',
        fx: (req, res) => __awaiter(void 0, void 0, void 0, function* () {
            var _b;
            try {
                const workspaceKey = String(req.params.workspaceKey || '').trim();
                const fileId = String(req.params.fileId || '').trim();
                if (!workspaceKey || !fileId) {
                    return res.status(400).json({ message: 'workspaceKey and fileId are required.' });
                }
                const sqldb = new sqldb_1.SqlDb(req.app);
                const workspace = yield _a.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] });
                const files = Array.isArray((_b = workspace.payload) === null || _b === void 0 ? void 0 : _b.files) ? workspace.payload.files : [];
                const file = files.find((item) => (item === null || item === void 0 ? void 0 : item.id) === fileId);
                if (!file) {
                    return res.status(404).json({ message: 'Document file was not found.' });
                }
                const storage = new azure_blob_document_storage_1.AzureBlobDocumentStorage();
                const deletedBlobs = [];
                const missingBlobs = [];
                for (const version of Array.isArray(file.versions) ? file.versions : []) {
                    if (!(version === null || version === void 0 ? void 0 : version.blobName)) {
                        continue;
                    }
                    const deleted = yield storage.deleteIfExists(version.blobContainerName || workspaceKey, version.blobName);
                    if (deleted) {
                        deletedBlobs.push(version.blobName);
                    }
                    else {
                        missingBlobs.push(version.blobName);
                    }
                }
                const nextPayload = Object.assign(Object.assign({}, (workspace.payload || {})), { files: files.filter((item) => (item === null || item === void 0 ? void 0 : item.id) !== fileId) });
                yield sqldb.saveWorkspaceStorage('project-doc-library', workspaceKey, JSON.stringify(nextPayload), 'system');
                const result = yield _a.loadStoredWorkspace(sqldb, 'project-doc-library', workspaceKey, { files: [] });
                return res.status(200).json({
                    data: {
                        payload: result.payload,
                        deletedBlobs,
                        missingBlobs
                    }
                });
            }
            catch (err) {
                return res.status(500).json({
                    message: err && err.message ? err.message : err
                });
            }
        })
    },
    // Get Devices
    {
        method: 'get',
        path: '/api/firewire/devices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDevices();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDevice(deviceId);
                    return res.status(200).json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Delete Device
    {
        method: 'delete',
        path: '/api/firewire/devices/:deviceId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = String(req.params.deviceId || '').trim();
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'deviceId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getDevice(deviceId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Device ${deviceId} not found.`
                        });
                    }
                    const linkedMaterials = (yield sqldb.getDeviceMaterialByDeviceId(deviceId)) || [];
                    const linkedPartNumbers = linkedMaterials
                        .map((material) => String(material.materialPartNumber || material.partNumber || '').trim())
                        .filter(Boolean);
                    const hasProjectWorksheetReference = yield sqldb.isDeviceOrMaterialReferencedByProjectWorksheet({
                        deviceId,
                        partNumbers: [
                            String(existing.partNumber || '').trim(),
                            ...linkedPartNumbers
                        ]
                    });
                    yield sqldb.deleteDeviceMaterialMapsByDeviceId(deviceId);
                    yield sqldb.deleteMaterialAttributesByMaterialId(deviceId);
                    yield sqldb.deleteMaterialSubTasksByMaterialId(deviceId);
                    yield sqldb.deleteDeviceVendorLinkIgnoresByDeviceId(deviceId);
                    yield sqldb.deleteDeviceSetDevicesByDeviceId(deviceId);
                    yield sqldb.deleteDevice(deviceId);
                    const deletedMaterialIds = [];
                    const preservedMaterialIds = [];
                    const cleanupMaterialIds = Array.from(new Set(linkedMaterials
                        .map((material) => String(material.materialId || '').trim())
                        .filter(Boolean)));
                    for (const materialId of cleanupMaterialIds) {
                        const mapCount = yield sqldb.getDeviceMaterialMapCountByMaterialId(materialId);
                        if (mapCount > 0 || hasProjectWorksheetReference) {
                            preservedMaterialIds.push(materialId);
                            continue;
                        }
                        yield sqldb.deleteMaterialAttributesByMaterialId(materialId);
                        yield sqldb.deleteMaterialSubTasksByMaterialId(materialId);
                        yield sqldb.deleteMaterial(materialId);
                        deletedMaterialIds.push(materialId);
                    }
                    return res.status(200).json({
                        data: {
                            deviceId,
                            deletedMaterialIds,
                            preservedMaterialIds
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Update Device Detail
    {
        method: 'put',
        path: '/api/firewire/devices/:deviceId/detail',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16;
                try {
                    const deviceId = String(req.params.deviceId || '').trim();
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'deviceId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getDevice(deviceId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Device ${deviceId} not found.`
                        });
                    }
                    const vendorId = String(((_c = (_b = req.body) === null || _b === void 0 ? void 0 : _b.device) === null || _c === void 0 ? void 0 : _c.vendorId) || existing.vendorId || '').trim();
                    const categoryId = String(((_e = (_d = req.body) === null || _d === void 0 ? void 0 : _d.device) === null || _e === void 0 ? void 0 : _e.categoryId) || existing.categoryId || '').trim();
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    yield sqldb.updateDevice({
                        deviceId,
                        name: String(((_g = (_f = req.body) === null || _f === void 0 ? void 0 : _f.device) === null || _g === void 0 ? void 0 : _g.name) || existing.name || '').trim(),
                        shortName: String(((_j = (_h = req.body) === null || _h === void 0 ? void 0 : _h.device) === null || _j === void 0 ? void 0 : _j.shortName) || existing.shortName || '').trim(),
                        vendorId,
                        categoryId,
                        partNumber: String(((_l = (_k = req.body) === null || _k === void 0 ? void 0 : _k.device) === null || _l === void 0 ? void 0 : _l.partNumber) || existing.partNumber || '').trim(),
                        link: String(((_o = (_m = req.body) === null || _m === void 0 ? void 0 : _m.device) === null || _o === void 0 ? void 0 : _o.link) || '').trim(),
                        cost: Number((_s = (_r = (_q = (_p = req.body) === null || _p === void 0 ? void 0 : _p.device) === null || _q === void 0 ? void 0 : _q.cost) !== null && _r !== void 0 ? _r : existing.cost) !== null && _s !== void 0 ? _s : 0),
                        defaultLabor: Number((_w = (_v = (_u = (_t = req.body) === null || _t === void 0 ? void 0 : _t.device) === null || _u === void 0 ? void 0 : _u.defaultLabor) !== null && _v !== void 0 ? _v : existing.defaultLabor) !== null && _w !== void 0 ? _w : 0),
                        laborRate: Number((_0 = (_z = (_y = (_x = req.body) === null || _x === void 0 ? void 0 : _x.device) === null || _y === void 0 ? void 0 : _y.laborRate) !== null && _z !== void 0 ? _z : existing.laborRate) !== null && _0 !== void 0 ? _0 : 56),
                        slcAddress: String(((_2 = (_1 = req.body) === null || _1 === void 0 ? void 0 : _1.device) === null || _2 === void 0 ? void 0 : _2.slcAddress) || '').trim(),
                        serialNumber: String(((_4 = (_3 = req.body) === null || _3 === void 0 ? void 0 : _3.device) === null || _4 === void 0 ? void 0 : _4.serialNumber) || '').trim(),
                        strobeAddress: String(((_6 = (_5 = req.body) === null || _5 === void 0 ? void 0 : _5.device) === null || _6 === void 0 ? void 0 : _6.strobeAddress) || '').trim(),
                        speakerAddress: String(((_8 = (_7 = req.body) === null || _7 === void 0 ? void 0 : _7.device) === null || _8 === void 0 ? void 0 : _8.speakerAddress) || '').trim()
                    });
                    const desiredPartNumbers = Array.isArray((_9 = req.body) === null || _9 === void 0 ? void 0 : _9.partNumbers)
                        ? Array.from(new Set(req.body.partNumbers
                            .map((value) => String(value || '').trim())
                            .filter((value) => !!value)))
                        : [];
                    yield _a.ensureCategoriesExistForVendorPartNumbers(sqldb, vendor, [
                        String(((_11 = (_10 = req.body) === null || _10 === void 0 ? void 0 : _10.device) === null || _11 === void 0 ? void 0 : _11.partNumber) || existing.partNumber || '').trim()
                    ]);
                    const materialIds = [];
                    for (const partNumber of desiredPartNumbers) {
                        let material = yield sqldb.getMaterialByVendorAndPartNumber(vendorId, partNumber);
                        if (!material) {
                            const partRecord = yield _a.resolveVendorPartRecord(sqldb, vendor, partNumber);
                            if (!partRecord) {
                                return res.status(400).json({
                                    message: `Part ${partNumber} does not exist in the configured vendor source for ${vendor.name}.`
                                });
                            }
                            yield sqldb.createMaterial({
                                materialId: '',
                                name: String(partRecord.LongDescription || partNumber),
                                shortName: partNumber,
                                vendorId,
                                categoryId,
                                partNumber,
                                link: '',
                                cost: Number(partRecord.SalesPrice || partRecord.MSRPPrice || existing.cost || 0),
                                defaultLabor: Number(existing.defaultLabor || 0),
                                slcAddress: '',
                                serialNumber: '',
                                strobeAddress: '',
                                speakerAddress: ''
                            });
                            material = yield sqldb.getMaterialByVendorAndPartNumber(vendorId, partNumber);
                        }
                        if (material === null || material === void 0 ? void 0 : material.materialId) {
                            materialIds.push(material.materialId);
                        }
                    }
                    yield sqldb.deleteDeviceMaterialMapsByDeviceId(deviceId);
                    for (const materialId of materialIds) {
                        yield sqldb.createDeviceMaterialMap(deviceId, materialId);
                    }
                    yield sqldb.deleteMaterialAttributesByMaterialId(deviceId);
                    const attributes = Array.isArray((_12 = req.body) === null || _12 === void 0 ? void 0 : _12.attributes) ? req.body.attributes : [];
                    for (let index = 0; index < attributes.length; index++) {
                        const attribute = attributes[index];
                        const name = String((attribute === null || attribute === void 0 ? void 0 : attribute.name) || '').trim();
                        if (!name) {
                            continue;
                        }
                        yield sqldb.createMaterialAttribute({
                            materialAttributeId: '',
                            name,
                            statusId: String((attribute === null || attribute === void 0 ? void 0 : attribute.statusId) || name).trim(),
                            materialId: deviceId,
                            projectId: '',
                            valueType: String((attribute === null || attribute === void 0 ? void 0 : attribute.valueType) || 'text').trim(),
                            defaultValue: String((attribute === null || attribute === void 0 ? void 0 : attribute.defaultValue) || '').trim(),
                            ordinal: Number((_13 = attribute === null || attribute === void 0 ? void 0 : attribute.ordinal) !== null && _13 !== void 0 ? _13 : index),
                            toBeValue: null
                        });
                    }
                    yield sqldb.deleteMaterialSubTasksByMaterialId(deviceId);
                    const subTasks = Array.isArray((_14 = req.body) === null || _14 === void 0 ? void 0 : _14.subTasks) ? req.body.subTasks : [];
                    for (let index = 0; index < subTasks.length; index++) {
                        const subTask = subTasks[index];
                        const statusName = String((subTask === null || subTask === void 0 ? void 0 : subTask.statusName) || '').trim();
                        if (!statusName) {
                            continue;
                        }
                        yield sqldb.createMaterialSubTask({
                            materialSubTaskId: '',
                            materialId: deviceId,
                            statusName,
                            taskNameFormat: String((subTask === null || subTask === void 0 ? void 0 : subTask.taskNameFormat) || '').trim(),
                            laborHours: Number((_15 = subTask === null || subTask === void 0 ? void 0 : subTask.laborHours) !== null && _15 !== void 0 ? _15 : 0),
                            ordinal: Number((_16 = subTask === null || subTask === void 0 ? void 0 : subTask.ordinal) !== null && _16 !== void 0 ? _16 : index),
                            projectId: '',
                            org: ''
                        });
                    }
                    const updated = yield sqldb.getDevice(deviceId);
                    return res.status(200).json({
                        data: updated
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Devices
    {
        method: 'get',
        path: '/api/firewire/vwdevices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwDevices();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Sets
    {
        method: 'get',
        path: '/api/firewire/device-sets',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield _a.buildDeviceSetSummaries(sqldb);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Set Membership Summary
    {
        method: 'get',
        path: '/api/firewire/device-sets/device-membership-summary',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const rows = yield sqldb.getDeviceSetDevices();
                    const counts = new Map();
                    for (const row of rows) {
                        const deviceId = String(row.deviceId || '').trim();
                        if (!deviceId) {
                            continue;
                        }
                        counts.set(deviceId, (counts.get(deviceId) || 0) + 1);
                    }
                    return res.status(200).json({
                        rows: Array.from(counts.entries()).map(([deviceId, deviceSetCount]) => ({
                            deviceId,
                            deviceSetCount
                        }))
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Create Device Set
    {
        method: 'post',
        path: '/api/firewire/device-sets',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const name = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.name) || '').trim();
                    if (!name) {
                        return res.status(400).json({
                            message: 'name is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const deviceSetId = yield sqldb.createDeviceSet({
                        name,
                        createdBy: 'device-sets'
                    });
                    const result = yield _a.buildDeviceSetDetail(sqldb, deviceSetId);
                    return res.status(201).json({
                        data: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Set Detail
    {
        method: 'get',
        path: '/api/firewire/device-sets/:deviceSetId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceSetId = String(req.params.deviceSetId || '').trim();
                    if (!deviceSetId) {
                        return res.status(400).json({
                            message: 'deviceSetId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield _a.buildDeviceSetDetail(sqldb, deviceSetId);
                    if (!result) {
                        return res.status(404).json({
                            message: `Device Set ${deviceSetId} not found.`
                        });
                    }
                    return res.status(200).json({
                        data: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Update Device Set
    {
        method: 'patch',
        path: '/api/firewire/device-sets/:deviceSetId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const deviceSetId = String(req.params.deviceSetId || '').trim();
                    const name = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.name) || '').trim();
                    if (!deviceSetId || !name) {
                        return res.status(400).json({
                            message: 'deviceSetId and name are required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getDeviceSet(deviceSetId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Device Set ${deviceSetId} not found.`
                        });
                    }
                    yield sqldb.updateDeviceSet({
                        deviceSetId,
                        name,
                        updatedBy: 'device-sets'
                    });
                    const result = yield _a.buildDeviceSetDetail(sqldb, deviceSetId);
                    return res.status(200).json({
                        data: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Replace Device Set Devices
    {
        method: 'put',
        path: '/api/firewire/device-sets/:deviceSetId/devices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const deviceSetId = String(req.params.deviceSetId || '').trim();
                    if (!deviceSetId) {
                        return res.status(400).json({
                            message: 'deviceSetId is required.'
                        });
                    }
                    const deviceIds = Array.isArray((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceIds)
                        ? Array.from(new Set(req.body.deviceIds
                            .map((value) => String(value || '').trim())
                            .filter((value) => !!value)))
                        : [];
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getDeviceSet(deviceSetId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Device Set ${deviceSetId} not found.`
                        });
                    }
                    const allDevices = yield sqldb.getVwDevices();
                    const invalidDeviceIds = deviceIds.filter((deviceId) => !allDevices.some((row) => row.deviceId === deviceId));
                    if (invalidDeviceIds.length > 0) {
                        return res.status(400).json({
                            message: `Unknown device ids: ${invalidDeviceIds.join(', ')}`
                        });
                    }
                    yield sqldb.replaceDeviceSetDevices(deviceSetId, deviceIds, 'device-sets');
                    const result = yield _a.buildDeviceSetDetail(sqldb, deviceSetId);
                    return res.status(200).json({
                        data: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Delete Device Set
    {
        method: 'delete',
        path: '/api/firewire/device-sets/:deviceSetId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceSetId = String(req.params.deviceSetId || '').trim();
                    if (!deviceSetId) {
                        return res.status(400).json({
                            message: 'deviceSetId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getDeviceSet(deviceSetId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Device Set ${deviceSetId} not found.`
                        });
                    }
                    yield sqldb.deleteDeviceSet(deviceSetId);
                    return res.status(200).json({
                        data: {
                            deviceSetId
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Reconcile Device Vendor Part Links
    {
        method: 'get',
        path: '/api/firewire/devices/vendor-link-issues',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const state = String(((_b = req.query) === null || _b === void 0 ? void 0 : _b.state) || 'active').trim().toLowerCase();
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const issues = yield _a.buildDeviceVendorLinkIssues(sqldb);
                    const filtered = issues.filter((issue) => {
                        if (state === 'ignored') {
                            return issue.ignored;
                        }
                        if (state === 'all') {
                            return true;
                        }
                        return !issue.ignored;
                    });
                    return res.status(200).json({
                        rows: filtered,
                        summary: {
                            active: issues.filter((issue) => !issue.ignored).length,
                            ignored: issues.filter((issue) => issue.ignored).length
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Ignore Device Vendor Part Link Issue
    {
        method: 'post',
        path: '/api/firewire/devices/vendor-link-issues/ignore',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e, _f;
                try {
                    const deviceId = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceId) || '').trim();
                    const vendorId = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.vendorId) || '').trim();
                    const partNumber = String(((_d = req.body) === null || _d === void 0 ? void 0 : _d.partNumber) || '').trim();
                    const sourceKind = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.sourceKind) || '').trim();
                    const reason = String(((_f = req.body) === null || _f === void 0 ? void 0 : _f.reason) || '').trim();
                    if (!deviceId || !vendorId || !partNumber || !sourceKind) {
                        return res.status(400).json({
                            message: 'deviceId, vendorId, partNumber, and sourceKind are required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const ignoreId = yield sqldb.createDeviceVendorLinkIgnore({
                        deviceId,
                        vendorId,
                        partNumber,
                        sourceKind,
                        reason: reason || null,
                        createdBy: 'system'
                    });
                    return res.status(201).json({
                        data: {
                            ignoreId
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Unignore Device Vendor Part Link Issue
    {
        method: 'post',
        path: '/api/firewire/devices/vendor-link-issues/unignore',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e;
                try {
                    const deviceId = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceId) || '').trim();
                    const vendorId = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.vendorId) || '').trim();
                    const partNumber = String(((_d = req.body) === null || _d === void 0 ? void 0 : _d.partNumber) || '').trim();
                    const sourceKind = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.sourceKind) || '').trim();
                    if (!deviceId || !vendorId || !partNumber || !sourceKind) {
                        return res.status(400).json({
                            message: 'deviceId, vendorId, partNumber, and sourceKind are required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    yield sqldb.removeDeviceVendorLinkIgnore({
                        deviceId,
                        vendorId,
                        partNumber,
                        sourceKind
                    });
                    return res.status(200).json({
                        data: true
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Device Materials
    {
        method: 'get',
        path: '/api/firewire/vwdevicematerials',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwDeviceMaterials();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Device Materials by Device Id
    {
        method: 'get',
        path: '/api/firewire/vwdevicematerials/:deviceId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDeviceMaterialByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Attributes by Device Id
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId/attributes',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getMaterialAttributesByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Sub Tasks by Device Id
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId/subtasks',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getMaterialSubTasksByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Materials
    {
        method: 'get',
        path: '/api/firewire/vwmaterials',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwMaterials();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Categories
    {
        method: 'get',
        path: '/api/firewire/categories',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getCategories();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Category
    {
        method: 'get',
        path: '/api/firewire/categories/:categoryId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const categoryId = String(req.params.categoryId || '').trim();
                    if (!categoryId) {
                        return res.status(400).json({
                            message: 'categoryId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getCategoryById(categoryId);
                    if (!result) {
                        return res.status(404).json({
                            message: `Category ${categoryId} not found.`
                        });
                    }
                    return res.status(200).json({
                        data: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Devices Using Category
    {
        method: 'get',
        path: '/api/firewire/categories/:categoryId/devices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const categoryId = String(req.params.categoryId || '').trim();
                    if (!categoryId) {
                        return res.status(400).json({
                            message: 'categoryId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const devices = yield sqldb.getVwDevices();
                    return res.status(200).json({
                        rows: devices.filter((row) => String(row.categoryId || '').trim() === categoryId)
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Update Category
    {
        method: 'patch',
        path: '/api/firewire/categories/:categoryId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
                try {
                    const categoryId = String(req.params.categoryId || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.categoryId) || '').trim();
                    if (!categoryId) {
                        return res.status(400).json({
                            message: 'categoryId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getCategoryById(categoryId);
                    if (!existing) {
                        return res.status(404).json({
                            message: `Category ${categoryId} not found.`
                        });
                    }
                    const name = String(((_c = req.body) === null || _c === void 0 ? void 0 : _c.name) || existing.name || '').trim();
                    const shortName = String(((_d = req.body) === null || _d === void 0 ? void 0 : _d.shortName) || existing.shortName || '').trim();
                    const handle = String(((_e = req.body) === null || _e === void 0 ? void 0 : _e.handle) || existing.handle || '').trim();
                    const defaultLabor = ((_f = req.body) === null || _f === void 0 ? void 0 : _f.defaultLabor) === null || typeof ((_g = req.body) === null || _g === void 0 ? void 0 : _g.defaultLabor) === 'undefined' || ((_h = req.body) === null || _h === void 0 ? void 0 : _h.defaultLabor) === ''
                        ? null
                        : Number(req.body.defaultLabor);
                    const includeOnFloorplan = !!((_j = req.body) === null || _j === void 0 ? void 0 : _j.includeOnFloorplan);
                    const slcAddress = String((_m = (_l = (_k = req.body) === null || _k === void 0 ? void 0 : _k.slcAddress) !== null && _l !== void 0 ? _l : existing.slcAddress) !== null && _m !== void 0 ? _m : '').trim();
                    const speakerAddress = String((_q = (_p = (_o = req.body) === null || _o === void 0 ? void 0 : _o.speakerAddress) !== null && _p !== void 0 ? _p : existing.speakerAddress) !== null && _q !== void 0 ? _q : '').trim();
                    const strobeAddress = String((_t = (_s = (_r = req.body) === null || _r === void 0 ? void 0 : _r.strobeAddress) !== null && _s !== void 0 ? _s : existing.strobeAddress) !== null && _t !== void 0 ? _t : '').trim();
                    if (!name || !shortName || !handle) {
                        return res.status(400).json({
                            message: 'name, shortName, and handle are required.'
                        });
                    }
                    if (handle.length > 10) {
                        return res.status(400).json({
                            message: 'handle must be 10 characters or fewer.'
                        });
                    }
                    const allCategories = yield sqldb.getCategories();
                    const duplicate = allCategories.find((row) => row.categoryId !== categoryId &&
                        String(row.handle || '').trim().toLowerCase() === handle.toLowerCase());
                    if (duplicate) {
                        return res.status(409).json({
                            message: `Handle ${handle} is already used by category ${duplicate.name}.`
                        });
                    }
                    yield sqldb.updateCategory(Object.assign(Object.assign({}, existing), { categoryId,
                        name,
                        shortName,
                        handle,
                        defaultLabor,
                        includeOnFloorplan,
                        slcAddress,
                        speakerAddress,
                        strobeAddress, updateby: 'category-grid-edit' }));
                    return res.status(200).json({
                        data: {
                            categoryId,
                            name,
                            shortName,
                            handle,
                            defaultLabor,
                            includeOnFloorplan,
                            slcAddress,
                            speakerAddress,
                            strobeAddress
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Delete Category
    {
        method: 'delete',
        path: '/api/firewire/categories/:categoryId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const categoryId = String(req.params.categoryId || '').trim();
                    if (!categoryId) {
                        return res.status(400).json({
                            message: 'categoryId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const categories = yield sqldb.getCategories();
                    const existing = categories.find((row) => String(row.categoryId || '').trim() === categoryId) || null;
                    if (!existing) {
                        return res.status(404).json({
                            message: `Category ${categoryId} not found.`
                        });
                    }
                    const [devices, materials] = yield Promise.all([sqldb.getVwDevices(), sqldb.getMaterials()]);
                    const deviceCount = devices.filter((row) => String(row.categoryId || '').trim() === categoryId).length;
                    const materialCount = materials.filter((row) => String(row.categoryId || '').trim() === categoryId).length;
                    if (deviceCount > 0 || materialCount > 0) {
                        return res.status(409).json({
                            message: `Category ${existing.name} is still in use by ${deviceCount} devices and ${materialCount} materials.`
                        });
                    }
                    yield sqldb.deleteCategory(categoryId);
                    return res.status(200).json({
                        data: {
                            categoryId
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Reconcile Categories Used By Device parts
    {
        method: 'post',
        path: '/api/firewire/categories/reconcile',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield _a.reconcileCategoriesFromDeviceParts(sqldb);
                    return res.status(200).json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Vendors
    {
        method: 'get',
        path: '/api/firewire/vendors',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVendors();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Update Vendor
    {
        method: 'patch',
        path: '/api/firewire/vendors/:vendorId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
                try {
                    const vendorId = String(req.params.vendorId || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.vendorId) || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const existing = yield sqldb.getVendors();
                    const vendor = existing.find((row) => row.vendorId === vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    yield sqldb.updateVendor({
                        vendorId,
                        name: String((_e = (_d = (_c = req.body) === null || _c === void 0 ? void 0 : _c.name) !== null && _d !== void 0 ? _d : vendor.name) !== null && _e !== void 0 ? _e : ''),
                        desc: String((_h = (_g = (_f = req.body) === null || _f === void 0 ? void 0 : _f.desc) !== null && _g !== void 0 ? _g : vendor.desc) !== null && _h !== void 0 ? _h : ''),
                        link: String((_l = (_k = (_j = req.body) === null || _j === void 0 ? void 0 : _j.link) !== null && _k !== void 0 ? _k : vendor.link) !== null && _l !== void 0 ? _l : ''),
                        importConfigJson: (_m = vendor.importConfigJson) !== null && _m !== void 0 ? _m : null,
                        logoFileName: (_o = vendor.logoFileName) !== null && _o !== void 0 ? _o : null,
                        logoDataUrl: (_p = vendor.logoDataUrl) !== null && _p !== void 0 ? _p : null
                    });
                    return res.status(200).json({
                        data: {
                            vendorId,
                            name: String((_s = (_r = (_q = req.body) === null || _q === void 0 ? void 0 : _q.name) !== null && _r !== void 0 ? _r : vendor.name) !== null && _s !== void 0 ? _s : ''),
                            desc: String((_v = (_u = (_t = req.body) === null || _t === void 0 ? void 0 : _t.desc) !== null && _u !== void 0 ? _u : vendor.desc) !== null && _v !== void 0 ? _v : ''),
                            link: String((_y = (_x = (_w = req.body) === null || _w === void 0 ? void 0 : _w.link) !== null && _x !== void 0 ? _x : vendor.link) !== null && _y !== void 0 ? _y : ''),
                            logoFileName: (_z = vendor.logoFileName) !== null && _z !== void 0 ? _z : null,
                            logoDataUrl: (_0 = vendor.logoDataUrl) !== null && _0 !== void 0 ? _0 : null
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Upload Vendor Logo
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/logo',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const file = yield _a.getVendorLogoUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    if (!String(file.mimetype || '').startsWith('image/')) {
                        return res.status(400).json({
                            message: 'Vendor logo must be an image file.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    const logoDataUrl = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
                    yield sqldb.updateVendorLogo(vendorId, String(file.originalname || 'vendor-logo'), logoDataUrl);
                    return res.status(200).json({
                        data: {
                            vendorId,
                            logoFileName: String(file.originalname || 'vendor-logo'),
                            logoDataUrl
                        }
                    });
                }
                catch (err) {
                    return res.status(err instanceof multer_1.default.MulterError ? 400 : 500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Vendor Import Config
    {
        method: 'get',
        path: '/api/firewire/vendors/:vendorId/import-config',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    const resolved = yield _a.resolveVendorImportConfig(sqldb, vendor);
                    if (!resolved.config) {
                        return res.status(404).json({
                            message: `No import configuration exists for vendor ${vendor.name}.`
                        });
                    }
                    return res.status(200).json({
                        data: resolved.config,
                        seeded: resolved.seeded
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Update Vendor Import Config
    {
        method: 'patch',
        path: '/api/firewire/vendors/:vendorId/import-config',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const rawConfig = (_b = req.body) === null || _b === void 0 ? void 0 : _b.config;
                    if (!vendorId || !rawConfig || typeof rawConfig !== 'object') {
                        return res.status(400).json({
                            message: 'vendorId and config object are required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    const config = _a.sanitizeVendorImportConfig(rawConfig);
                    yield sqldb.updateVendorImportConfig(vendorId, JSON.stringify(config, null, 2));
                    return res.status(200).json({
                        data: config
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get master parts
    {
        method: 'get',
        path: '/api/firewire/parts',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getParts();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get master parts by Part Number
    {
        method: 'get',
        path: '/api/firewire/parts/:partNumber',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const partNumber = req.params.partNumber;
                    if (!partNumber) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing partNumber parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getPartByPartNumber(partNumber);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get vendor parts
    {
        method: 'get',
        path: '/api/firewire/vendors/:vendorId/parts',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({ message: 'vendorId is required.' });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({ message: `Vendor ${vendorId} not found.` });
                    }
                    const result = yield sqldb.getPartsByVendor(vendorId);
                    return res.status(200).json({ rows: result });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get generic vendor part by part number
    {
        method: 'get',
        path: '/api/firewire/vendors/:vendorId/parts/:partNumber',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const partNumber = String(req.params.partNumber || '').trim();
                    if (!vendorId || !partNumber) {
                        return res.status(400).json({ message: 'vendorId and partNumber are required.' });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getPartByVendorAndPartNumber(vendorId, partNumber);
                    return res.status(200).json({ rows: result });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Create Device using generic vendor part
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/parts/:partNumber/create-device',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const partNumber = String(req.params.partNumber || '').trim();
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({ message: `Vendor ${vendorId} not found.` });
                    }
                    const rows = yield sqldb.getPartByVendorAndPartNumber(vendorId, partNumber);
                    const part = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                    if (!part) {
                        return res.status(404).json({ message: `Part ${partNumber} not found for ${vendor.name}.` });
                    }
                    const data = yield _a.createDeviceFromVendorPart(sqldb, vendor, partNumber, part, req.body);
                    return res.status(201).json({ data });
                }
                catch (err) {
                    const status = err && Number(err.status) ? Number(err.status) : 500;
                    return res.status(status).json({
                        message: err && err.message ? err.message : err,
                        data: err && err.data ? err.data : undefined
                    });
                }
            }));
        }
    },
    // Add generic vendor part to existing device
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/parts/:partNumber/add-to-device',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const partNumber = String(req.params.partNumber || '').trim();
                    const deviceId = String(((_b = req.body) === null || _b === void 0 ? void 0 : _b.deviceId) || '').trim();
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({ message: `Vendor ${vendorId} not found.` });
                    }
                    const rows = yield sqldb.getPartByVendorAndPartNumber(vendorId, partNumber);
                    const part = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
                    if (!part) {
                        return res.status(404).json({ message: `Part ${partNumber} not found for ${vendor.name}.` });
                    }
                    const data = yield _a.addVendorPartToExistingDevice(sqldb, vendor, partNumber, part, deviceId);
                    return res.status(data.createdMap ? 201 : 200).json({ data });
                }
                catch (err) {
                    const status = err && Number(err.status) ? Number(err.status) : 500;
                    return res.status(status).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Preview Vendor parts Import
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/parts-import/preview',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const file = yield _a.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    const normalized = yield _a.buildNormalizedImportResult(sqldb, vendor, file.originalname, file.buffer);
                    return res.status(200).json({
                        data: normalized.preview
                    });
                }
                catch (err) {
                    return res.status(err instanceof multer_1.default.MulterError ? 400 : 500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Execute Vendor parts Import
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/parts-import',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const file = yield _a.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const vendor = yield sqldb.getVendorById(vendorId);
                    if (!vendor) {
                        return res.status(404).json({
                            message: `Vendor ${vendorId} not found.`
                        });
                    }
                    const normalized = yield _a.buildNormalizedImportResult(sqldb, vendor, file.originalname, file.buffer);
                    if (!normalized.preview.valid) {
                        return res.status(400).json({
                            message: 'Import verification failed.',
                            data: normalized.preview
                        });
                    }
                    if (normalized.config.targetTable !== 'parts') {
                        return res.status(400).json({
                            message: `Unsupported target table ${normalized.config.targetTable}.`
                        });
                    }
                    const existingRows = yield sqldb.getRawPartsByVendor(vendorId);
                    const snapshotId = yield sqldb.createVendorImportSnapshot({
                        vendorId,
                        targetTable: normalized.config.targetTable,
                        fileName: file.originalname,
                        rowCount: existingRows.length,
                        summaryJson: JSON.stringify({
                            action: 'pre-import-backup',
                            fileName: file.originalname,
                            importedRowCount: normalized.preview.rowCount,
                            createdAt: new Date().toISOString()
                        }),
                        rowsJson: JSON.stringify(existingRows),
                        createdBy: 'system'
                    });
                    yield sqldb.replacePartsForVendor(vendorId, normalized.normalizedRows);
                    const runId = yield sqldb.createVendorImportRun({
                        vendorId,
                        targetTable: normalized.config.targetTable,
                        fileName: file.originalname,
                        snapshotId,
                        action: 'import',
                        rowCount: normalized.normalizedRows.length,
                        createdBy: 'system',
                        notesJson: JSON.stringify({
                            preview: normalized.preview
                        })
                    });
                    return res.status(201).json({
                        data: {
                            runId,
                            snapshotId,
                            insertedRowCount: normalized.normalizedRows.length,
                            preview: normalized.preview
                        }
                    });
                }
                catch (err) {
                    return res.status(err instanceof multer_1.default.MulterError ? 400 : 500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Preview All Vendor Parts Workbook Import
    {
        method: 'post',
        path: '/api/firewire/parts-import/workbook/preview',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const file = yield _a.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield _a.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, false);
                    return res.status(200).json({ data: result });
                }
                catch (err) {
                    return res.status(err instanceof multer_1.default.MulterError ? 400 : 500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Execute All Vendor Parts Workbook Import
    {
        method: 'post',
        path: '/api/firewire/parts-import/workbook',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const file = yield _a.getUpload(req, res);
                    if (!file) {
                        return res.status(400).json({
                            message: 'Invalid payload: missing file form field.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const preview = yield _a.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, false);
                    if (!preview.valid) {
                        return res.status(400).json({
                            message: 'Workbook import verification failed.',
                            data: preview
                        });
                    }
                    const result = yield _a.buildBulkPartsWorkbookResult(sqldb, file.originalname, file.buffer, true);
                    return res.status(201).json({ data: result });
                }
                catch (err) {
                    return res.status(err instanceof multer_1.default.MulterError ? 400 : 500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Vendor parts Import Snapshots
    {
        method: 'get',
        path: '/api/firewire/vendors/:vendorId/parts-import-snapshots',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const targetTable = _a.normalizePartsTargetTable((_b = req.query) === null || _b === void 0 ? void 0 : _b.targetTable);
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const snapshots = yield sqldb.getVendorImportSnapshots(vendorId, targetTable);
                    return res.status(200).json({
                        rows: snapshots.map((row) => ({
                            snapshotId: row.snapshotId,
                            vendorId: row.vendorId,
                            targetTable: row.targetTable,
                            fileName: row.fileName,
                            rowCount: row.rowCount,
                            createdAt: row.createdAt,
                            createdBy: row.createdBy,
                            summary: _a.safeJsonParse(row.summaryJson)
                        }))
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Vendor parts Import Status
    {
        method: 'get',
        path: '/api/firewire/vendors/:vendorId/parts-import-status',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                var _b;
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const targetTable = _a.normalizePartsTargetTable((_b = req.query) === null || _b === void 0 ? void 0 : _b.targetTable);
                    if (!vendorId) {
                        return res.status(400).json({
                            message: 'vendorId is required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const latestRun = yield sqldb.getLatestVendorImportRun(vendorId, targetTable);
                    return res.status(200).json({
                        data: latestRun ? Object.assign(Object.assign({}, latestRun), { notes: _a.safeJsonParse(latestRun.notesJson || '') }) : null
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Restore Vendor parts Import Snapshot
    {
        method: 'post',
        path: '/api/firewire/vendors/:vendorId/parts-import-snapshots/:snapshotId/restore',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const vendorId = String(req.params.vendorId || '').trim();
                    const snapshotId = String(req.params.snapshotId || '').trim();
                    if (!vendorId || !snapshotId) {
                        return res.status(400).json({
                            message: 'vendorId and snapshotId are required.'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const snapshot = yield sqldb.getVendorImportSnapshot(snapshotId);
                    if (!snapshot || snapshot.vendorId !== vendorId) {
                        return res.status(404).json({
                            message: `Snapshot ${snapshotId} not found for vendor ${vendorId}.`
                        });
                    }
                    if (snapshot.targetTable !== 'parts') {
                        return res.status(400).json({
                            message: `Unsupported restore target ${snapshot.targetTable}.`
                        });
                    }
                    const rows = _a.safeJsonParse(snapshot.rowsJson);
                    if (!Array.isArray(rows)) {
                        return res.status(500).json({
                            message: 'Snapshot payload is invalid.'
                        });
                    }
                    yield sqldb.replacePartsForVendor(vendorId, rows);
                    const runId = yield sqldb.createVendorImportRun({
                        vendorId,
                        targetTable: snapshot.targetTable,
                        fileName: snapshot.fileName,
                        snapshotId: snapshot.snapshotId,
                        action: 'restore',
                        rowCount: rows.length,
                        createdBy: 'system',
                        notesJson: JSON.stringify({
                            restoredFromSnapshotId: snapshot.snapshotId
                        })
                    });
                    return res.status(200).json({
                        data: {
                            runId,
                            snapshotId,
                            restoredRowCount: rows.length
                        }
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Category Labor
    {
        method: 'get',
        path: '/api/firewire/categorylabors',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getCategoryLabors();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    }
];
FirewireData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => {
    const normalizedMethod = item.method.toLowerCase();
    const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
        ? normalizedMethod
        : 'get';
    return Object.assign(Object.assign({}, item), { method, path: item.path.replace('/api/firewire/', '/api/fieldwire/') });
});
