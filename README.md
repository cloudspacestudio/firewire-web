# firewire-web

Backend API for the Firewire Angular SPA.

This service:
- exposes `/api/firewire/*` and `/api/fieldwire/*` endpoints
- validates Entra bearer tokens for all `/api/*` routes
- connects to the Firewire SQL Server database
- optionally integrates with Azure Maps and SharePoint

## Required Environment Variables

These variables are required for the API to start and serve authenticated requests.

| Variable | Purpose |
|---|---|
| `MISSIONSECRET` | Required startup secret checked during bootstrap. The server refuses to start without it. |
| `SQLSRV` | SQL Server host name used for the primary Firewire database connection. |
| `SQLDB` | SQL Server database name used by the application. |
| `SQLUSER` | SQL Server login for the application. |
| `SQLPWD` | Password for `SQLUSER`. |
| `ENTRA_TENANT_ID` | Microsoft Entra tenant ID used to validate incoming bearer tokens. Legacy alias: `FIREWIRETENANTID`. |
| `ENTRA_API_AUDIENCE` | Accepted Entra token audience / app ID for the API. Legacy alias: `FIREWIRECLIENTID`. |

## Required for Auth Behavior

These are not strictly required because defaults exist, but they are important to understand.

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port for the API. Defaults to `3000`. |
| `ENTRA_REQUIRED_SCOPES` | Comma-separated scopes or app roles accepted by the API. Defaults to `user_impersonation`. |

## Optional Azure Maps Variables

These are required only if you want address geocoding, project map configuration, or weather forecast features to work.

| Variable | Purpose |
|---|---|
| `AZURE_MAPS_SUBSCRIPTION_KEY` | Primary Azure Maps key used by geocoding, weather, and the authenticated map-config endpoint. |
| `AZURE_MAPS_KEY` | Fallback alias for the Azure Maps key if `AZURE_MAPS_SUBSCRIPTION_KEY` is not set. |
| `AZURE_MAPS_BASE_URL` | Override for the Azure Maps base URL. Defaults to `https://atlas.microsoft.com`. |
| `AZURE_MAPS_API_VERSION` | API version for address geocoding/normalization. Defaults to `1.0`. |
| `AZURE_MAPS_WEATHER_API_VERSION` | API version for weather forecast calls. Defaults to `1.1`. |

If these are not configured:
- map key endpoints return no key
- address geocoding falls back to `Not Configured`
- weather endpoints return `not-configured`

## Optional SharePoint Variables

These are required only for SharePoint-backed library browsing and document uploads.

| Variable | Purpose |
|---|---|
| `SHAREPOINT_TENANT_ID` | Entra tenant ID for the SharePoint / Microsoft Graph app registration. |
| `SHAREPOINT_CLIENT_ID` | Client ID for the SharePoint / Graph app registration. |
| `SHAREPOINT_CLIENT_SECRET` | Client secret for the SharePoint / Graph app registration. |
| `SHAREPOINT_SITE_ID` | Default SharePoint site ID used by upload/list/read endpoints when a request does not provide one. |
| `SHAREPOINT_DRIVE_ID` | Default SharePoint document library drive ID used by upload/list/read endpoints when a request does not provide one. |
| `SHAREPOINT_LIBRARY_URL` | Default SharePoint library URL used to resolve `siteId` and `driveId` when those values are not passed directly. |
| `SHAREPOINT_PROJECTDOCUMENTS_FOLDER_ROOT` | Root folder path used by the project-documents upload endpoint when constructing project folders. |
| `SHAREPOINT_MAX_UPLOAD_BYTES` | Maximum allowed upload size in bytes for SharePoint-backed document uploads. Defaults to `26214400` (25 MB). |

## Optional Legacy / Framework Variables

These are supported by the underlying framework, but they are not required for the current Firewire SQL Server setup.

| Variable | Purpose |
|---|---|
| `APPNAME` | Optional app name used by some database clients for logging/telemetry. |
| `JWTSECRET` | Used only by the legacy/basic JWT authority code path, not by the Entra bearer-token API flow. |
| `MONGOURL` | Enables the optional MongoDB connection. |
| `MONGODBNAME` | Database name for the optional MongoDB connection. |
| `PGHOST` | Enables the optional PostgreSQL connection. |
| `PGPORT` | Port for the optional PostgreSQL connection. |
| `PGDATABASE` | Database name for the optional PostgreSQL connection. |
| `PGUSER` | Username for the optional PostgreSQL connection. |
| `PGPWD` | Password for the optional PostgreSQL connection. |
| `ENTRA_AUTHORITY` | Exposed by the About endpoint for diagnostics/config display. |
| `REQUIRED_SCOPE` | Referenced by the About endpoint for diagnostics/config display. |
| `FIREWIRE_REQUIRED_SCOPE` | Referenced by the About endpoint for diagnostics/config display. |

## SQL Server Migration Utility Variables

These are only needed when running:

```bash
npm run db:migrate:sqlserver
```

| Variable | Purpose |
|---|---|
| `MIG_SRC_SQL_SERVER` | Source SQL Server host. |
| `MIG_SRC_SQL_DATABASE` | Source database name. |
| `MIG_SRC_SQL_USER` | Source database user. |
| `MIG_SRC_SQL_PASSWORD` | Source database password. |
| `MIG_SRC_SQL_PORT` | Source SQL Server port. Defaults to `1433`. |
| `MIG_SRC_SQL_ENCRYPT` | Source connection encrypt flag. Defaults to `true`. |
| `MIG_SRC_SQL_TRUST_SERVER_CERTIFICATE` | Source trust-server-certificate flag. Defaults to `false`. |
| `MIG_DST_SQL_SERVER` | Target SQL Server host. |
| `MIG_DST_SQL_DATABASE` | Target database name. |
| `MIG_DST_SQL_USER` | Target database user. |
| `MIG_DST_SQL_PASSWORD` | Target database password. |
| `MIG_DST_SQL_PORT` | Target SQL Server port. Defaults to `1433`. |
| `MIG_DST_SQL_ENCRYPT` | Target connection encrypt flag. Defaults to `true`. |
| `MIG_DST_SQL_TRUST_SERVER_CERTIFICATE` | Target trust-server-certificate flag. Defaults to `false`. |
| `MIG_SCHEMA` | Schema to migrate. Defaults to `dbo`. |
| `MIG_TABLES` | Optional comma-separated table filter. If omitted, all tables in the schema are migrated. |

## Minimal Local Development Example

```env
PORT=3000
MISSIONSECRET=change-me

SQLSRV=your-sql-server-host
SQLDB=firewire
SQLUSER=your-sql-user
SQLPWD=your-sql-password

ENTRA_TENANT_ID=your-entra-tenant-id
ENTRA_API_AUDIENCE=your-api-app-id
ENTRA_REQUIRED_SCOPES=user_impersonation
```

Optional additions:

```env
AZURE_MAPS_SUBSCRIPTION_KEY=your-azure-maps-key

SHAREPOINT_TENANT_ID=your-tenant-id
SHAREPOINT_CLIENT_ID=your-client-id
SHAREPOINT_CLIENT_SECRET=your-client-secret
SHAREPOINT_SITE_ID=your-site-id
SHAREPOINT_DRIVE_ID=your-drive-id
SHAREPOINT_LIBRARY_URL=https://yourtenant.sharepoint.com/sites/yoursite/Shared%20Documents
SHAREPOINT_PROJECTDOCUMENTS_FOLDER_ROOT=Firewire Projects
```

## Start the API

```bash
npm start
```
