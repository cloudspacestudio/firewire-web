# Concerns And Refactor Backlog

This is a living list of drift, risks, and consolidation opportunities. It is not a command to fix everything in one pass.

## High-Value Concerns

1. SQL styles are mixed.

   Older repository code interpolates SQL strings with manual escaping. Newer Firewire repositories use parameterized `mssql` requests. New code should use parameters, and risky legacy paths should be refactored when touched for related work.

2. Audit column names are inconsistent.

   Legacy tables use `createat/createby/updateat/updateby`; newer tables use `createdAt/createdBy/updatedAt/updatedBy`. The business convention is clear, but naming differs. Follow existing table names when modifying tables and document any new naming decision.

3. Runtime schema creation and SQL scripts can drift.

   Some tables/columns are defined in `corpdb/*.sql`, while some are created or patched through `ensure*Schema()` methods. When schema changes are made, update both the runtime guard and source-controlled SQL scripts where applicable.

4. Angular table behavior is duplicated.

   Devices, device sets, vendors, materials, parts, and projects repeat filter/sort/page-size persistence patterns. A shared table state helper or common data table wrapper would reduce inconsistency.

5. Angular HTTP ownership is mixed.

   Some domains use common services, while many page components call endpoints directly. For complex domains, prefer services so auth, error handling, URL construction, and response normalization are consistent.

6. Auth config source of truth can be misunderstood.

   Runtime MSAL config generation is important. Static repo files should not be treated as production auth truth. See `auth-and-runtime-config.md`.

7. parts import compatibility aliases still exist.

   The old vendor-specific part tables and import paths have been removed, but `vwParts` still exposes Pascal-case aliases such as `PartNumber`, `MSRPPrice`, and `SalesPrice` so existing Angular BOM/device code can keep working while UI names are incrementally normalized.

8. Large component files carry mixed responsibilities.

   Some page/components combine UI state, API orchestration, transformation, and business rules. Good candidates for extraction are floorplan designer state, BOM worksheet operations, vendor import flows, and report generation.

9. Blob-backed documents still have legacy data URL compatibility.

   New document content should use Azure Blob Storage. Keep data URL fallback for old records unless doing a deliberate migration.

10. API response shapes vary.

   Existing code uses `{ rows }`, `{ data }`, and direct objects. New endpoints should follow nearby convention, but broader API consistency remains a cleanup opportunity.

11. Project Detail and Sales Quick Start can drift.

   These pages share core estimating concepts but still mix common components with page-local logic. Floorplans now use shared folder-capable UI, and Sales Quick Start uses `FirewireEstimateSummaryComponent`, but Project Detail still owns a large local summary implementation. Changes to BOMs, floorplans, customer info, summary/pricing, or quote/report output should update both pages in the same pass or extract the behavior into a shared component/service.

## Suggested Consolidation Sequence

1. Agent documentation and architectural memory.

   Keep these docs current so future sessions start from the same mental model.

2. SQL safety standard.

   Add a short repository guide and gradually convert touched write paths to parameterized `mssql` requests.

3. Shared Angular table state.

   Extract localStorage-backed filter/sort/page-size behavior into a small utility or service. Apply first to device sets/materials/vendors because they share obvious patterns.

4. Device, part, and device set service boundaries.

   Add Angular services for device catalog, vendor parts, and device sets where pages currently duplicate direct HTTP calls.

5. Project Detail / Sales Quick Start estimate consolidation.

   Move remaining duplicated project summary/pricing/customer-info/report logic behind shared components or services. Start by reconciling Project Detail's page-local summary with `FirewireEstimateSummaryComponent` so Sales Quick Start and Project Detail cannot drift on totals, tax, labels, or rounding.

6. Canonical parts naming cleanup.

   Gradually migrate Angular components from compatibility aliases to canonical `partNumber`, `description`, `msrp`, and `cost` fields. Preserve snapshots, preview validation, restore, vendor config, and run history.

7. BOM snapshot contract.

   Document and test the rule that BOM rows preserve point-in-time device data and hidden `bomRowParts` preserve the device-part cost snapshots used to produce that row.

8. Runtime auth config verification.

   Locate or add the deployment/runtime auth config generation path and document exact generated file names and environment variables.

## Potential Mistakes To Watch For

- Adding a device to a BOM by reference only, causing future price changes to mutate old estimates.
- Creating a new SQL table without audit fields.
- Adding a required SQL column without a default/migration for existing rows.
- Adding a frontend API call with `fetch` that bypasses bearer token handling.
- Adding project document binaries into SQL JSON payloads instead of blob storage.
- Creating a new route outside manifest registration.
- Removing `/api/fieldwire/*` aliases without updating old UI call sites.
- Treating `AuthStrategy.none` in a manifest as an instruction to skip global `/api` auth.
- Copying another page's SCSS/table code instead of extracting a shared primitive when the behavior is the same.
- Updating only Project Detail or only Sales Quick Start for a shared estimating workflow and leaving the paired page with stale totals, labels, floorplan behavior, or report data.
