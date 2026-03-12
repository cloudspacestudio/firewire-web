import 'dotenv/config'
import * as mssql from 'mssql'

type ColumnMeta = {
    column_id: number
    name: string
    type_name: string
    max_length: number
    precision: number
    scale: number
    is_nullable: boolean
    is_identity: boolean
    is_computed: boolean
    computed_definition: string | null
    default_definition: string | null
}

type TableMeta = {
    schema_name: string
    table_name: string
}

type PrimaryKeyMeta = {
    constraint_name: string
    column_name: string
    key_ordinal: number
    is_descending_key: boolean
}

type ViewMeta = {
    schema_name: string
    view_name: string
    definition: string
}

const SOURCE_PREFIX = 'MIG_SRC_SQL'
const TARGET_PREFIX = 'MIG_DST_SQL'
const SQLSERVER_MAX_PARAMETERS = 2100

function readRequiredEnv(name: string): string {
    const value = process.env[name]
    if (!value || value.trim().length <= 0) {
        throw new Error(`Missing required environment variable: ${name}`)
    }
    return value.trim()
}

function readBooleanEnv(name: string, defaultValue: boolean): boolean {
    const value = process.env[name]
    if (!value || value.trim().length <= 0) {
        return defaultValue
    }
    return ['1', 'true', 'yes', 'y'].includes(value.trim().toLowerCase())
}

function readNumberEnv(name: string, defaultValue: number): number {
    const value = process.env[name]
    if (!value || value.trim().length <= 0) {
        return defaultValue
    }
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error(`Invalid numeric environment variable: ${name}=${value}`)
    }
    return Math.floor(parsed)
}

function readConfig(prefix: string): mssql.config {
    const server = readRequiredEnv(`${prefix}_SERVER`)
    const database = readRequiredEnv(`${prefix}_DATABASE`)
    const user = readRequiredEnv(`${prefix}_USER`)
    const password = readRequiredEnv(`${prefix}_PASSWORD`)
    const port = Number(process.env[`${prefix}_PORT`] || 1433)
    const encrypt = readBooleanEnv(`${prefix}_ENCRYPT`, true)
    const trustServerCertificate = readBooleanEnv(`${prefix}_TRUST_SERVER_CERTIFICATE`, false)

    return {
        server,
        database,
        user,
        password,
        port,
        options: {
            encrypt,
            trustServerCertificate,
            enableArithAbort: true
        }
    }
}

function qn(input: string): string {
    return `[${input.replace(/]/g, ']]')}]`
}

function fullTableName(schemaName: string, tableName: string): string {
    return `${qn(schemaName)}.${qn(tableName)}`
}

function getSchemaName(): string {
    return (process.env.MIG_SCHEMA || 'dbo').trim()
}

function getTableFilterSet(): Set<string> {
    const raw = (process.env.MIG_TABLES || '').trim()
    if (!raw) {
        return new Set<string>()
    }
    return new Set(
        raw.split(',')
            .map((s) => s.trim())
            .filter((s) => s.length > 0)
            .map((s) => s.toLowerCase())
    )
}

async function getTables(sourcePool: mssql.ConnectionPool, schemaName: string, includeTables: Set<string>): Promise<TableMeta[]> {
    const result = await sourcePool.request()
        .input('schemaName', mssql.NVarChar, schemaName)
        .query(`
            SELECT
                s.name AS schema_name,
                t.name AS table_name
            FROM sys.tables t
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            WHERE s.name = @schemaName
            ORDER BY t.name ASC
        `)

    const all = (result.recordset || []) as TableMeta[]
    if (includeTables.size <= 0) {
        return all
    }
    return all.filter((t) => includeTables.has(t.table_name.toLowerCase()))
}

async function getColumns(sourcePool: mssql.ConnectionPool, schemaName: string, tableName: string): Promise<ColumnMeta[]> {
    const result = await sourcePool.request()
        .input('schemaName', mssql.NVarChar, schemaName)
        .input('tableName', mssql.NVarChar, tableName)
        .query(`
            SELECT
                c.column_id,
                c.name,
                ty.name AS type_name,
                c.max_length,
                c.precision,
                c.scale,
                c.is_nullable,
                c.is_identity,
                CONVERT(bit, CASE WHEN cc.definition IS NULL THEN 0 ELSE 1 END) AS is_computed,
                cc.definition AS computed_definition,
                dc.definition AS default_definition
            FROM sys.columns c
            INNER JOIN sys.tables t ON t.object_id = c.object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.types ty ON ty.user_type_id = c.user_type_id
            LEFT JOIN sys.default_constraints dc
                ON dc.parent_object_id = c.object_id
               AND dc.parent_column_id = c.column_id
            LEFT JOIN sys.computed_columns cc
                ON cc.object_id = c.object_id
               AND cc.column_id = c.column_id
            WHERE s.name = @schemaName
              AND t.name = @tableName
            ORDER BY c.column_id ASC
        `)
    return (result.recordset || []) as ColumnMeta[]
}

async function getPrimaryKey(sourcePool: mssql.ConnectionPool, schemaName: string, tableName: string): Promise<PrimaryKeyMeta[]> {
    const result = await sourcePool.request()
        .input('schemaName', mssql.NVarChar, schemaName)
        .input('tableName', mssql.NVarChar, tableName)
        .query(`
            SELECT
                kc.name AS constraint_name,
                c.name AS column_name,
                ic.key_ordinal,
                ic.is_descending_key
            FROM sys.key_constraints kc
            INNER JOIN sys.tables t ON t.object_id = kc.parent_object_id
            INNER JOIN sys.schemas s ON s.schema_id = t.schema_id
            INNER JOIN sys.index_columns ic
                ON ic.object_id = kc.parent_object_id
               AND ic.index_id = kc.unique_index_id
            INNER JOIN sys.columns c
                ON c.object_id = ic.object_id
               AND c.column_id = ic.column_id
            WHERE kc.type = 'PK'
              AND s.name = @schemaName
              AND t.name = @tableName
            ORDER BY ic.key_ordinal ASC
        `)

    return (result.recordset || []) as PrimaryKeyMeta[]
}

function buildSqlType(col: ColumnMeta): string {
    const typeName = col.type_name.toLowerCase()
    if (['varchar', 'char', 'varbinary', 'binary'].includes(typeName)) {
        if (col.max_length === -1) {
            return `${qn(col.type_name)}(MAX)`
        }
        return `${qn(col.type_name)}(${col.max_length})`
    }
    if (['nvarchar', 'nchar'].includes(typeName)) {
        if (col.max_length === -1) {
            return `${qn(col.type_name)}(MAX)`
        }
        return `${qn(col.type_name)}(${Math.floor(col.max_length / 2)})`
    }
    if (['decimal', 'numeric'].includes(typeName)) {
        return `${qn(col.type_name)}(${col.precision},${col.scale})`
    }
    if (['datetime2', 'datetimeoffset', 'time'].includes(typeName)) {
        return `${qn(col.type_name)}(${col.scale})`
    }
    return qn(col.type_name)
}

function buildColumnDefinition(col: ColumnMeta): string {
    const columnName = qn(col.name)
    if (col.is_computed && col.computed_definition) {
        return `${columnName} AS ${col.computed_definition}`
    }

    const typeDef = buildSqlType(col)
    const identity = col.is_identity ? ' IDENTITY(1,1)' : ''
    const nullable = col.is_nullable ? ' NULL' : ' NOT NULL'
    const defaultDef = col.default_definition ? ` DEFAULT ${col.default_definition}` : ''
    return `${columnName} ${typeDef}${identity}${defaultDef}${nullable}`
}

function buildCreateTableSql(schemaName: string, tableName: string, columns: ColumnMeta[], pk: PrimaryKeyMeta[]): string {
    const columnDefs = columns.map(buildColumnDefinition)
    if (pk.length > 0) {
        const pkName = qn(pk[0].constraint_name)
        const pkCols = pk
            .sort((a, b) => a.key_ordinal - b.key_ordinal)
            .map((k) => `${qn(k.column_name)} ${k.is_descending_key ? 'DESC' : 'ASC'}`)
            .join(', ')
        columnDefs.push(`CONSTRAINT ${pkName} PRIMARY KEY CLUSTERED (${pkCols})`)
    }
    const targetName = fullTableName(schemaName, tableName)
    return `
IF OBJECT_ID(N'${schemaName}.${tableName}', N'U') IS NOT NULL
    DROP TABLE ${targetName};
CREATE TABLE ${targetName} (
    ${columnDefs.join(',\n    ')}
);`.trim()
}

async function getViews(sourcePool: mssql.ConnectionPool, schemaName: string): Promise<ViewMeta[]> {
    const result = await sourcePool.request()
        .input('schemaName', mssql.NVarChar, schemaName)
        .query(`
            SELECT
                s.name AS schema_name,
                v.name AS view_name,
                sm.definition
            FROM sys.views v
            INNER JOIN sys.schemas s ON s.schema_id = v.schema_id
            INNER JOIN sys.sql_modules sm ON sm.object_id = v.object_id
            WHERE s.name = @schemaName
            ORDER BY v.name ASC
        `)
    return (result.recordset || []) as ViewMeta[]
}

async function recreateTable(
    sourcePool: mssql.ConnectionPool,
    targetPool: mssql.ConnectionPool,
    schemaName: string,
    tableName: string
): Promise<ColumnMeta[]> {
    const columns = await getColumns(sourcePool, schemaName, tableName)
    if (columns.length <= 0) {
        throw new Error(`No columns found for ${schemaName}.${tableName}`)
    }
    const pk = await getPrimaryKey(sourcePool, schemaName, tableName)
    const sql = buildCreateTableSql(schemaName, tableName, columns, pk)
    await targetPool.request().batch(sql)
    return columns
}

function getInsertableColumns(columns: ColumnMeta[]): ColumnMeta[] {
    return columns.filter((c) => !c.is_computed)
}

function toTableSelectSql(schemaName: string, tableName: string, columns: ColumnMeta[], orderByColumn: string, offset: number, fetchSize: number): string {
    const selectedCols = columns.map((c) => qn(c.name)).join(', ')
    return `
SELECT ${selectedCols}
FROM ${fullTableName(schemaName, tableName)}
ORDER BY ${qn(orderByColumn)} ASC
OFFSET ${offset} ROWS FETCH NEXT ${fetchSize} ROWS ONLY;`.trim()
}

async function truncateTargetTable(targetPool: mssql.ConnectionPool, schemaName: string, tableName: string): Promise<void> {
    await targetPool.request().query(`TRUNCATE TABLE ${fullTableName(schemaName, tableName)};`)
}

function buildInsertSql(schemaName: string, tableName: string, columns: ColumnMeta[], rows: any[]): { sql: string, params: Array<{ name: string, value: any }> } {
    const names = columns.map((c) => qn(c.name)).join(', ')
    const valuesSql: string[] = []
    const params: Array<{ name: string, value: any }> = []
    for (let r = 0; r < rows.length; r++) {
        const parts: string[] = []
        for (let c = 0; c < columns.length; c++) {
            const p = `p_${r}_${c}`
            parts.push(`@${p}`)
            params.push({
                name: p,
                value: rows[r][columns[c].name]
            })
        }
        valuesSql.push(`(${parts.join(', ')})`)
    }

    const sql = `
INSERT INTO ${fullTableName(schemaName, tableName)} (${names})
VALUES ${valuesSql.join(',\n')};`.trim()

    return { sql, params }
}

function buildIdentityInsertBatch(sql: string, schemaName: string, tableName: string): string {
    const table = fullTableName(schemaName, tableName)
    return `
SET IDENTITY_INSERT ${table} ON;
${sql}
SET IDENTITY_INSERT ${table} OFF;`.trim()
}

function getSafeWriteBatchSize(configuredBatchSize: number, columnCount: number): number {
    if (columnCount <= 0) {
        throw new Error('Cannot determine write batch size for a table with no insertable columns.')
    }

    const maxRowsPerStatement = Math.max(1, Math.floor(SQLSERVER_MAX_PARAMETERS / columnCount))
    return Math.max(1, Math.min(configuredBatchSize, maxRowsPerStatement))
}

async function copyTableData(
    sourcePool: mssql.ConnectionPool,
    targetPool: mssql.ConnectionPool,
    schemaName: string,
    tableName: string,
    columns: ColumnMeta[],
    readBatchSize: number,
    writeBatchSize: number,
    shouldTruncateTarget: boolean
): Promise<number> {
    const insertableColumns = getInsertableColumns(columns)
    if (insertableColumns.length <= 0) {
        return 0
    }

    const safeWriteBatchSize = getSafeWriteBatchSize(writeBatchSize, insertableColumns.length)
    if (safeWriteBatchSize !== writeBatchSize) {
        console.log(
            `Reducing write batch size for ${schemaName}.${tableName} from ${writeBatchSize} to ${safeWriteBatchSize} ` +
            `to stay within SQL Server's ${SQLSERVER_MAX_PARAMETERS}-parameter limit.`
        )
    }

    const hasIdentity = insertableColumns.some((c) => c.is_identity)
    const orderBy = insertableColumns[0].name

    try {
        if (shouldTruncateTarget) {
            await truncateTargetTable(targetPool, schemaName, tableName)
        }

        let copied = 0
        let offset = 0

        while (true) {
            const sourceSql = toTableSelectSql(schemaName, tableName, insertableColumns, orderBy, offset, readBatchSize)
            const result = await sourcePool.request().query(sourceSql)
            const rows = result.recordset || []
            if (rows.length <= 0) {
                break
            }

            for (let i = 0; i < rows.length; i += safeWriteBatchSize) {
                const chunk = rows.slice(i, i + safeWriteBatchSize)
                const statement = buildInsertSql(schemaName, tableName, insertableColumns, chunk)
                const req = targetPool.request()
                statement.params.forEach((p) => {
                    req.input(p.name, p.value as any)
                })
                const sql = hasIdentity
                    ? buildIdentityInsertBatch(statement.sql, schemaName, tableName)
                    : statement.sql
                await req.batch(sql)
                copied += chunk.length
            }

            offset += rows.length
            console.log(`Copied ${schemaName}.${tableName}: ${copied} rows`)
        }

        return copied
    } catch (err) {
        throw err
    }
}

async function recreateViews(sourcePool: mssql.ConnectionPool, targetPool: mssql.ConnectionPool, schemaName: string): Promise<number> {
    const pending = [...await getViews(sourcePool, schemaName)]
    let created = 0

    while (pending.length > 0) {
        let progress = false
        const failed: Array<{ view: ViewMeta, error: any }> = []

        for (const view of pending) {
            const targetViewName = `${qn(view.schema_name)}.${qn(view.view_name)}`
            try {
                await targetPool.request().batch(`
IF OBJECT_ID(N'${view.schema_name}.${view.view_name}', N'V') IS NOT NULL
    DROP VIEW ${targetViewName};
`)
                await targetPool.request().batch(view.definition)
                console.log(`Created view ${view.schema_name}.${view.view_name}`)
                created += 1
                progress = true
            } catch (error: any) {
                failed.push({ view, error })
            }
        }

        if (failed.length <= 0) {
            break
        }

        if (!progress) {
            const details = failed
                .map(({ view, error }) => `${view.schema_name}.${view.view_name}: ${error?.message || String(error)}`)
                .join('\n')
            throw new Error(`Unable to recreate ${failed.length} view(s) due to unresolved dependencies or invalid definitions:\n${details}`)
        }

        pending.length = 0
        pending.push(...failed.map(({ view }) => view))
    }

    return created
}

async function getConnectionIdentity(pool: mssql.ConnectionPool): Promise<{ server: string, database: string }> {
    const result = await pool.request().query(`
SELECT
    CAST(@@SERVERNAME AS nvarchar(256)) AS server_name,
    CAST(DB_NAME() AS nvarchar(256)) AS database_name;
`)
    const row = (result.recordset || [])[0]
    return {
        server: row?.server_name || '',
        database: row?.database_name || ''
    }
}

async function run(): Promise<void> {
    const schemaName = getSchemaName()
    const tableFilter = getTableFilterSet()
    const includeViews = readBooleanEnv('MIG_INCLUDE_VIEWS', true)
    const truncateTarget = readBooleanEnv('MIG_TRUNCATE_TARGET', false)
    const readBatchSize = readNumberEnv('MIG_READ_BATCH_SIZE', 2000)
    const writeBatchSize = readNumberEnv('MIG_WRITE_BATCH_SIZE', 100)

    let sourcePool: mssql.ConnectionPool | null = null
    let targetPool: mssql.ConnectionPool | null = null

    try {
        const sourceCfg = readConfig(SOURCE_PREFIX)
        const targetCfg = readConfig(TARGET_PREFIX)

        const sameServer = sourceCfg.server.toLowerCase() === targetCfg.server.toLowerCase()
        const sameDatabase = sourceCfg.database?.toLowerCase() === targetCfg.database?.toLowerCase()
        if (sameServer && sameDatabase) {
            throw new Error(
                `Safety stop: source and destination are the same database (${sourceCfg.server}/${sourceCfg.database}).`
            )
        }

        // Use dedicated pools. Never use mssql.connect(...) global pool for dual-DB operations.
        sourcePool = await new mssql.ConnectionPool(sourceCfg).connect()
        targetPool = await new mssql.ConnectionPool(targetCfg).connect()

        const sourceIdentity = await getConnectionIdentity(sourcePool)
        const targetIdentity = await getConnectionIdentity(targetPool)

        console.log(`Connected source: ${sourceCfg.server}/${sourceCfg.database} (actual: ${sourceIdentity.server}/${sourceIdentity.database})`)
        console.log(`Connected target: ${targetCfg.server}/${targetCfg.database} (actual: ${targetIdentity.server}/${targetIdentity.database})`)

        const sameActualServer = sourceIdentity.server.toLowerCase() === targetIdentity.server.toLowerCase()
        const sameActualDb = sourceIdentity.database.toLowerCase() === targetIdentity.database.toLowerCase()
        if (sameActualServer && sameActualDb) {
            throw new Error(
                `Safety stop: source and destination resolved to the same connected database (${sourceIdentity.server}/${sourceIdentity.database}).`
            )
        }

        const tables = await getTables(sourcePool, schemaName, tableFilter)
        if (tables.length <= 0) {
            console.log('No tables matched filter. Nothing to migrate.')
            return
        }

        console.log(`Migrating ${tables.length} table(s) in schema ${schemaName}`)
        for (const t of tables) {
            console.log(`Recreating table ${t.schema_name}.${t.table_name}`)
            const columns = await recreateTable(sourcePool, targetPool, t.schema_name, t.table_name)
            const copied = await copyTableData(
                sourcePool,
                targetPool,
                t.schema_name,
                t.table_name,
                columns,
                readBatchSize,
                writeBatchSize,
                truncateTarget
            )
            console.log(`Finished ${t.schema_name}.${t.table_name}: copied ${copied} row(s)`)
        }

        if (includeViews) {
            const count = await recreateViews(sourcePool, targetPool, schemaName)
            console.log(`Recreated ${count} view(s)`)
        }

        console.log('Migration completed successfully.')
    } finally {
        if (sourcePool) {
            await sourcePool.close()
        }
        if (targetPool) {
            await targetPool.close()
        }
    }
}

run().catch((err: any) => {
    console.error('Migration failed.')
    console.error(err)
    process.exit(1)
})
