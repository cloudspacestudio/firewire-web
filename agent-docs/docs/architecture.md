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
- SQL Server connection from `SQLSRV`, `SQLDB`, `SQLUSER`, `SQLPWD`; runtime defaults are a 30-second connection timeout and 120-second request timeout, optionally overridden by `SQL_CONNECTION_TIMEOUT_MS` and `SQL_REQUEST_TIMEOUT_MS`
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

Responses requests set `store: false`. Source documents uploaded to the OpenAI Files API are tracked as soon as upload succeeds, deleted in the inspection service's `finally` path, and also carry a 24-hour expiration as a process-crash fallback. Firewire does not currently create OpenAI vector stores for document inspection.

Deleting a Firewire project coordinates with document analysis before removing project SQL data. It blocks new analysis writes, aborts and drains active inspections, retries deletion of any known OpenAI file whose earlier cleanup did not complete, and deletes the canonical project's `project-document-analysis` workspace row plus project-owned worksheet, `bomRowParts`, and activity records. The delete fails without removing the project if a known retained OpenAI file cannot be cleaned up, so its identifier remains available for a later retry. In-flight analysis/action handlers cannot recreate analysis storage after deletion.

Schema version 6 compares document-supported project details with a bounded snapshot of the canonical Firewire project. The result may contain review-only `UPDATE_PROJECT_DETAIL` proposals for explicitly supported project and customer fields. Each proposal carries the target field, current and proposed values, value type, evidence classification, confidence, rationale, and source location. Inspection itself does not mutate the project. The apply route accepts only an analysis ID and selected target fields, reloads the stored proposals, detects stale current values, applies validated selections through the normal project repository, records project activity, and persists application history on the analysis record.

Schema version 6 may also contain review-only `ADD_BOM_DEVICE` candidates. Keep schedule quantity, counted drawing symbols, reconciled BOM quantity, and floorplan placement target as distinct fields. Each candidate also carries a `legendSymbol` record: whether distinct artwork was found, its one-based source PDF page, a tight normalized top-left bounding box, confidence, and source provenance. After the whole-document result is validated and normalized, PDF inspections use the PDF text layer to scan every page for explicit legend headings. The server renders detected source pages at a bounded high resolution with PDFium, which honors the displayed crop box and page rotation, and extracts each legend region from those pixels. The focused localization request receives those raster images and returns crop-local glyph bounds, which the server transforms back to normalized displayed-sheet bounds. Broad-pass page citations are advisory, so page 1 and cited/floorplan pages are only whole-page fallbacks when no explicit legend can be found anywhere. When a heading is found, unrelated whole sheets must not be sent alongside the legend crops. Do not render complex construction sheets through PDF.js plus an in-process native canvas: expanding their drawing display lists can terminate Node. This second pass searches legends row by row, must return only supplied proposal IDs, and replaces whole-document bounds only with a usable focused result. Boxed abbreviations such as the complete red rectangle around `FACP` and the complete red square around `F` are device artwork, not mere text. Treat the broad pass's `symbolLabel` as a fallible hint: the printed description/model/part identity in the matched legend row controls, and the focused pass may correct `symbolLabel` from the glyph's actual visible text. Extraction/provider failure preserves the broader inspection rather than fabricating artwork. The server recomputes quantity reconciliation deterministically and blocks a proposed quantity when schedule and drawing counts conflict. After validation, the server performs read-only matching against both reusable Firewire devices and the canonical master parts catalog, identifies which entity type matched, and labels the result as matched, possible, or not found. Exact matches are then compared with current project BOM rows by canonical device or part identity; existing rows and repeated proposals for the same entity remain visible as review evidence but are marked ineligible and excluded from the Apply BOM count. Model output must never select or create a global catalog record. Inspection does not write project state. A user may explicitly apply exact, non-conflicting catalog matches through the BOM action route; the server reloads stored proposals and current catalog records, rechecks project-BOM uniqueness, creates point-in-time BOM snapshots in the `document-analysis` section, preserves provenance and placement targets, and records idempotent application history. Master-part matches create BOM-only rows and remain unavailable for floorplan placement until a Firewire device is selected or defined. Inspection and BOM application never create or mutate a global device or part; only the separate user-confirmed device-resolution action may do so.

Schema version 6 includes `CREATE_FLOORPLAN` proposals and normalized symbol-location evidence for every usable PDF plan page found in a source document. Firewire resolves a proposal against the current hidden `floorplans` document-library folder by durable creation history, durable placement history, and source-proposal provenance before falling back to a normalized drawing-name comparison. Completed-analysis reads and floorplan-action responses re-evaluate that live relationship, so the findings dialog must not offer `Create Floorplan` after the proposal has already created a floorplan or placed symbols on an existing one, including after the floorplan is renamed. On explicit approval, the backend uses `pdf-lib` to copy only the identified one-based source page into a standalone PDF, uploads it through the normal Azure Blob document contract, and creates the usual floorplan file/design record. Multiple pages can therefore produce independent recommendations. Floorplan and placement application histories make retries idempotent. The placement action reloads the current project BOM and document library, accepts only exact floorplan-ready device rows, writes designer-native annotations linked by `bomRowId`, rejects duplicate source placement IDs, and treats the reviewed aggregate placement count as a lower bound for the affected BOM quantity and `floorplanQuantityTarget`. This lets provisional or unknown takeoff quantities grow from reviewed floorplan discoveries without reducing a larger known quantity. Existing same-name floorplans may receive placements without creating another base file. The shared findings dialog supplies the same workflow to Project Detail and Sales Quick Start.

When the whole-document pass returns no usable locations, the findings dialog exposes a focused `locate-symbols` action after the floorplan exists. That route loads the extracted one-page PDF and renders the complete displayed page to a canonical PNG before dividing it into overlapping enlarged image tiles. Rendering first resolves the PDF crop box and `/Rotate` metadata into the same top-left landscape or portrait coordinate system used by Floorplan Designer; raw PDF page-box coordinates must not drive placement tiles. The route limits candidates to exact floorplan-ready devices already represented on the current project BOM and runs an independent high-detail Structured Output request for each PNG tile with bounded concurrency. Candidate context uses the current BOM row's captured floorplan label, device snapshot, and expected project quantity as a recall aid. Tile-local pixel coordinates are transformed back into canonical full-page normalized coordinates and overlap detections are merged by candidate identity and spatial proximity. A failed tile fails the entire replacement rather than persisting a partial low-recall result. Placement remains a separate explicit user action. An explicit replacement scan may remove only annotations generated by that inspection after the complete new scan returns a non-empty result; it preserves manual symbols and retains the prior AI set when the replacement scan finds nothing.

The findings dialog may resolve a displayed canonical master-part candidate through an explicit Create Missing Device quick capture. The server reloads the stored proposal, part, source document version, and provenance-backed legend bounds; creates or reuses the vendor/part device through the normal device creation path; and rebinds only that proposal to an exact device match. Inspection materializes every localized glyph from the same reviewed legend raster into a small transparent PNG preview before persisting the completed analysis. The BOM recommendation must show that exact proposed device icon, source PDF page, and confidence before device creation; when no preview exists, it must explicitly say that no icon will be created instead of relying on an ambiguous “captured” flag. When the user creates a device, the server reuses the reviewed persisted preview. If necessary, it can regenerate the displayed source-page region with PDFium while honoring page rotation. The result is added to the global `AI Inspection Legends` ICONS group, assigned to an otherwise iconless device, and recorded with the device-creation application. The user must still confirm this global catalog mutation. Never overwrite an icon selected outside the AI inspection group. A later, explicitly confirmed inspection resolution may refresh an icon already owned by `AI Inspection Legends`, allowing corrected extraction bounds to repair earlier AI artwork. Because BOM rows snapshot device icon data and Floorplan Designer consumes those snapshots, the captured glyph is immediately available to subsequent BOM/floorplan use.

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
