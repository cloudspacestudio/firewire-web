# Implementation Patterns

## Backend Route Pattern

Add routes through workspace manifests, not by wiring route files manually in `index.ts`.

Typical shape:

1. Add a method entry to a `manifestItems` array in a data class.
2. Validate route params/body at the top of the handler.
3. Resolve the current user with the existing local helper when available.
4. Call a repository/service.
5. Return `200`/`201` with `{ data }` for single resources or commands and `{ rows }` for lists.
6. Return `400` for validation errors and `404` for missing resources.

Keep route handlers small. Put SQL and transformation logic in repositories or focused helper functions.

API responses with status `500` or higher are logged centrally by Bootstrap after bearer validation. Route handlers may still return JSON errors directly, but do not suppress useful error messages; include a clear `message` field so the central API log line is actionable.

## SQL Pattern

Preferred for new writes:

```ts
const sql = this.app.locals.sqlserver
const pool = await sql.init()
await pool.request()
    .input('name', mssql.NVarChar(100), name)
    .input('updatedBy', mssql.NVarChar(256), userId)
    .query(`
        UPDATE dbo.someTable
        SET name = @name,
            updatedAt = SYSUTCDATETIME(),
            updatedBy = @updatedBy
        WHERE uuid = @uuid
    `)
```

Avoid adding new interpolated SQL. Existing `SqlDb` methods often use `_escapeSql`; that is legacy drift, not the desired direction for new code.

## Audit Fields

Every SQL table should record:

- created by
- created at
- updated by
- updated at

Naming varies:

- Legacy tables: `createby`, `createat`, `updateby`, `updateat`.
- Newer Firewire tables: `createdBy`, `createdAt`, `updatedBy`, `updatedAt`.

When touching an existing table, follow its existing names. When creating a new Firewire table, prefer the newer names with `DATETIME2(7)` and `SYSUTCDATETIME()`.

## Schema Evolution

The codebase has both static SQL files under `src/workspaces/fieldwire/corpdb` and runtime `ensure*Schema()` methods. If adding columns needed by active code:

- Add/update the runtime schema guard if the application depends on self-healing startup behavior.
- Add/update the matching SQL script so database structure remains visible in source control.
- Use default constraints for non-null columns on existing tables.

## Backend Auth/User Identity

API routes run behind global bearer token validation in `Bootstrap`. Route-level manifests may still say `AuthStrategy.none`.

When a route needs user identity, use the local `resolveUserId(req)` pattern where it exists. It reads token claims placed on the request by middleware. Avoid hard-coding `system` for user actions unless the operation is truly system-owned or the surrounding legacy code has no user context yet.

## Azure Blob Storage

Use `AzureBlobDocumentStorage` for project document file content. Do not store large binary/data URL payloads in SQL for new flows.

Blob naming should keep project/workspace keys, file IDs, version IDs, and safe original file names. Keep SQL/workspace payloads as metadata plus `blobName`/`blobContainerName`.

## Media And Document File Pattern

Treat uploaded files, device media, project document library files, floorplan files, and similar future attachments as one family of workflows. A feature may have its own metadata shape, but the plumbing should stay consistent:

- Store file bytes in Azure Blob Storage through `AzureBlobDocumentStorage`.
- Store only metadata, blob container names, and blob names in SQL/workspace JSON.
- Include stable IDs, original filename, MIME type, byte size, upload timestamp, uploaded-by identity, `blobContainerName`, and `blobName` in metadata.
- Keep user-editable display labels separate from physical storage identity. A field such as floorplan `name` may be edited freely and should flow to UI/report/takeoff labels, but blob lookup, upload-version matching, download filenames, and delete operations must use stable IDs plus original/source filename/blob metadata instead of the editable label.
- Sanitize path segments and header filenames with existing Firewire helpers before writing blob names or response headers.
- Expose upload/list/delete endpoints plus a content endpoint that streams bytes back from blob storage.
- Let the content endpoint support inline preview and attachment download, usually by accepting `disposition=attachment` for downloads and defaulting to `inline` for preview.
- Set `Content-Type`, `Content-Disposition`, and `Content-Length` when streaming file content.
- Delete associated blobs when deleting the owning domain object, unless the file is intentionally retained by another owner/version history.

Angular media/document surfaces should use a common service before page-local `HttpClient` calls. Reuse `ProjectDocLibraryStorageService` for project document library flows. For device media and future attachment surfaces, create or extend a shared service under `firewire-ui/src/app/common/services` rather than duplicating URL construction, blob download handling, original-filename download anchors, and error normalization inside components.

UI surfaces that list uploaded files should consistently offer upload, inline preview, download using the original filename, and delete when the user's permissions/state allow those actions. Prefer icon buttons with tooltips in a table/list actions column. Delete remains a destructive action and should use the shared red delete styling.

## OpenAI Document Analysis Pattern

Keep OpenAI calls server-side and route them through focused services under `src/workspaces/firewire/ai`; do not call OpenAI from Angular or place analysis prompts in route handlers. Resolve the canonical Firewire project first, validate that the requested Document Library workspace belongs to that project, and read file bytes through `AzureBlobDocumentStorage`.

Per-document inspection uses the OpenAI Files and Responses APIs with strict Structured Outputs. PDF inputs use high-detail page images because floorplan names, symbols, and normalized locations depend on dense drawing detail. Validate model output again in the application before persisting it. Persist analysis records in the separate `project-document-analysis` workspace area, including project/document/version IDs, schema and model versions, status, provenance-rich output, OpenAI resource IDs, timestamps, and sanitized failures. Do not mix AI findings into the mutable Document Library payload.

The direct-input workflow only accepts supported document formats under 50 MB. Larger documents require a future preprocessing or project-isolated vector-store path. Track an uploaded OpenAI file ID immediately after upload so failure paths retain a cleanup handle. Uploaded OpenAI input files should have an expiration policy and be deleted after processing; cleanup failure must not erase the inspection result.

Project deletion must treat document-analysis cleanup as part of the project lifecycle. Before deleting project SQL state, block new analysis writes, abort and drain live inspections, and retry deletion for persisted OpenAI file IDs that do not have a deletion timestamp. Then delete the `project-document-analysis` workspace row in the same SQL transaction that deletes the project-owned worksheet, normalized `bomRowParts`, activity records, and project record. If external cleanup of a known retained file fails, preserve the project and analysis metadata so deletion can be retried. Keep Responses requests non-stored, and add explicit deletion for any future project-scoped OpenAI vector stores or other provider resources before persisting their identifiers.

Angular Document Library surfaces should reuse `DocumentAnalysisService` and `FirewireDocumentAnalysisDialog`. Findings must visibly distinguish facts, interpretations, assumptions, unresolved questions, and code verification status. Never present `POTENTIALLY-APPLICABLE` as jurisdiction-verified.

Project-detail action proposals must compare against a server-supplied snapshot of the canonical Firewire project, use only an explicit allowlist of writable target fields, and include current/proposed values plus provenance. Treat these actions as review-only analysis output until a user selects and applies them. The apply request sends only the analysis ID and selected target fields; never trust replacement values from the browser. Re-read stored proposals and current project state, reject stale values before any write, validate field-specific formats, use the normal project repository update path, record the user-approved mutation in project activity, and persist application history on the analysis record. Keep the findings dialog open after application and refresh both Project Detail and Sales Quick Start without discarding unrelated unsaved edits.

After applying approved document actions, reload the canonical project and verify that every selected target materially changed before recording the action as applied. Persist the actual stored value in application history. Compare proposed/current addresses with normalized punctuation, common direction/street suffixes, and state names so formatting alone does not create a repeated proposal, while preserving material locality differences such as Oklahoma City versus Midwest City. Project `address` is the job-site/project address and `worksheetData.customerInfo.billingAddress` is a separate accounting address; never copy one into the other unless the user approves proposals for both fields. Address geocoding enriches an approved address with coordinates/status but must not rewrite or veto the requested address. When Azure Maps is unavailable or errors, preserve the requested address, clear stale coordinates when the address changed, and expose the appropriate unmapped/error status.

Treat document-derived BOM candidates as proposals, not mutations. Extract schedule and drawing quantities independently, retain provenance for both, and reconcile them with deterministic server logic after schema validation. Matching quantities may become the proposed BOM quantity; a mismatch must be shown as a blocking conflict. A one-source quantity may be displayed for review but must remain visibly identified as schedule-only or drawing-only. After model output is validated, match candidate identifiers independently of manufacturer/category text against reusable Firewire devices, linked device parts, and canonical master parts. Normalize identifier punctuation and defensively remove a duplicated manufacturer prefix before comparison. Return the matched entity type and require human confirmation for ambiguous or missing matches. A master-part match still requires a device selection or definition before floorplan placement. Never let the model create or modify a global device or part.

Apply document-derived BOM proposals only after explicit user selection. Send proposal IDs, not browser-supplied row values; reload the stored analysis and current catalog records on the server. Accept only exact, non-conflicting device or master-part matches with positive reconciled quantities. After catalog matching and again immediately before application, compare canonical `deviceId`/`sourceDeviceId` or `partId`/`sourcePartId` with every current project BOM section. Mark existing entities and repeated proposals as ineligible, exclude them from the default selection/apply count, and reject stale or crafted apply requests that would create another AI-imported row for the same entity. Create point-in-time BOM snapshots through the normal project repository, retain analysis/document provenance, use stable proposal IDs for idempotency, and record application history. Preserve `floorplanQuantityTarget` independently from placed-annotation count. Device matches may inherit floorplan eligibility from the device; master-part matches are BOM-only. The floorplan designer must report placement progress without overwriting the approved BOM quantity and must refuse placements above the target.

Treat detected floorplans and device locations as review-only proposals. Require a PDF source page, a non-empty printed drawing name, one-based page provenance, and normalized full-page coordinates. Compare floorplan names after removing extensions and punctuation; never create a second same-name floorplan. On approval, copy only the proposed page to a new PDF and store it as a normal blob-backed `floorplans` file. Never trust browser-provided file bytes, page numbers, positions, or BOM identities during application: reload the stored analysis, source version, document library, and current project BOM. Generated annotations must use stable `bomRowId`, the designer's `bom-row-{id}` symbol identity, and source analysis/document/placement provenance. Apply only exact device matches whose current BOM row is floorplan-enabled, deduplicate by stable placement ID, count placements across every project floorplan, and stop at `floorplanQuantityTarget`. Preserve application history so both page creation and placement are safe to retry. Because vision models can be imprecise at spatial localization and counting, keep generated marks editable and visibly described as reviewable in the shared findings UI.

Do not leave an approved floorplan with zero locations in a dead-end state. Offer a separate focused location pass over the extracted one-page PDF, constrained to exact floorplan-ready BOM candidates from the stored inspection. For dense drawings, analyze overlapping enlarged tiles through independent high-detail requests rather than asking one model response to search every crop; build tiles from the visible PDF crop box, transform tile-local points back to that full-page coordinate system, and merge overlap duplicates. This keeps AI coordinates aligned with the same drawing rectangle rendered by Floorplan Designer instead of an offset media box. Supply the current BOM row's captured `floorplanLabelText`, part number, type, description, and expected project quantity so color, a stale inspection label, or weak global recall does not hide otherwise supported marks. Require every tile request to complete before accepting a replacement, and keep the previous set when any tile fails. Persist locations back onto the proposal and require a separate Place Symbols confirmation. If users explicitly re-scan an applied proposal, remove only annotations whose source analysis and prior placement provenance match that proposal, and only after the replacement scan returns a non-empty result; never remove manual symbols or discard a usable prior set on an empty scan. On the Angular side, never insert a raw backend workspace payload directly into live document-library state: run it through `ProjectDocLibraryStorageService` hydration so blob-backed versions receive `contentUrl`, generate the changed PDF thumbnail when possible, and emit the hydrated workspace to both Project Detail and Sales Quick Start. Floorplan Designer launch paths must also derive the version-content endpoint from stable workspace/file/version IDs when a stale record lacks `contentUrl`, rather than opening an empty designer.

Creating a reusable device from a document proposal is a separate, explicitly confirmed global catalog action. Allow it only when the stored proposal identifies a canonical master part and has a usable, non-conflicting quantity. Prefill name, short name, category, floorplan inclusion, legend label, and labor, but post the user's confirmed values to a document-scoped endpoint that reloads the proposal and part. Use the existing device-from-part creation path, preserve retry idempotency, record the creation on the analysis, and replace only that proposal's catalog match with the resulting exact device. Do not claim to have extracted symbol artwork from a legend unless a stored crop includes page and bounding-box provenance; use the legend text label/bubble until then.

Translate OpenAI provider failures into sanitized API errors instead of returning raw SDK messages. Quota exhaustion remains HTTP `429` with code `OPENAI_QUOTA_EXCEEDED` and `retryable: false`; transient rate limiting uses `OPENAI_RATE_LIMITED` and `retryable: true`. Guard a document version against concurrent duplicate inspections in both the route process and dialog.

Long-running inspections must report milestone progress to the server console and persist the same sanitized stage information on the running analysis record. Emit periodic server heartbeats while waiting for the OpenAI analysis response. The Angular dialog polls the existing GET inspection route during the POST and shows the current stage plus elapsed time. Treat progress percentages as coarse pipeline markers; do not imply page-level completion that the provider has not reported.

The inspection GET route returns the latest persisted attempt. Normalize legacy stored provider failures before returning them so raw SDK messages are not exposed. Opening the findings dialog reuses a completed result, resumes polling a genuinely owned running attempt, and automatically starts a fresh POST only when no attempt exists. Failed, interrupted, timed-out, and cancelled attempts must remain visible until the user explicitly chooses Re-inspect. A persisted running record without a process-local owner must be marked interrupted; a run beyond the configured maximum runtime must be aborted and marked timed out. Provide an explicit Cancel action that aborts an owned SDK request and persists terminal state. Bound lookup and POST waits with explicit timeouts, avoid per-poll console spam, and never leave the dialog in an unbounded spinner. Keep the findings dialog open on backdrop clicks, Escape, and navigation; only its visible close controls should dismiss it.

## Angular API Pattern

Angular uses:

- standalone components
- `HttpClient`
- `firstValueFrom` or `subscribe`, depending on nearby style
- schemas in `src/app/schemas`
- common services in `src/app/common/services`

Before adding direct HTTP calls in another component, check whether a common service already owns that domain. Good candidates for service extraction are project document library, user preferences, project settings, workspace locks, device/part price sync, and Azure Maps.

## Angular UI Reuse

Prefer existing common components:

- `PageToolbar` for page framing and auth/user menu behavior.
- `NavToolbar` for page-group navigation.
- `FirewireBomWorksheetComponent` for BOM worksheet editing.
- `FirewireFloorplansComponent` for floorplan/project drawing views.
- `FirewireDocLibraryExplorerComponent` for document library workflows.
- `DevicedetailComponent` for device detail editing.

Avoid creating another page-local table/toolbar/filter pattern without checking whether it can be shared. Several pages already duplicate filter/sort/page-size persistence around `MatTableDataSource`; this is a refactor candidate.

## Project Detail And Sales Quick Start Parity

Project Detail (`firewire-ui/src/app/pages/projects/project.page.*`) and Sales Quick Start (`firewire-ui/src/app/pages/sales/sales-project.page.*`) expose many of the same estimating workflows to different entry points. Treat them as paired surfaces, not separate feature islands.

When touching any of these workflows, inspect and update both surfaces in the same change:

- BOM rows, section totals, device snapshots, floorplan-symbol synchronization, and BOM save behavior.
- Floorplan listing, floorplan folders, uploads, moves, thumbnails, and designer launch behavior.
- Customer info used by project forms, setup sheets, quotes, and report previews. Project Detail and Sales Quick Start must use `FirewireCustomerInfoCardComponent` for the shared customer card/edit experience, including Business Point of Contact and the default edit mode when no customer data exists.
- Estimate summary totals, risk/proficiency, margin, tax handling, rounded pricing, quote labels, and report/customer-facing totals.
- Document-library records that are reused by floorplans or proposal output.

Prefer shared components such as `FirewireBomWorksheetComponent`, `FirewireCustomerInfoCardComponent`, `FirewireFloorplansComponent`, `FirewireEstimateSummaryComponent`, and shared storage/services before duplicating logic. If one surface must remain page-local temporarily, document the drift in `concerns-and-refactor-backlog.md` and include a small parity note in the final response.

## Contextual Control Help Pattern

When a button or compact control performs domain-specific work that may not be obvious from its label, pair it with a small clickable help icon directly beside the control with only a slight gap. Use Angular Material `MatTooltipModule`, `matTooltip`, and the shared classes `fw-control-help-button` and `fw-control-help-tooltip`. The help trigger should render as an icon only, without a bordered button container.

Keep the control label short and action-oriented. Put the human-readable explanation in the click-triggered tooltip. This avoids permanent instructional copy on data-focused pages while still making specialized behavior discoverable.

## Data Table Page Pattern

Pages whose primary purpose is a data table should use a fixed page frame with one internal data scroll area. Filters, criteria controls, status/notification text, page action buttons, and the table paginator/footer should remain visible without creating a second vertical page scrollbar.

For Angular Material tables, keep the paginator outside the table scrollport and let only the table data viewport scroll. Sticky header rows/cells must have opaque backgrounds and sufficient stacking order so row values never visually bleed through underneath the headers while scrolling. Do not solve table height by making the whole page scroll.

For non-table page shells that use the global `.page-root > .page-content` frame, place page content inside `.content-root` unless the page provides an equivalent local scroll container. The global page frame intentionally hides overflow; without a scrollable child, lower content becomes unreachable.

## View Preference Persistence Pattern

Any page that lets the user filter, sort, page, select categories/statuses/vendors, choose a data channel, change tabs, or otherwise alter the data view should persist those choices locally and restore them when the user returns. Treat this as an application law for data-focused screens, not a page-by-page preference.

Use `firewire-ui/src/app/common/services/view-preferences.service.ts` for new work instead of direct `localStorage` access in components. Preference keys should be stable and namespaced by feature and data scope, for example `firewire.parts.all.textFilter` or `firewire.parts.<vendorKey>.pageSize`. Scope keys more narrowly when the same page can show materially different datasets.

Read saved preferences during component initialization after route/entity scope is known and before applying table filters or loading dependent view state. If a route has a neutral/default form such as `/parts`, or a legacy/default route such as `/parts/all`, restore the saved data channel before falling back to an all/default channel. Do not let neutral navigation overwrite a saved data-channel preference; only explicit user selection of the default channel should store that default. Write preferences immediately when the user changes filters, sort, page size, selected criteria, data channel, or comparable view options. Keep these preferences local to the browser; use server-side user preferences only when the intended behavior is cross-device or tenant-wide.

## Styling

Global styles and theme variables live in:

- `firewire-ui/src/styles.scss`
- `firewire-ui/src/assets/_variables.scss`
- `firewire-ui/src/assets/_theme-colors.scss`
- `firewire-ui/src/assets/_sci-fi-theme.scss`

Feature SCSS files often contain substantial page-specific styling. When standardizing UI, extract reusable layout/table/filter/dialog styles deliberately rather than copying a page stylesheet into another feature.

All visible application scrollbars should match the Firewire sci-fi theme. Global WebKit scrollbar styling lives in `firewire-ui/src/styles.scss`; when adding a new local scroll container with `overflow: auto` or `overflow-y: auto`, also set the themed Firefox properties (`scrollbar-color: rgba(72, 221, 255, 0.45) rgba(8, 12, 20, 0.9)` and `scrollbar-width: thin`) unless the container already inherits them through a shared wrapper.

## Angular Control Shape Pattern

Interactive controls are square by default. Buttons, form fields, selects, dropdown panels, menus, autocomplete panels, datepicker panels, and other Angular Material control surfaces should use `border-radius: 0` unless the user explicitly asks for a rounded control.

Use the global control shape in `firewire-ui/src/styles.scss`; do not add page-local rounded overrides to Material wrappers such as `.mat-mdc-text-field-wrapper`, `.mat-mdc-select-panel`, `.mat-mdc-menu-panel`, or `.mdc-menu-surface`. If a future design intentionally needs rounded styling, opt in with the shared helper classes:

- `fw-rounded` for a normal rounded surface.
- `fw-pill` for pill shapes.
- `fw-circle` for true circular controls.

## Angular Dialog Pattern

All Angular Material dialogs should follow the shared Firewire dialog convention:

- Keep every dialog container and surface square with `border-radius: 0`; do not add rounded corners to `mat-dialog-content`, inner dialog shells, or custom dialog panes unless the user explicitly asks for an exception.
- Put a top-right icon button in the dialog titlebar that dismisses the dialog. Prefer the shared `fw-dialog-titlebar`, `fw-dialog-titlebar__text`, and `fw-dialog-titlebar__close` classes from `firewire-ui/src/styles.scss`.
- Prefer `Cancel` for footer dismiss buttons. Avoid `Close` unless the dialog is read-only and there is no possible editing or workflow state.
- Disabled action buttons must look clearly unavailable, not merely inactive by browser default. Use `[disabled]` and, when needed, an explanatory `title` or nearby status text.
- Before calling `MatDialog.open()` from a click or keyboard-triggered control, blur the currently focused page element so Angular Material does not set `aria-hidden` on an ancestor of the focused element. This avoids Chrome's "Blocked aria-hidden on an element because its descendant retained focus" warning and keeps focus behavior accessible.
- Confirmation/question dialogs that only contain text and action buttons should be compact and content-sized, not page-wide. Use `panelClass: 'fw-confirmation-dialog-pane'` with the shared `fw-confirmation-dialog` content class. Reserve wider dialog widths for dialogs that contain forms, tables, lists, previews, or multi-step workflow content.
- Form/table/list dialogs should fit their actual content instead of stretching into unused empty surface area. Do not set a hardcoded `width` in `MatDialog.open()` unless the content genuinely needs that exact width. Prefer `panelClass: 'fw-fit-content-dialog-pane'` and let the component host/content define `width: fit-content`, `max-width`, and any real `min-width` required for readable table columns. Exception: if dialog content expands after a user action, such as search results populating a table, reserve the final table width up front so the dialog does not jump from compact to wide while the user is typing.
- Delete and destructive action buttons must be red so users have a visual warning before destructive actions. Prefer `color="warn"` on Angular Material buttons and add `fw-danger-button` or `fw-delete-button` when a shared explicit class is clearer. Destructive `mat-menu-item` actions should use `fw-danger-menu-item` or `fw-delete-menu-item`.

## API Namespace Ownership

Use `/api/fieldwire/*` only for thin routes whose primary behavior is direct Fieldwire integration through `FieldwireSDK` or Fieldwire upload helpers. Use `/api/firewire/*` for Firewire app/domain workflows, settings, devices, parts, project documents, SharePoint/Microsoft Graph, Azure Maps/weather, user preferences, tenants, and any Firewire-owned workflow that may later export to Fieldwire.

Do not add blanket `/api/fieldwire` aliases for Firewire manifest items. When renaming or consolidating endpoints, update all Angular call sites in the same change. If a temporary compatibility route is unavoidable, make it route-specific, document the deprecation, and remove it once callers have moved.

## Response Compatibility

Existing response shapes vary between legacy `/api/fieldwire/*` routes and newer `/api/firewire/*` routes. Preserve nearby response shape conventions unless intentionally changing all call sites in the same change.
