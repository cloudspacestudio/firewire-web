import { Pool, PoolConfig, QueryResult } from 'pg'
import * as express from 'express'

export class ContentPostgresDb {

    public pool: Pool | null = null
    private _connected: boolean = false
    private _keepAliveTimer: any = null

    private _allTablesSql = `
    select *
    from information_schema.tables t
    where t.table_schema = 'public'  -- put schema name here
          and t.table_type = 'BASE TABLE'
    order by t.table_name;
    `
    private _tableLookupSql = `
    select *
    from information_schema.tables t
    where t.table_schema = 'public'  -- put schema name here
          and t.table_type = 'BASE TABLE'
          and t.table_name = $1
    order by t.table_name;`

    constructor(private config: PoolConfig) {
        this.pool = new Pool(config)
    }

    attach(app: express.Application): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                app.get('/api/postgres/tables', (req, res) => {
                    return new Promise(async(resolve, reject) => {
                        try {
                            if (!app.locals.postgresdb) {
                                return res.status(400).json({
                                    message: `No Postgres Database in application`
                                })
                            }

                            const result = await app.locals.postgresdb.getTableList()
                            if (!result) {
                                return res.status(400).send({
                                    message: `Unable to retrieve list of tables from postgresdb`
                                })
                            }
                            return res.status(200).json(result)
                        } catch (err) {
                            console.error(err)
                            return res.status(500).json(err)
                        }
                    })
                })
                return resolve(true)
            } catch (err) {
                return reject(err)
            }
        })
    }

    execute(statement: string, values?: any[]): Promise<QueryResult<any>> {
        return new Promise(async(resolve, reject) => {
            if (!this.pool) return reject(new Error(`Invalid PostgresClient`))
            let sent = false
            try {
                if (!this._connected) {
                    this._connected = true
                    this._registerKeepAlive()
                }
                const result = await this.pool.query(statement, values)
                if (sent) return
                sent = true
                return resolve(result)
            } catch (err: any) {
                if (!sent) {
                    sent = true
                    return reject(err)
                }
                return reject(err)
            }
        })
    }

    getTableList(): Promise<QueryResult<any>> {
        return new Promise(async(resolve, reject) => {
            try {
                const result = await this.execute(this._allTablesSql)
                if (result) {
                    return resolve(result)
                }
                return reject(new Error(`Unable to retrieve values from postgres for query: ${this._tableLookupSql}`))
            } catch (err) {
                return reject(err)
            }
        })
    }

    shutdown() {
        if (this._keepAliveTimer) {
            clearInterval(this._keepAliveTimer)
            this._keepAliveTimer = null
        }
        if (this.pool) {
            this.pool.end()
        }
    }

    private _registerKeepAlive() {
        this._keepAliveTimer = setInterval(() => {
            // Simple query to just keep connection alive every 10 minutes
            const sql = `select table_name
            from information_schema.tables t
            where t.table_schema = 'public'  -- put schema name here
                  and t.table_type = 'BASE TABLE'
            order by t.table_name
            limit 1;`
            this.execute(sql)
        }, 60000) // every 10 mins
    }
}

/*

select *
    from information_schema.tables t
    where t.table_schema = 'public'  -- put schema name here
          and t.table_type = 'BASE TABLE'
    order by t.table_name;

SELECT
    column_name,
    data_type,
    is_nullable,
    column_default,
    character_maximum_length,
    numeric_precision,
    numeric_scale
FROM
    information_schema.columns
WHERE
    table_name = 'your_table_name'
    AND table_schema = 'your_schema_name';  -- Optional: specify the schema name if needed


SELECT
    a.attname AS column_name,
    pg_catalog.format_type(a.atttypid, a.atttypmod) AS data_type,
    a.attnotnull AS is_nullable,
    pg_get_expr(d.adbin, d.adrelid) AS column_default,
    a.attlen AS character_maximum_length,
    a.attnum AS ordinal_position,
    col_description(a.attrelid, a.attnum) AS column_comment
FROM
    pg_attribute a
    LEFT JOIN pg_attrdef d ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    JOIN pg_class c ON a.attrelid = c.oid
    JOIN pg_type t ON a.atttypid = t.oid
WHERE
    c.relname = 'your_table_name'
    AND a.attnum > 0
    AND NOT a.attisdropped
ORDER BY
    a.attnum;

*/