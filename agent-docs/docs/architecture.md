# Firewire Architecture

## Repo Layout

The workspace root contains two main applications:

- `firewire-web`: Node/Express middleware API written in TypeScript.
- `firewire-ui`: Angular 22 SPA using standalone components and Angular Material.

`firewire-web` has its own Git repository in `firewire-web/.git`. The agent docs live under `firewire-web/agent-docs` so they are source controlled with the backend repo.

## Backend Boot Flow

Backend entrypoint:

- `firewire-web/src/index.ts`
- `firewire-web/src/core/bootstrap.ts`

`Bootstrap.start()` configures:

- `helmet`
- EJS views for startup failure rendering
- JSON body parsing with `JSON_BODY_LIMIT` defaulting to `50mb`
- optional MongoDB connection
- optional Postgres connection
- SQL Server connection from `SQLSRV`, `SQLDB`, `SQLUSER`, `SQLPWD`
- startup validation requiring `MISSIONSECRET`, SQL Server, and rows in `tenants`
- Entra token validation for `/api/*`
- manifest-based workspace route registration

SQL Server is exposed as `app.locals.sqlserver`.

Known backend environment keys are cataloged in `environment-variables.md`. Future agents should update that inventory when adding or renaming configuration.

## Backend Routing

Routes are discovered by `RouteResolver` from files containing `manifest.` under `firewire-web/src/workspaces`.

Important manifests:

- `src/workspaces/firewire/firewire.manifest.ts`
- `src/workspaces/fieldwire/fieldwire.manifest.ts`

Firewire routes include:

- about/runtime diagnostics
- sales/project workflows
- project settings
- user preferences
- device, part, vendor, import, device set, workspace storage, and document-library APIs
- SharePoint, Azure Maps/weather, tenants, and other Firewire-owned support APIs

Fieldwire routes include:

- accounts
- projects
- tasks
- forms
- AWS/temporary upload support used by direct Fieldwire flows

`/api/fieldwire/*` is reserved for endpoints whose primary job is direct Fieldwire integration. Firewire-owned app/domain endpoints must use `/api/firewire/*`, even when they participate in a later Fieldwire import/export workflow. Do not add blanket legacy `/api/fieldwire` aliases for Firewire manifest items.

The global `/api` middleware validates bearer tokens before manifest routes run. Individual manifests currently set `AuthStrategy.none`; this does not mean `/api` is unauthenticated because validation happens globally in `Bootstrap`.

## Database Layers

Core SQL connection:

- `src/core/databases/mssqldb.ts`

Legacy/general fieldwire repository:

- `src/workspaces/fieldwire/repository/sqldb.ts`

Newer Firewire repositories:

- `src/workspaces/firewire/repository/firewireproject.repository.ts`
- `src/workspaces/firewire/repository/firewireprojectsettings.repository.ts`
- `src/workspaces/firewire/repository/firewireuserpreferences.repository.ts`

The newer repositories generally use parameterized `mssql` requests and should be used as style references for new write paths.

## Storage

Project document binaries are stored in Azure Blob Storage through:

- `src/workspaces/firewire/data/azure-blob-document-storage.ts`

Configuration:

- `FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING`

`workspaceStorage` stores JSON metadata/state such as document library state and design/train-AI workspaces. Large files should go to blob storage, with metadata and blob names stored in SQL/workspace state.

## OpenAI Document Inspection

The initial OpenAI integration performs a traceable, per-document inspection over an existing project Document Library file version. The implementation is split across:

- `src/workspaces/firewire/ai/document-analysis.types.ts`: persisted result and provenance types.
- `src/workspaces/firewire/ai/document-analysis.schema.ts`: strict machine-output JSON Schema.
- `src/workspaces/firewire/ai/openai-document-analysis.service.ts`: official OpenAI JavaScript SDK, Files API, Responses API, validation, and temporary-file cleanup.
- `src/workspaces/firewire/data/firewire.document-analysis.data.ts`: authenticated Firewire API routes, project/workspace isolation, Azure Blob reads, and persisted analysis records.

Routes:

- `GET /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId?workspaceKey=...`
- `POST /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId` with `{ workspaceKey }`
- `POST /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/cancel` with `{ workspaceKey, analysisId }`
- `POST /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/apply` with `{ workspaceKey, analysisId, targetFields }`
- `POST /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/bom/apply` with `{ workspaceKey, analysisId, proposalIds }`
- `POST /api/firewire/projects/:projectId/document-analysis/files/:fileId/versions/:versionId/actions/bom/proposals/:proposalId/create-device` with user-confirmed quick-capture fields

The route requires a canonical Firewire project UUID and only accepts document workspace keys matching that project's UUID, project number, or linked Fieldwire ID. Results are stored separately from document metadata in `workspaceStorage` area `project-document-analysis`, keyed by canonical project UUID. This stage inspects one document version; project-wide reconciliation and vector-store retrieval are later stages.

Schema version 4 also compares document-supported project details with a bounded snapshot of the canonical Firewire project. The result may contain review-only `UPDATE_PROJECT_DETAIL` proposals for explicitly supported project and customer fields. Each proposal carries the target field, current and proposed values, value type, evidence classification, confidence, rationale, and source location. Inspection itself does not mutate the project. The apply route accepts only an analysis ID and selected target fields, reloads the stored proposals, detects stale current values, applies validated selections through the normal project repository, records project activity, and persists application history on the analysis record.

Schema version 4 may also contain review-only `ADD_BOM_DEVICE` candidates. Keep schedule quantity, counted drawing symbols, reconciled BOM quantity, and floorplan placement target as distinct fields. The server recomputes reconciliation deterministically and blocks a proposed quantity when schedule and drawing counts conflict. After validation, the server performs read-only matching against both reusable Firewire devices and the canonical master parts catalog, identifies which entity type matched, and labels the result as matched, possible, or not found. Model output must never select or create a global catalog record. Inspection does not write project state. A user may explicitly apply exact, non-conflicting catalog matches through the BOM action route; the server reloads stored proposals and current catalog records, creates point-in-time BOM snapshots in the `document-analysis` section, preserves provenance and placement targets, and records idempotent application history. Master-part matches create BOM-only rows and remain unavailable for floorplan placement until a Firewire device is selected or defined. Inspection and BOM application never create or mutate a global device or part; only the separate user-confirmed device-resolution action may do so.

The findings dialog may resolve a displayed canonical master-part candidate through an explicit Create Missing Device quick capture. The server reloads the stored proposal and part, creates or reuses the vendor/part device through the normal device creation path, links the part snapshot, records the user-confirmed device creation, and rebinds only that proposal to an exact device match. The quick capture defaults floorplan inclusion and the 1-4 character legend label, but the user must confirm the global catalog mutation. Legend artwork extraction is not part of this action: it requires a later page-region/crop artifact with source page and bounding-box provenance.

Running records include persisted progress stage, message, percentage, and update time. The POST route records and logs milestones for project-storage loading, OpenAI upload, model analysis, structured-output validation, and completion. While the POST remains open, the Angular findings dialog polls the GET route to show those milestones and elapsed time; percentages represent workflow stages, not page-level model completion. Active execution ownership is process-local. The GET route converts a persisted running record with no live owner into an interrupted failure after a server restart, and expires runs beyond `DOCUMENT_INSPECTION_MAX_RUNTIME_MS`. The cancel route aborts a live SDK request when owned by the current process and persists a terminal `cancelled` result either way.

## Angular App

Angular entrypoints:

- `firewire-ui/src/main.ts`
- `firewire-ui/src/app/app.config.ts`
- `firewire-ui/src/app/app.routes.ts`

Patterns:

- standalone components
- lazy route components
- Angular Material
- Angular CLI 22 `@angular/build` application, dev-server, extract-i18n, and Karma builders
- `HttpClient` with an auth interceptor
- common schemas under `src/app/schemas`
- common components/services under `src/app/common`
- feature pages under `src/app/pages`

Important shared UI pieces:

- `common/components/page-toolbar.ts`
- `common/components/nav-toolbar.ts`
- `common/components/firewire-bom-worksheet.component.ts`
- `common/components/firewire-floorplans.component.ts`
- `common/components/firewire-doc-library-explorer.component.ts`
- `common/components/devicedetail.component.ts`

## API Shape

The UI primarily calls:

- `/api/firewire/*` for Firewire domain workflows.
- `/api/fieldwire/*` only for direct Fieldwire integration endpoints.

Existing response shapes vary between `{ rows: [...] }`, `{ data: ... }`, and direct object responses. For new endpoints, prefer the local nearby convention, but use `{ data }` for single resources/commands and `{ rows }` for lists.
