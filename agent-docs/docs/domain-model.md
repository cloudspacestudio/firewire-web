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

Fieldwire task-status configuration is also division-specific in `firewireProjectSettings` under list key `fieldwireStatuses`. Each item uses `label` as the Fieldwire status name, `sortOrder` as its ordered position, `color` as one of Fieldwire's supported task-status hex colors, and `statusKind` as the explicit `open`, `tracked`, or `verified` lifecycle type. `isActive` retains a definition without including it in provisioning. Editing this Firewire-owned list does not itself mutate an external project. When the user explicitly executes a Fieldwire import that creates a project, the import provisions the active ordered definitions for the Firewire project's division. Every active definition must have a type; `General` must exist and be Open; the list must contain at least one Open, Tracked, and Verified status; exactly one may be Verified; and sort order must keep all Open statuses before Tracked and Verified. Newly created tasks explicitly receive General. Reconciliation preserves Fieldwire's protected Open, Tracked, and Verified IDs by mapping them to the appropriate configured definitions rather than deleting them.

Project-level report fine tuning is stored with the project worksheet under `worksheetData.reportSettings`. It is seeded from the active division defaults for the project's `projectType`, but individual projects persist their own checked/unchecked state for assumptions, inclusions, and exclusions. Report generation should read the project-level selections first and use the division settings only to initialize or reconcile missing project entries.

## Change Orders

Change orders are represented as separate Firewire project records created from a root Firewire project. The Change Orders entry point belongs on Project Detail for execution-stage work, and should be keyed from the Firewire project UUID rather than legacy/Fieldwire project state.

Creating a change order should copy project identity fields from the root project, set the new project status to `Estimation`, and create a new delta worksheet. The live change-order worksheet must start with an empty `bomSections` array so only newly added work affects change-order totals and reports.

If the root project has a visible project number, change-order project numbers use the sequential suffix strategy `.01`, `.02`, `.03`, etc. Resolve the root number from `firewireProjects.projectNbr` first, then from the linked Fieldwire project code when the Firewire record is blank but the merged project list still shows a project number. The generated change-order name uses the same two-digit suffix, for example `Fire Alarm Test - 01`.

Historical project scope is preserved under `worksheetData.changeOrderBaseline`. This baseline should include the root project id/name/number, change-order version, captured timestamp, original BOM sections, floorplan folders, and original floorplan design markup. Treat this data as read-only context. Do not merge baseline BOM rows, symbols, circuits, notes, or sticky notes into live change-order totals unless the user explicitly creates new change-order work.

Floorplan base files for a change order are seeded into the new project document-library workspace so users can design against the same drawings. The copied live floorplan files should retain base image access while starting with empty editable annotations/circuits and preserved calibration/rotation. Original drawing markup remains in `changeOrderBaseline.floorplans` for read-only reference overlays.

Change-order discovery should not rely only on project-number suffixes like `.01`; projects without a project number must still be discoverable through `worksheetData.changeOrderBaseline.rootProjectId` and versioned through `changeOrderBaseline.changeOrderVersion`.

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

Device `shortName` is a compact operational label. It is displayed in device lists, included in device/device-set search, used as a fallback BOM description when `name` is missing, used by import/device resolution as a match key alongside `name` and aliases, used in Fieldwire install task names with the device category handle, and copied to BOM/floorplan symbol snapshots for placed-symbol tooltip text.

Device `floorplanLabelText` is a 1-4 character bubble label used only when `includeOnFloorplan` is enabled. It is copied onto BOM rows when a device is added or selected for a BOM row, and from there onto floorplan symbol annotations. Existing BOM rows and placed symbols should keep their captured value instead of live-linking back to future device edits.

Device tags are user-managed device-level labels. A device can have zero or many tags. Tag metadata is stored in `workspaceStorage` under area `device-tags` and workspace key `deviceId`; delete this workspace storage when deleting the device. The device edit form is the source of truth for creating/removing device tags.

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

For floorplan-enabled device rows, snapshot `deviceId`, `floorplanLabelText`, `shortName`, custom attributes, device tags, and device media metadata onto the BOM row. Use `floorplanLabelText` for compact bubble rendering and use `shortName` for floorplan symbol tooltips. If older data lacks `floorplanLabelText`, fall back to the existing generated symbol code, but do not replace the durable BOM row id relationship.

When a BOM symbol is placed onto a floorplan, copy the BOM row's attributes, tags, and media metadata onto the annotation. The floorplan selected-symbol rail may edit the annotation's attributes and tags. BOM-to-floorplan sync should seed missing metadata for older annotations but must not overwrite existing annotation metadata, because placed symbols are intentionally decoupled after placement.

Document-derived device counts must preserve four separate concepts: the quantity stated in a device schedule, the quantity counted from drawing symbols, the reconciled BOM quantity approved by a user, and the intended floorplan placement target. A schedule/drawing disagreement is a conflict and must not be silently resolved. Approved document-analysis BOM rows persist their placement target separately from the live count of placed annotations, and every generated annotation links through the stable BOM row id. Creating 18 units on a BOM must therefore establish a target of 18 placements. A partial or zero automated count cannot silently reduce that approved quantity. When the initial quantity is provisional or the drawing count was not known, approval of reviewed AI locations may raise both values. Once a user explicitly changes, removes, or reclassifies placements in Floorplan Designer and saves, the aggregate saved design becomes the authoritative takeoff count for the affected rows and may raise or lower their quantities and targets.

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

Floorplan symbols are driven by BOM rows with `includeOnFloorplan=true`. Placement is not constrained by the current BOM quantity while the user is explicitly editing a design. The left rail reports live aggregate counts, including device changes and removals. Saving the design makes the aggregate placement count across all project floorplans the row quantity; document-analysis rows also receive the same revised `floorplanQuantityTarget`. Before manual editing, `quantitySource=document-analysis` and `floorplanQuantityTarget` preserve the best approved quantity currently known. The reviewed AI `Place Symbols` command raises both values when approved discoveries exceed them but does not lower a larger known value; only a later explicit designer edit and save can lower or reclassify that count.

When syncing floorplans and BOMs, use the BOM row id as the only placement relationship. Category/type, part number, and description are display/snapshot fields and can change; those changes should propagate onto existing floorplan symbols without orphaning them or requiring users to delete/re-place marks.

Floorplan annotation coordinates are persisted as `xRatio`/`yRatio` against the rendered drawing/media box, not against the viewport, scroll stage, or available whitespace around the drawing. The floorplan media, annotation surface, and click target must always share the same rendered width and height at every zoom level so placed symbols remain fixed when users zoom or pan.

Symbol placement mode also supports transient canvas panning without changing tools. A primary-button gesture beginning on empty drawing space remains a placement click when released within the movement threshold; crossing the threshold changes to a grab-pan gesture and suppresses that gesture's placement click. Placed annotation elements retain event priority so pressing directly on a selectable symbol selects or drags that symbol instead of panning the canvas.

Do not render floorplan annotation layers until the base image/PDF layer has loaded and exposed its rendered dimensions. Symbols and notes must stay hidden during the initial media load so they never flash at fallback coordinates before the drawing coordinate system is ready.

Floorplans are conceptually layered. The uploaded drawing/PDF/image is the base layer; symbols, notes/sticky notes, and circuits are separate markup layers. Users may hide/show these layers while designing. When a layer is hidden, tools and selection/manipulation for that layer must be disabled with clear UI feedback; for example, hidden symbols means no symbol drop or symbol selection until the Symbols layer is shown again.

Change-order floorplans render `worksheetData.changeOrderBaseline.floorplans` as a locked "Original Scope" reference layer in the floorplan designer. The baseline layer should display prior symbols, joints, notes/stickies, and circuits beside the new editable change-order marks, but it must never participate in selection, dragging, deleting, BOM quantity sync, validation, or save payloads. New change-order annotations/circuits remain the only editable layer.

Future base-layer versioning should preserve this separation: uploading a new floorplan version replaces the rendered base layer while keeping symbol/note coordinates tied to the normalized drawing box. Version capture should allow a replacement file, a user-editable version name, and optional version notes while retaining prior file versions through the document library storage/version model.

Relevant Angular areas:

- `pages/design/floorplan-designer.component.ts`
- `pages/design/design-floorplan-designer.page.ts`
- `common/components/firewire-floorplans.component.ts`
- `common/services/project-doc-library-storage.service.ts`

## Project Document Library

Document library metadata and folder state are stored through `/api/firewire/storage/project-doc-library/:workspaceKey`. File content versions are uploaded to Azure Blob Storage and referenced from the workspace payload. Project document library, device media, floorplan files, and future uploaded attachment areas should share the same media/document plumbing expectations described in `implementation-patterns.md`: blob-backed bytes, metadata-only SQL/workspace records, inline preview, original-filename download, and cleanup with the owning record.

Default folders live in `ProjectDocLibraryStorageService` and include CAD, O&M, project management, sales, submittal, customer drawings, change orders, inspection reports, and related subfolders.

Per-document AI inspection may persist proposed project-detail actions alongside its findings in the separate `project-document-analysis` workspace area. Proposals are review artifacts, not project state: they must preserve current/proposed values and document provenance. A user may select and explicitly apply proposals; the server then updates the canonical project or `worksheetData.customerInfo`, records the source document and changed labels in project activity, and stores application metadata on the analysis record. Already-applied actions remain identifiable during later review.

Per-document AI inspection may also identify multiple usable floorplan pages in one PDF. Each recommendation retains the printed floorplan name, one-based source page, source evidence, and reviewable device locations expressed as full-page `xRatio`/`yRatio` coordinates. Creating a recommendation copies only that PDF page into a standalone blob-backed file in the normal `floorplans` folder; an existing normalized same-name floorplan is reused instead. Approved symbol placement writes ordinary Floorplan Designer annotations and links each to the exact current BOM row by `bomRowId`. A source placement ID prevents retry duplicates; the explicit placement approval raises provisional BOM quantities and targets to the aggregate project placement counts when necessary. Part-only or non-floorplan BOM rows remain ineligible. The designer remains the final human review/edit surface because AI spatial localization is not exact.

Floorplan creation and location extraction are intentionally distinct states. A created floorplan with zero locations is still a valid base drawing and must open normally in Floorplan Designer. The user may then run a focused tiled location pass once exact floorplan-ready BOM candidates exist. Tile-local detections are mapped back to the original page and overlap duplicates are merged before review. Only non-empty, confidence-filtered results expose Place Symbols; an empty focused result remains explicit rather than creating guessed marks. Re-scanning an applied proposal is an explicit replacement operation: Firewire removes only that inspection's generated annotations after a non-empty replacement result, preserves manual symbols, and requires the new set to be approved for placement.

Per-document BOM proposals are also review artifacts. Exact catalog matches must be compared with the current project BOM before they are offered for application. A proposal whose canonical device or part already has a BOM row, or which repeats another proposal for the same catalog entity, remains visible for review but must be labeled as already represented and excluded from selection. Explicitly applying eligible proposals creates independent snapshot rows under the `document-analysis` BOM section, with the server repeating the uniqueness check against current project state immediately before writing. Each imported row retains the analysis/proposal/document identifiers, approved quantity, quantity source, and placement target. Exact reusable-device matches snapshot the device and linked parts; exact master-part matches create BOM-only rows. Ambiguous, missing, duplicate, or quantity-conflict proposals require human resolution and cannot be applied directly.

A user may resolve a document proposal's displayed master-part candidate by creating a reusable Firewire device from the findings dialog. This is an explicit global catalog mutation, not an AI side effect. The resulting device links the canonical part, may be floorplan-enabled, uses the confirmed legend label as its initial bubble label, and converts that proposal to an exact device match. A general symbol/device legend is document-wide and may supply identity and glyph artwork for devices placed on any floorplan page unless the document explicitly limits the legend to a sheet, level, sector, or area. When inspection retained a distinct legend glyph with exact PDF page and normalized crop bounds, confirmed device creation also renders that source crop into a transparent PNG, stores it in the global `AI Inspection Legends` device-icon group, and assigns it to a new or otherwise iconless device. Never overwrite a manually selected or non-AI icon. A new explicit resolution may refresh an existing `AI Inspection Legends` icon so corrected extraction can repair prior AI artwork. Store proposal/device/part/icon/user/timestamp application metadata so retries reuse the same result. BOM rows snapshot the assigned icon data, and Floorplan Designer renders the snapshot by stable BOM row identity.

Deleting a Firewire project deletes its project-scoped analysis findings, recommendations, progress/failure records, provider identifiers, and action-application metadata along with the normal project worksheet, BOM snapshots, and activity history. It also cancels active inspections and cleans up any known retained temporary OpenAI input file before the project record is removed. A reusable device created through an explicitly confirmed proposal action remains in the global catalog because it is not project-owned and may be used by other projects.

Deleting a source Document Library file also deletes floorplan files derived from that source page and removes AI-generated annotations carrying that source document ID from other project floorplans. Generated floorplan records and annotations must therefore retain `sourceAnalysisId`, `sourceDocumentId`, and version/placement provenance; user-created floorplans and manual annotations are not removed by this cleanup. Every deleted file ID is retained as a bounded workspace tombstone so an older in-flight full-workspace save cannot restore deleted metadata after Azure Blob deletion. Document-analysis application history is audit evidence only: current Document Library membership determines whether a floorplan is available and whether Create Floorplan may be offered again.

The canonical project `address` represents the project/job-site location. Customer Info `billingAddress` represents the customer's accounting address and may legitimately differ or remain blank. Document analysis must target these fields independently and applying a Project Address proposal must not implicitly populate Billing Address.

## Vendors And Part Imports

Part list imports use one universal vendor-configurable flow. Imports preview, snapshot, replace, restore, and run tracking through the vendor parts import endpoints, and every imported row lands in `parts`.

See `parts-model.md` before changing part imports, device part linking, cost refresh, or device set part lookup behavior.

## Fieldwire Integration

Fieldwire is a third-party construction planning system. Firewire can plan and execute an import/export into Fieldwire when project state allows it. The project detail UI has a Fieldwire import component, and backend routes build import plans and execute imports.

Floorplan uploads to Fieldwire may be accepted before Fieldwire has finished preparing the sheet for task placement. Import execution should wait and retry after floorplan creation before creating floorplan tasks. The current backend flow retries task placement for the first symbol on the floorplan every 5 seconds for up to 20 attempts, then continues with the rest of that floorplan's tasks once the first placement succeeds.

Fieldwire task import matching must use both task name and floorplan position. Multiple Firewire symbols can legitimately create Fieldwire tasks with the same display name on the same floorplan; matching only by name can make later symbols look imported when only one placement exists.

Fieldwire task categories are Fieldwire teams. Resolve every placed annotation to its canonical BOM row through stable `bomRowId`, then use that BOM row's current `type` value as the task category/team name. Never fall back to an arbitrary existing Fieldwire team when an exact category match is absent; create the missing exact-name team and cache it for the rest of the import.

Direct Fieldwire task activity reads belong under `/api/fieldwire/*`. The install detail page uses `GET /api/fieldwire/projects/:projectId/task-status-changes` to gather project-specific Fieldwire statuses, query tasks updated in each current status during a date range, fetch each task's default detail record, and return flat status-activity rows for recent activity views. The endpoint loads the project user directory once per request and resolves the returned task's `last_editor_user_id` into `technicianUserId`, `technicianName`, and `technicianEmail`. This technician is the last editor reported on the matching task record; without a Fieldwire transition-audit event it must not be represented as stronger proof of who performed a specific historical status transition.

Firewire stores an optional linked Fieldwire project id on `firewireProjects.fieldwireId`. Use `PATCH /api/firewire/projects/firewire/:projectId/fieldwire-map` to update or clear only that link. If Fieldwire reports the linked project as not found, Project Details and the Firewire import flow should clear the stale link before planning another import.

Relevant code:

- `firewire-web/src/workspaces/fieldwire`
- `firewire-web/src/workspaces/firewire/data/firewire.projects.data.ts`
- `firewire-ui/src/app/common/components/fieldwire-import.component.ts`
