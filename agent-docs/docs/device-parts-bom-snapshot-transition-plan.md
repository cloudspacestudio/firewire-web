# Device Parts And BOM Snapshot Transition Plan

Status: active validation document. Runtime DDL, backend write paths, device detail editing, BOM snapshot persistence, and legacy seed-device writes have been implemented in source. Keep this document until the database has been exercised end-to-end in the application and any remaining legacy `materials`/`devicematerials` repository methods are either removed or intentionally documented.

## Purpose

Firewire is moving away from using `materials` as a hybrid device/part/BOM object. The target model is:

- `parts` remains the canonical master vendor part repository.
- `devices` remains the reusable operational device definition.
- Device composition is represented by device-owned part links with `quantityPerDevice`.
- BOM rows are point-in-time snapshots created from a device, a part, or free-form user entry.
- Floorplan symbols relate to BOM rows by stable row ids, never by mutable strings such as part number, description, category/type, or floorplan labels.

The user has cleared devices, materials, and projects in the current development database. Vendors and parts remain and should be preserved.

## Current Problem

`materials` currently carries multiple meanings:

- A snapshot of a vendor part linked to a device.
- A reusable material catalog-like object joined through `devicematerials`.
- A carrier for device-adjacent fields such as category, labor, address flags, and display values.
- A dependency used by downstream BOM, floorplan, and device workflows.

This makes later behavior fragile because a row may be treated as a part snapshot in one flow and as device/BOM state in another.

## Target Data Model

### parts

Keep `parts` as the master vendor repository. Parts are imported from vendors and may change over time. Adding a part to a device or BOM snapshots the values needed at that time.

### devices

Keep `devices` as the reusable device definition. A device should no longer imply a single vendor. It can contain parts from multiple vendors through `deviceParts`.

Device fields continue to own operational device behavior:

- `name`
- `shortName`
- `categoryName`
- `includeOnFloorplan`
- `cost`
- `defaultLabor`
- `laborRate`
- address/serial flags
- audit fields

Device `cost` should be an overwritable aggregate of linked device part procurement costs:

`sum(deviceParts.cost * deviceParts.quantityPerDevice)`

Use part `cost`, not MSRP, for this default aggregate.

### deviceParts

Create a new device composition table. Runtime schema guards now create this table with this shape:

- `devicePartId` uniqueidentifier primary key
- `deviceId` uniqueidentifier not null
- `partId` uniqueidentifier null
- `vendorId` uniqueidentifier not null
- `partNumber` nvarchar
- `description` nvarchar(2000)
- `parentCategory` nvarchar
- `category` nvarchar
- `msrp` money/null
- `cost` money/null
- `quantityPerDevice` int not null default 1
- `sortOrder` int/null
- `createat`, `createby`, `updateat`, `updateby`

Rules:

- `quantityPerDevice` defaults to `1`.
- `quantityPerDevice` must be greater than `0`.
- A device may have zero, one, or many device parts.
- Device parts may come from different vendors.
- The row should preserve enough part fields to be a point-in-time snapshot of the linked master part when added to the device.
- Keeping `partId` as an optional reference is useful for traceability, but UI and downstream calculations should use the snapshot columns unless the user explicitly refreshes from the master part.

### BOM rows

BOM rows should become true project worksheet snapshots. They can originate from:

- A device lookup.
- A part lookup.
- Free-form user entry.

Each BOM row should have a durable `bomRowId` or `id`. Suggested fields:

- `bomRowId` uniqueidentifier primary key or stable JSON row id
- `projectId`
- `sectionId`
- `sourceKind` (`device`, `part`, `freeform`)
- `sourceDeviceId` nullable
- `sourcePartId` nullable
- `partNbr`
- `description`
- `quantity`
- `cost`
- `labor`
- `categoryName`/`type`
- `includeOnFloorplan`
- `msrp` nullable
- audit fields when persisted relationally

Rules:

- Once added, the BOM row is divorced from live `devices` and `parts` values.
- Users may edit BOM row part number, description, cost, labor, category/type, and include-on-floorplan fields.
- BOM rows selected directly from parts default `includeOnFloorplan=false`.
- Free-form BOM rows default `includeOnFloorplan=false`.
- BOM rows created from devices default `includeOnFloorplan` from the device.
- BOM row money values should continue to follow the current whole-dollar BOM display/storage rule.

### bomRowParts

Maintain a `bomRowParts` list at the time a device is added to the BOM for future flexibility. Runtime schema guards now create this table and sync rows from worksheet JSON whenever worksheet data is saved.

Suggested shape:

- `bomRowPartId` uniqueidentifier primary key
- `bomRowId` uniqueidentifier not null
- `devicePartId` uniqueidentifier null
- `sourcePartId` uniqueidentifier null
- `vendorId` uniqueidentifier null
- `partNumber` nvarchar
- `description` nvarchar(2000)
- `parentCategory` nvarchar
- `category` nvarchar
- `msrp` money/null
- `cost` money/null
- `quantityPerDevice` int not null
- `bomQuantityAtSnapshot` int/null
- `createat`, `createby`, `updateat`, `updateby`

Initial use:

- Snapshot the parts that composed a device at the moment that device became a BOM row.
- Do not require active UI behavior on day one if not needed.
- Keep the data available for later detailed reports, procurement views, vendor cost analysis, and future device mutations.

## Floorplan Relationship Rule

Floorplan symbol annotations must reference the BOM row by stable id.

Do not bind symbol identity to:

- part number
- description
- category/type
- short name
- quantity
- floorplan name

Mutable BOM fields should update symbol display metadata without orphaning placed symbols. A user must be able to edit the BOM type/category and keep existing floorplan symbols intact.

## Implementation Sequence

1. Inventory all current `materials`, `devicematerials`, `materialAttributes`, `materialSubTasks`, `vwMaterials`, and `vwDeviceMaterials` references in backend and frontend code.
2. Confirm where BOM rows are stored today (`firewireProjectWorksheets` JSON versus relational tables) and decide whether this transition creates relational BOM row tables now or preserves JSON rows with stable ids plus `bomRowParts`.
3. Add SQL DDL/runtime guards for `deviceParts`.
4. Add SQL DDL/runtime guards for `bomRowParts` if BOM rows remain JSON-backed, or for both `bomRows` and `bomRowParts` if BOM rows move relationally.
5. Replace device part linking code so device create/edit flows write `deviceParts`, not `materials`/`devicematerials`. Implemented for device detail edits, creating a device from a part, adding a part to an existing device, device price refresh, and legacy test-device seeding.
6. Default `devices.categoryName` from the first linked part category when creating a device from a part, but keep it editable and independent.
7. Default device `cost` from `sum(cost * quantityPerDevice)` and allow user overwrite.
8. Update device detail UI to show and edit device parts with `quantityPerDevice`.
9. Update device price refresh to use `deviceParts` and master `parts`, preserving snapshot/update semantics the user chooses.
10. Update BOM add-from-device to create a BOM row snapshot from device fields and create `bomRowParts` snapshots from that device's `deviceParts`. Implemented in Sales Quick Start and Project Detail BOM flows.
11. Update BOM add-from-part and free-form add-row to create independent BOM rows without requiring a device/material row.
12. Update floorplan designer and floorplan save paths so symbols use `bomRowId` only.
13. Update takeoff, summary, CSV export, and reports to read from BOM row snapshots and floorplan counts instead of material joins or mutable display strings.
14. Remove or retire obsolete `materials`/`devicematerials` paths after all consumers are cut over. Active app write paths no longer create `materials` or `devicematerials`; legacy repository methods still exist until callers and admin screens are fully retired.
15. Update `domain-model.md`, `parts-model.md`, entity images/docs, and this plan's replacement stable docs.
16. Delete this transition plan after the final model is documented and verified.

## SQL Objects Expected To Remain

These objects should remain:

- `vendors`
- `parts`
- `devices`
- `deviceSets`
- `deviceSetDevices`
- `firewireProjects`
- `firewireProjectWorksheets` unless intentionally replaced by relational BOM tables
- `firewireProjectSettings`
- document/floorplan/workspace storage tables
- `categoryLabors` unless the Daily Report labor lookup flow is intentionally redesigned

## SQL Objects Likely Safe To Drop After Cutover

These are candidates to drop only after no backend route, repository, view, UI service, report, import, floorplan, or BOM workflow references them. Source code no longer has active callers creating `materials`/`devicematerials`, but the old repository methods and material-list admin surface remain until deliberately removed:

- `materials`
- `devicematerials`
- `vwMaterials`
- legacy `vwDeviceMaterials` implementations that still read from `devicematerials`

Do not drop `materialAttributes` or `materialSubTasks` yet. Current code still treats `materialAttributes.materialId` and `materialSubTasks.materialId` as a device id, so these tables need replacement tables such as:

- `deviceAttributes`
- `deviceSubTasks`

`vwDeviceMaterials` currently remains as a compatibility view name over `deviceParts`; it should not be dropped until callers are renamed to a `vwDeviceParts` or direct `deviceParts` API.

## SQL Objects Already Obsolete

Do not reintroduce these legacy objects:

- `categories`
- category management routes/screens
- `EddyProducts`
- `EddyPricelist`
- `VendorPriceList`
- `VendorPricelist`
- `VwEddyPricelist`
- `VwVendorPricelist`

`categoryLabors` is not the removed category concept. It is a Daily Report labor lookup table and should not be dropped as part of the device/parts/BOM transition unless that flow is explicitly replaced.

## Validation Checklist

- Devices can contain parts from more than one vendor.
- Adding a part to a device defaults `quantityPerDevice=1`.
- UI prevents `quantityPerDevice <= 0`.
- Device cost defaults from part procurement cost times quantity, not MSRP.
- A device can be added to the BOM and creates a snapshot row plus `bomRowParts`.
- A part can be added directly to the BOM without creating a device.
- A free-form BOM row can be saved without matching a part or device.
- Duplicate BOM rows for the same device or part are allowed and remain separate objects.
- Editing BOM category/type does not orphan floorplan symbols.
- Floorplan symbols reference BOM rows by id.
- Reports, takeoff, summary, CSV export, and floorplan counts use BOM row snapshots.
- No active code path writes new `materials` rows.
- Candidate obsolete SQL objects are unused before they are dropped.
