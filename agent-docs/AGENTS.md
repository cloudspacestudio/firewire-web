# Firewire Agent Guide

This folder is the project memory for future Codex, Copilot, and other AI-agent sessions. Read this file before changing the Firewire monorepo, then use the companion docs in `agent-docs/docs`.

## Application Context

Firewire is a line-of-business system for planning and executing fire and safety device projects. Sales users receive customer documents and floorplans, create estimates, add devices to floorplans, compose project BOMs, and move accepted work into design or install workflows. The system also exports approved project information into Fieldwire, a third-party construction planning system.

The monorepo contains:

- `firewire-web`: Node/Express TypeScript middleware API.
- `firewire-ui`: Angular SPA client.
- `firewire-web/src/workspaces/fieldwire`: legacy Fieldwire-facing API, SQL repository, vendor/device/part domain, and SQL scripts.
- `firewire-web/src/workspaces/firewire`: newer Firewire APIs, project repositories, document storage, user preferences, and project settings.

## First Moves For Future Agents

1. Inspect `agent-docs/docs/architecture.md` and `agent-docs/docs/implementation-patterns.md`.
2. Search for an existing component, repository method, schema, route, or service before adding a new one.
3. Prefer the newer parameterized `mssql` request pattern over interpolated SQL.
4. Preserve audit fields on every SQL table: created by, created at, updated by, and updated at. Existing legacy tables often spell these as `createby`, `createat`, `updateby`, `updateat`; newer Firewire tables use `createdBy`, `createdAt`, `updatedBy`, `updatedAt`.
5. Treat runtime auth config as deployment-owned. Do not assume static Angular environment values are authoritative.
6. Keep generated/build output out of source edits unless the user explicitly asks for it.

## Documentation Consistency Rule

Treat these docs as part of the implementation contract. Code and documentation must move together.

For every change:

1. Read this guide and relevant `agent-docs/docs` files before editing.
2. Check whether the change affects architecture, domain behavior, auth/runtime config, environment variables, database schema, SQL conventions, API contracts, shared UI patterns, storage behavior, deployment assumptions, or agent workflow.
3. If it does, update the relevant documentation in the same atomic change as the implementation.
4. Do not defer required documentation updates to a later task.
5. If no documentation update is needed, say so explicitly in the final response, commit message, or PR description.

Use `docs/change-checklist.md` as the pre-change and pre-finish checklist.

## Canonical Patterns

- Backend routes are registered through workspace manifests. Add API routes by adding manifest items to a workspace data class and pushing them from the workspace manifest.
- Backend route handlers should be thin: validate request data, resolve `userId`, call a repository/service, return `{ data }` or `{ rows }` consistently with nearby endpoints.
- SQL writes should use `pool.request().input(...).query(...)` when adding new code.
- For persisted mutable workspace state, reuse `SqlDb.saveWorkspaceStorage` and `workspaceStorage` if the data is JSON workspace state rather than normalized relational data.
- For physical project documents, use `AzureBlobDocumentStorage`; SQL/workspace storage should keep metadata and blob pointers, not large file payloads.
- Angular uses standalone lazy route components, Angular Material, `HttpClient`, and common components/services under `firewire-ui/src/app/common`.
- Reuse `PageToolbar`, `NavToolbar`, `FirewireBomWorksheetComponent`, `FirewireFloorplansComponent`, `FirewireDocLibraryExplorerComponent`, and existing common services before creating page-local equivalents.
- For upload/preview/download/delete file workflows, reuse or create common media/document services under `firewire-ui/src/app/common/services`; keep bytes in Azure Blob Storage and keep SQL/workspace records as metadata plus blob references.
- Data-table focused pages must avoid nested vertical page/table scrolling. Keep filters, criteria, notifications, action headers, and paginator/footer visible in the page frame; only the table data viewport should scroll. Sticky table headers must have opaque backgrounds so rows never bleed through underneath.
- Pages with filters, sort state, page size, selected criteria, tabs, or other view options that control underlying data must persist the user's latest selections locally and reapply them when the user returns to the page. Use the shared Angular `ViewPreferencesService` with stable namespaced keys instead of page-local `localStorage` access.
- Angular controls, form fields, menus, selects, dropdown panels, buttons, and other interactive control surfaces default to square corners (`border-radius: 0`). Use the shared opt-in rounded helpers only when a control is explicitly intended to be rounded.
- Angular Material dialogs must use square containers (`border-radius: 0`), include a top-right icon button that dismisses the dialog, prefer `Cancel` over `Close` for non-primary dismiss actions, and show an obvious disabled state for unavailable action buttons.
- Simple confirmation/question dialogs that contain only text and action buttons must be compact, not page-wide. Use the shared confirmation dialog pane/content classes for these; reserve wide dialogs for embedded forms, tables, lists, or multi-step workflows.
- Delete/destructive action buttons must be red as a warning. Use Material `color="warn"` and/or the shared `fw-danger-button`/`fw-delete-button` classes for buttons, and `fw-danger-menu-item`/`fw-delete-menu-item` for destructive menu actions.
- When an action button has domain-specific behavior that may not be obvious from the label, place a small clickable help icon immediately next to the control. Use `fw-control-help-button` with a click-triggered Angular Material tooltip and `fw-control-help-tooltip` for the tooltip panel. Keep the label concise and put the human-readable explanation in the tooltip instead of adding permanent instructional text to the page.

## Product Rules To Preserve

- Projects can be associated with divisions/project types: `Fire Alarm`, `Sprinkler`, or `Security`.
- Devices are the core business object. A device represents one or more parts/materials.
- Categories are not standalone Firewire records. Devices own free-text `categoryName` and `includeOnFloorplan`; use those fields for BOM/floorplan category/type text.
- Device cost and labor are derived from or coordinated with the parts/materials that compose the device.
- Device Sets are user-created groupings of devices that help quickly populate a BOM.
- When a device is added to a BOM, material/BOM data must represent the device at that point in time so future device or part price changes do not rewrite historical project estimates.
- Vendor/part imports use one master `parts` repository and the vendor-configurable parts import flow. Do not add vendor-specific part tables or part-import paths.

## Critical Auth Note

MSAL/auth settings are created at runtime in deployed environments. Future agents must not treat static repository files as the final source of truth for production authentication. See `docs/auth-and-runtime-config.md`.

## Documentation Index

- `docs/architecture.md`: repo layout, backend boot flow, route registration, Angular structure.
- `docs/domain-model.md`: tenants, projects, devices, parts/materials, BOMs, floorplans, documents, Fieldwire.
- `docs/parts-model.md`: master parts table, import flow, routes, and migration notes.
- `docs/sql-naming-conventions.md`: SQL table/view naming, audit fields, constraints, and compatibility alias rules.
- `docs/implementation-patterns.md`: conventions for backend, SQL, Angular, storage, and style reuse.
- `docs/auth-and-runtime-config.md`: Entra/MSAL behavior and runtime config warnings.
- `docs/environment-variables.md`: known `firewire-web` environment keys by subsystem.
- `docs/change-checklist.md`: mandatory pre-change and pre-finish checklist for agents.
- `docs/concerns-and-refactor-backlog.md`: current drift, risks, and suggested consolidation sequence.

Update these docs when making a structural decision or standardizing a new pattern.
