# Firewire Domain Model

## Business Flow

Sales users start from customer documents and floorplans. They create estimates by selecting devices, placing them on floorplans, and building a bill of materials. Sales projects can move into detailed project work where project properties, timing, delivery costs, and proposal outputs are refined.

When a project reaches proposal status, project-detail summary reports are generated for customer review. The proposal may be revised collaboratively through email, phone, and other customer conversations. After acceptance, the project can move into design or install. At that point the app can export Firewire information into external systems, including Fieldwire.

## Tenants

The system is tenant-aware. Startup validation expects a `tenants` table to exist and contain rows. Tenant-specific documents and project artifacts should keep tenant/project isolation in mind even when current code paths pass project/workspace keys directly.

## Projects

Projects can be associated with divisions/project types:

- `Fire Alarm`
- `Sprinkler`
- `Security`

Current project status concepts include estimation, proposal, design, and install states. The UI has separate sales, project, design, install, change order, and reporting areas.

Newer Firewire project records live in `firewireProjects`; related worksheet/BOM JSON is stored in `firewireProjectWorksheets`. Existing Fieldwire projects can be listed and mapped/imported through the Fieldwire integration.

Project Admin settings are stored in `firewireProjectSettings`. Standard global lists include job type, scope type, project scope, project status, and difficulty. Report text lists are division-specific and use the same table with `division` set to `Fire Alarm`, `Sprinkler`, or `Security`:

- `assumptions`
- `inclusions`
- `exclusions`

For these report text lists, `label` is the paragraph/body text that may later appear on project summary reports such as estimates and proposals. Keep `description` available for optional internal notes, and keep `sortOrder`/`isActive` behavior consistent with the other project admin lists.

## Devices, Parts, And Materials

Devices are the most important business object. A device represents one or more parts. The app uses separate device and part/material tables:

- `devices`
- `materials`
- `devicematerials`
- `parts`
- `deviceParts`
- `vwParts`
- `vwDevices`
- `vwMaterials`
- `vwDeviceMaterials`

Categories are no longer a first-class Firewire entity. Do not add or restore category tables, category API routes, category management screens, or device-to-category relationships.

`categoryLabors` is a separate Daily Report labor lookup table keyed by Fieldwire/team category names and status names. Keep it unless the Daily Report labor resolution flow is intentionally redesigned.

Device properties include a superset of the parts they contain, including labor values, addressing fields, vendor/part references, cost, `categoryName`, and `includeOnFloorplan`.

Device `shortName` is a compact operational label. It is displayed in device lists, included in device/device-set search, used as a fallback BOM description when `name` is missing, used by import/device resolution as a match key alongside `name` and aliases, and used in Fieldwire install task names with the device category handle.

Device `cost` is an overwritable aggregate of linked device-part snapshot costs. Use the `parts.cost`/vendor cost value for this aggregate, not MSRP. MSRP is customer-facing retail reference data; device cost should reflect procurement cost unless the user explicitly overwrites it. When a part is linked to a device, copy the part description, part category, `parts.cost`, `parts.msrp`, vendor id, and `quantityPerDevice` into `deviceParts` so device detail and BOM-adjacent views can show point-in-time vendor part values independently from the device's own name, short name, and category.

Device labor can be represented in two modes. Without sub tasks, `defaultLabor` is a total default labor cost, not hours; the baseline is the default labor rate of $56/hour times 2 hours, and BOM labor hours are calculated by dividing this cost by the default labor rate. With sub tasks, the device uses a labor breakdown: sub task hours are summed, multiplied by the device `laborRate`, and exposed as calculated labor cost. BOM labor hours should then be calculated by dividing that calculated labor cost by the device labor rate.

Device address flags describe install capture requirements: serial number controls serial capture, SLC Address controls Signal Line address capture, Speaker Address captures outbound audio signal address, and Strobe Address captures outbound optical signal address.

Device attributes are custom fields captured for a device on a floorplan during install. Device sub tasks break labor down by task type such as Install, Pre-Wire, Trimout, and Test.

Device media is stored as device-scoped uploaded files. Metadata is kept in `workspaceStorage` under area `device-media` and workspace key `deviceId`; file bytes are stored in Azure Blob Storage through `FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING`. Device media follows the same reusable file workflow as the project document library: upload/list metadata, stream content for inline preview, stream content as an attachment for download using the original filename, and delete when allowed. Deleting a device must delete its device-media blobs and remove the related workspace storage row.

`parts` is the canonical master vendor part list. A part row includes vendor, source vendor name, brand, part number, description, parent category, category, MSRP, cost, minimum quantity, UPC, status/agency/origin metadata, raw import JSON, and audit fields. Part descriptions support up to 2000 characters. `vwParts` projects canonical SQL fields; the repository adds legacy Pascal-case aliases for existing UI/BOM components. The alias `SalesPrice` is a compatibility projection of `parts.cost`; the source table stores the value as `cost`.

When a part from the master list is used to create a device, default `devices.categoryName` from the first part's `category` value. The user may later edit the device category text freely. The value does not relate to another table.

Use `devices.includeOnFloorplan` to decide whether the device's `categoryName` should populate BOM/floorplan category/type text for drop operations. Device Sets contain devices, not parts.

Deleting a device must remove its `deviceParts` rows and any device-level attributes/subtasks. Do not create new `materials` or `devicematerials` rows for device composition. The legacy `materialAttributes` and `materialSubTasks` table names may still be used as device-owned attribute/subtask storage with `materialId=deviceId` until they are renamed.

## BOM Snapshot Rule

When a device is added to a BOM, the BOM row should preserve the device at that point in time. This decouples project estimates from future changes to device definitions or part/vendor costs.

BOM rows created from devices should create one row for the device, using device-level fields for part number, description, category/type, cost, labor, and floorplan inclusion. The underlying linked `deviceParts` should be copied into `bomRowParts` for future reporting/procurement flexibility, but they should not become separate visible BOM rows unless the user explicitly adds them.

New projects must start with an empty BOM. Do not seed default `bomSections`, device rows, or part rows during sales quick create, project create, or project detail load. Populate BOM rows only from an explicit user action such as a future add-device/add-device-set workflow or by loading already-saved `firewireProjectWorksheets` data.

BOM rows use `includeOnFloorplan` as the source of truth for whether the row participates in floorplan symbol placement. The `type` field remains category/type display text only and must not by itself make a row available on floorplans. Rows created from devices/device sets should default `includeOnFloorplan` from `devices.includeOnFloorplan`; blank rows, rows selected directly from vendor parts, and legacy rows without an explicit `includeOnFloorplan=true` flag should default false. When `includeOnFloorplan` is true, BOM quantity is floorplan-controlled/read-only in the worksheet; when false, users may edit quantity directly.

BOM rows must have a durable row `id`. Floorplan symbol annotations must relate to the BOM through that row id (`bomRowId` / stable symbol id), not through mutable display strings such as part number, description, category/type, or short name. Users may edit any BOM field and the corresponding floorplan symbols should keep their placement identity while refreshing their visible label/category/part metadata from the BOM row.

BOM `partNbr` is free-form user text. The lookup should help users select catalog parts/devices, but saving a BOM row must not require the part number to exist in `parts`, devices, or any vendor list. Preserve any typed part number and description exactly as user-entered worksheet content.

BOM money values are stored and displayed as whole dollars rounded up with `Math.ceil`. Apply this to BOM cost, labor, extended cost, extended labor, totals, and CSV export in both Sales Quick Start and Project Detail BOM surfaces.

Future agents should be careful not to replace historical BOM rows with live joins to current device/part prices unless the user explicitly asks for recalculation behavior.

## Device Sets

Device Sets are logical groupings of devices created by users. They let users quickly populate BOM sections for common project patterns.

Device Sets have zero-or-many visibility values. Supported values are `all-users`, `current-user`, `fire-alarm`, `sprinkler`, and `security`; empty/legacy visibility should be treated as `all-users`. Use `ownerUserId` for user-owned/Just Me semantics instead of relying on legacy `createby`, because legacy device set audit columns are narrow. Device Set list, detail, and assignment workflows should expose visibility where relevant; filters should be multi-select and persist the user's selected values locally through `ViewPreferencesService`.

Relevant tables/routes:

- `deviceSets`
- `deviceSetDevices`
- `/api/firewire/device-sets`

Angular pages:

- `firewire-ui/src/app/pages/device-sets`

## Floorplans

The floorplan designer lets users place device symbols and annotations against customer drawings. Device `categoryName` supplies category/type display text only when `includeOnFloorplan` is enabled. Floorplan document state is coordinated with project document library state.

Floorplan `name` is a user-editable display label used by the floorplan designer, floorplan tiles, takeoff views, and downstream user-facing labels. It must not be used as the physical file/storage identity. New floorplans should default this display label from the uploaded filename without its extension, while preserving the original/source filename and blob metadata separately for versioning, preview/download, Azure Blob access, and deletion.

Project Take Off rows must display the exact corresponding floorplan `name`. Do not strip extensions, split on `.`, append duplicate-name counters, or derive takeoff labels from source filenames/blob metadata. Use stable internal ids for row keys when needed, but keep the visible row label equal to the floorplan display name.

Floorplan tile rename inputs should keep local draft text while the user is typing and persist only on blur/commit. Do not mutate the backing `file.name` on every keystroke, because floorplan lists sort by display name and live mutation makes tiles move while users edit. Show tile-level save progress when persisting a rename or a saved floorplan design.

Floorplan symbols are driven by BOM rows with `includeOnFloorplan=true`; symbol placement is not constrained by the current BOM quantity. Users may place a symbol as many times as needed across one or many floorplans. When a floorplan design is saved, the aggregate placement count for each symbol across all project floorplans becomes the BOM row quantity. Removing a symbol from any floorplan reduces that aggregate quantity on the matching BOM row. Keep the BOM quantity read-only for FP-enabled rows because the floorplan placements are the source of truth.

When syncing floorplans and BOMs, use the BOM row id as the only placement relationship. Category/type, part number, and description are display/snapshot fields and can change; those changes should propagate onto existing floorplan symbols without orphaning them or requiring users to delete/re-place marks.

Floorplan annotation coordinates are persisted as `xRatio`/`yRatio` against the rendered drawing/media box, not against the viewport, scroll stage, or available whitespace around the drawing. The floorplan media, annotation surface, and click target must always share the same rendered width and height at every zoom level so placed symbols remain fixed when users zoom or pan.

Do not render floorplan annotation layers until the base image/PDF layer has loaded and exposed its rendered dimensions. Symbols and notes must stay hidden during the initial media load so they never flash at fallback coordinates before the drawing coordinate system is ready.

Floorplans are conceptually layered. The uploaded drawing/PDF/image is the base layer, symbols are a separate layer, and notes/sticky notes are another separate layer. Users may hide/show these layers while designing. When a layer is hidden, tools and selection/manipulation for that layer must be disabled with clear UI feedback; for example, hidden symbols means no symbol drop or symbol selection until the Symbols layer is shown again.

Future base-layer versioning should preserve this separation: uploading a new floorplan version replaces the rendered base layer while keeping symbol/note coordinates tied to the normalized drawing box. Version capture should allow a replacement file, a user-editable version name, and optional version notes while retaining prior file versions through the document library storage/version model.

Relevant Angular areas:

- `pages/design/floorplan-designer.component.ts`
- `pages/design/design-floorplan-designer.page.ts`
- `common/components/firewire-floorplans.component.ts`
- `common/services/project-doc-library-storage.service.ts`

## Project Document Library

Document library metadata and folder state are stored through `/api/firewire/storage/project-doc-library/:workspaceKey`. File content versions are uploaded to Azure Blob Storage and referenced from the workspace payload. Project document library, device media, floorplan files, and future uploaded attachment areas should share the same media/document plumbing expectations described in `implementation-patterns.md`: blob-backed bytes, metadata-only SQL/workspace records, inline preview, original-filename download, and cleanup with the owning record.

Default folders live in `ProjectDocLibraryStorageService` and include CAD, O&M, project management, sales, submittal, customer drawings, change orders, inspection reports, and related subfolders.

## Vendors And Part Imports

Part list imports use one universal vendor-configurable flow. Imports preview, snapshot, replace, restore, and run tracking through the vendor parts import endpoints, and every imported row lands in `parts`.

See `parts-model.md` before changing part imports, device part linking, cost refresh, or device set part lookup behavior.

## Fieldwire Integration

Fieldwire is a third-party construction planning system. Firewire can plan and execute an import/export into Fieldwire when project state allows it. The project detail UI has a Fieldwire import component, and backend routes build import plans and execute imports.

Relevant code:

- `firewire-web/src/workspaces/fieldwire`
- `firewire-web/src/workspaces/firewire/data/firewire.projects.data.ts`
- `firewire-ui/src/app/common/components/fieldwire-import.component.ts`
