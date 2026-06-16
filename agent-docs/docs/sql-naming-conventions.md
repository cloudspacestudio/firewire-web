# SQL Naming Conventions

## Table And View Names

New SQL Server tables and views should use lower camel-case names, matching the dominant legacy domain style:

- Tables: `devices`, `materials`, `vendors`, `parts`, `vendorImportRuns`
- Views: `vwDevices`, `vwMaterials`, `vwParts`

Do not introduce Pascal-case table names such as `Users`, `RevokedTokens`, `VendorPriceList`, or `Parts` for new Firewire-owned objects. If a third-party or legacy object already exists with Pascal-case naming, migrate or wrap it deliberately rather than spreading that naming into new code.

## Columns And Audit Fields

Follow the existing table's column style when changing an existing object. Legacy Fieldwire tables use `createat`, `createby`, `updateat`, and `updateby`; newer Firewire tables often use `createdAt`, `createdBy`, `updatedAt`, and `updatedBy`.

Every persistent table must include created/updated audit fields unless it is a pure join table whose surrounding convention explicitly differs.

## Constraints And Indexes

Constraint and index names should include the exact table name casing used in source-controlled DDL, for example `DF_parts_partId` and `IX_parts_vendor_part`.

## Compatibility Names

SQL Server treats column names case-insensitively. Do not put compatibility aliases that differ only by case into a view, such as `parentCategory` and `ParentCategory`. Add API compatibility aliases in TypeScript after rows are loaded.
