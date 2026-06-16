# Firewire-Web Environment Variables

This inventory records known `firewire-web` environment keys. Keep values out of source control. Update this document when adding, removing, or renaming configuration.

## Fieldwire

- `fieldwire`

This appears to be a Fieldwire integration setting. Verify the active code path before renaming because the key is lowercase.

## Core Startup

- `MISSIONSECRET`
- `MONGOURL`
- `MONGODBNAME`
- `AZURE_MAPS_SUBSCRIPTION_KEY`

`MISSIONSECRET` is required by backend bootstrap. MongoDB is optional framework support. Azure Maps supports mapping, geocoding, and weather-style project features where used.

## Firewire / Entra Auth

- `FIREWIRETENANTID`
- `FIREWIRECLIENTID`
- `FIREWIRESECRET`

Backend token validation currently accepts `FIREWIRETENANTID` as the legacy alias for `ENTRA_TENANT_ID` and `FIREWIRECLIENTID` as the legacy alias for `ENTRA_API_AUDIENCE`.

`FIREWIRESECRET` is secret material. Verify the active runtime config/deployment path before changing it. Do not expose it to Angular client code.

Related code-supported names:

- `ENTRA_TENANT_ID`
- `ENTRA_API_AUDIENCE`
- `ENTRA_REQUIRED_SCOPES`

## SharePoint

- `SHAREPOINT_TENANT_ID`
- `SHAREPOINT_CLIENT_ID`
- `SHAREPOINT_CLIENT_SECRET`
- `SHAREPOINT_LIBRARY_URL`

SharePoint integration code also supports optional `SHAREPOINT_SITE_ID`, `SHAREPOINT_DRIVE_ID`, `SHAREPOINT_PROJECTDOCUMENTS_FOLDER_ROOT`, and upload-size settings. Treat client secrets as server-only.

## Azure Blob Document Library

- `FIREWIRE_DOC_LIBRARY_BLOB_CONNECTION_STRING`

Used by `AzureBlobDocumentStorage` for project document content. SQL/workspace storage should retain metadata and blob pointers, not raw file bodies, for new flows.

## Primary SQL Server

- `SQLSRV`
- `SQLDB`
- `SQLUSER`
- `SQLPWD`

This is the main Firewire SQL Server connection used by backend bootstrap and repositories. `SQLSRV` and `SQLDB` are required for normal backend operation. `SQLUSER`/`SQLPWD` are used for SQL authentication; local Windows authentication paths exist in bootstrap for some local setups.

## Migration Source: Firetrol DB

- `MIG_SRC_SQL_SERVER`
- `MIG_SRC_SQL_DATABASE`
- `MIG_SRC_SQL_USER`
- `MIG_SRC_SQL_PASSWORD`

Used by the SQL Server migration utility as source database settings.

## Migration Destination: Cloudspace Studio DB

- `MIG_DST_SQL_SERVER`
- `MIG_DST_SQL_DATABASE`
- `MIG_DST_SQL_USER`
- `MIG_DST_SQL_PASSWORD`

Used by the SQL Server migration utility as destination database settings.

## Agent Guidance

- Never print or commit environment values.
- Prefer documenting variable names and purpose only.
- When changing auth behavior, update both this file and `auth-and-runtime-config.md`.
- When changing storage, SQL, or migration behavior, update this file and the relevant architecture or implementation-pattern docs.
