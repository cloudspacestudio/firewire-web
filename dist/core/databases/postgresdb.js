"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentPostgresDb = void 0;
const pg_1 = require("pg");
class ContentPostgresDb {
    constructor(config) {
        this.config = config;
        this.pool = null;
        this._connected = false;
        this._keepAliveTimer = null;
        this._allTablesSql = `
    select *
    from information_schema.tables t
    where t.table_schema = 'public'  -- put schema name here
          and t.table_type = 'BASE TABLE'
    order by t.table_name;
    `;
        this._tableLookupSql = `
    select *
    from information_schema.tables t
    where t.table_schema = 'public'  -- put schema name here
          and t.table_type = 'BASE TABLE'
          and t.table_name = $1
    order by t.table_name;`;
        this.pool = new pg_1.Pool(config);
    }
    attach(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                app.get('/api/postgres/tables', (req, res) => {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            if (!app.locals.postgresdb) {
                                return res.status(400).json({
                                    message: `No Postgres Database in application`
                                });
                            }
                            const result = yield app.locals.postgresdb.getTableList();
                            if (!result) {
                                return res.status(400).send({
                                    message: `Unable to retrieve list of tables from postgresdb`
                                });
                            }
                            return res.status(200).json(result);
                        }
                        catch (err) {
                            console.error(err);
                            return res.status(500).json(err);
                        }
                    }));
                });
                return resolve(true);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    execute(statement, values) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (!this.pool)
                return reject(new Error(`Invalid PostgresClient`));
            let sent = false;
            try {
                if (!this._connected) {
                    this._connected = true;
                    this._registerKeepAlive();
                }
                const result = yield this.pool.query(statement, values);
                if (sent)
                    return;
                sent = true;
                return resolve(result);
            }
            catch (err) {
                if (!sent) {
                    sent = true;
                    return reject(err);
                }
                return reject(err);
            }
        }));
    }
    getTableList() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.execute(this._allTablesSql);
                if (result) {
                    return resolve(result);
                }
                return reject(new Error(`Unable to retrieve values from postgres for query: ${this._tableLookupSql}`));
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    shutdown() {
        if (this._keepAliveTimer) {
            clearInterval(this._keepAliveTimer);
            this._keepAliveTimer = null;
        }
        if (this.pool) {
            this.pool.end();
        }
    }
    _registerKeepAlive() {
        this._keepAliveTimer = setInterval(() => {
            // Simple query to just keep connection alive every 10 minutes
            const sql = `select table_name
            from information_schema.tables t
            where t.table_schema = 'public'  -- put schema name here
                  and t.table_type = 'BASE TABLE'
            order by t.table_name
            limit 1;`;
            this.execute(sql);
        }, 60000); // every 10 mins
    }
}
exports.ContentPostgresDb = ContentPostgresDb;
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
