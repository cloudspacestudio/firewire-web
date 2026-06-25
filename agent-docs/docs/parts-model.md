# Parts Model

## Canonical Rule

Firewire uses a single master `parts` table for vendor part lists. Do not add vendor-specific part catalog tables, security-part tables, or separate import mechanics for a vendor.

Devices can contain only parts from the master parts list. Device Sets contain devices only. Linked parts shown from devices, device sets, BOM lookups, and price refresh flows should start from `parts`/`vwParts` and then snapshot into `deviceParts` or BOM rows.

## SQL Shape

The source-controlled DDL is `src/workspaces/fieldwire/corpdb/parts.sql`, and the runtime guard is `SqlDb.ensurePartsSchema()`.

Canonical fields:

- `partId`
- `vendorId`
- `sourceVendorName`
- `brand`
- `parentCategory`
- `category`
- `partNumber`
- `description` (`NVARCHAR(2000)`, because vendor descriptions can be long)
- `msrp`
- `cost`
- `minQty`
- `upc`
- `productStatus`
- `agency`
- `countryOfOrigin`
- `rawJson`
- `createat`, `createby`, `updateat`, `updateby`

`msrp` is the retail/customer-facing price. `cost` is the procurement/vendor cost. The UI parts table must show both.

`vwParts` exposes canonical SQL column names only. SQL Server treats column names case-insensitively, so do not add Pascal-case aliases directly to the view. Repository methods add temporary API compatibility aliases (`PartNumber`, `LongDescription`, `MSRPPrice`, `SalesPrice`, etc.) before returning rows. `SalesPrice` maps to `parts.cost`; do not create a new sales-price column.

## Import Flow

Vendor import config, preview, snapshot, restore, and run tracking all target `parts`.

Important endpoints:

- `GET /api/firewire/parts`
- `GET /api/firewire/parts/:partNumber`
- `GET /api/firewire/vendors/:vendorId/parts`
- `GET /api/firewire/vendors/:vendorId/parts/:partNumber`
- `DELETE /api/firewire/vendors/:vendorId/parts/:partNumber`
- `POST /api/firewire/vendors/:vendorId/parts-import/preview`
- `POST /api/firewire/vendors/:vendorId/parts-import`
- `GET /api/firewire/vendors/:vendorId/parts-import-status`
- `GET /api/firewire/vendors/:vendorId/parts-import-snapshots`
- `POST /api/firewire/vendors/:vendorId/parts-import-snapshots/:snapshotId/restore`

Part list category values remain meaningful as imported vendor metadata. When a part is used to create a device, default the device-owned `categoryName` from the part list `category` value. Do not create or match category records; `categoryName` is free text on the device.

Part numbers are identifiers, never money. Vendor imports must treat part number columns as plain text. If Excel has coerced an identifier into a currency-looking value such as `$30,406,002.00`, import normalization should restore it to `30406002` before storing it in `parts.partNumber`.

Deleting a master part deletes only the vendor-scoped row in `parts`. Devices do not directly depend on live `parts` values after composition; when a part is added to a device, the system creates a `deviceParts` snapshot with the part id, vendor id, part number, description, parent category, category, `cost`, `msrp`, and `quantityPerDevice`. Existing `deviceParts` and BOM snapshots should not be changed by deleting a master catalog part.

Device detail vendor-part search is vendor-scoped. The UI should offer an explicit vendor selector, default it to the device's vendor, and search through `GET /api/firewire/vendors/:vendorId/parts`. Category filters in that picker come from the selected vendor's imported part metadata. `vwDeviceMaterials` is now a compatibility view over `deviceParts` and exposes linked vendor ids, part ids, categories, MSRP, cost, and `quantityPerDevice`.

Every vendor can use the default master parts import configuration if no custom config exists. The default accepts CSV and Excel files with these headers: `PART NUMBER`, `DESCRIPTION`, `PARENT CATEGORY`, `CATEGORY`, `MSRP`, `MIN QTY`, `UPC`, and `COST`. Header matching is case-insensitive.

The All Parts import workflow expects an Excel workbook with one vendor per worksheet. The worksheet name must match an existing vendor name, ignoring case and extra whitespace. Matching vendor sheets are imported as if the user imported each vendor individually; sheets without a matching vendor are skipped, and vendors without a matching sheet are preserved unchanged.

## Removed Database Objects

The removed part-import objects are:

- `dbo.EddyProducts`
- `dbo.EddyPricelist`
- `dbo.VendorPriceList`
- `dbo.VendorPricelist`
- `dbo.VwEddyPricelist`
- `dbo.VwVendorPricelist`

The old vendor-specific part objects and legacy category objects have been removed from the development SQL Server. Do not reintroduce cleanup scripts for those one-time migrations unless a new environment explicitly still needs them.
