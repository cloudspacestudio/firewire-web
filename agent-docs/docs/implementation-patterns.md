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

## Contextual Control Help Pattern

When a button or compact control performs domain-specific work that may not be obvious from its label, pair it with a small clickable help icon directly beside the control with only a slight gap. Use Angular Material `MatTooltipModule`, `matTooltip`, and the shared classes `fw-control-help-button` and `fw-control-help-tooltip`. The help trigger should render as an icon only, without a bordered button container.

Keep the control label short and action-oriented. Put the human-readable explanation in the click-triggered tooltip. This avoids permanent instructional copy on data-focused pages while still making specialized behavior discoverable.

## Data Table Page Pattern

Pages whose primary purpose is a data table should use a fixed page frame with one internal data scroll area. Filters, criteria controls, status/notification text, page action buttons, and the table paginator/footer should remain visible without creating a second vertical page scrollbar.

For Angular Material tables, keep the paginator outside the table scrollport and let only the table data viewport scroll. Sticky header rows/cells must have opaque backgrounds and sufficient stacking order so row values never visually bleed through underneath the headers while scrolling. Do not solve table height by making the whole page scroll.

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

## Response Compatibility

The app has legacy `/api/fieldwire/*` routes and newer `/api/firewire/*` routes. Some Firewire manifest classes expose legacy Fieldwire alias items. When renaming or consolidating endpoints, preserve aliases or update all Angular call sites in the same change.
