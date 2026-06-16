# Firewire Architecture

## Repo Layout

The workspace root contains two main applications:

- `firewire-web`: Node/Express middleware API written in TypeScript.
- `firewire-ui`: Angular 19 SPA using standalone components and Angular Material.

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

Fieldwire routes include:

- accounts
- projects
- tasks
- forms
- project documents
- AWS/temporary upload support
- SharePoint support

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

## Angular App

Angular entrypoints:

- `firewire-ui/src/main.ts`
- `firewire-ui/src/app/app.config.ts`
- `firewire-ui/src/app/app.routes.ts`

Patterns:

- standalone components
- lazy route components
- Angular Material
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
- `/api/fieldwire/*` for Fieldwire integration and legacy endpoints.

Existing response shapes vary between `{ rows: [...] }`, `{ data: ... }`, and direct object responses. For new endpoints, prefer the local nearby convention, but use `{ data }` for single resources/commands and `{ rows }` for lists.
