import * as express from 'express'
import { IPrincipleStorage } from '../iprinciplestorage'
import { IPrincipal } from '../iprincipal'
import { MsSqlServerDb } from '../../databases/mssqldb'
import * as mssql from 'mssql'

export class SqlAuthStorage implements IPrincipleStorage {

    constructor(private app: express.Application) {}

    setPrincipal(value: IPrincipal): Promise<boolean | Error> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.app || !this.app.locals || !this.app.locals.sqlserver) {
                    throw new Error(`Invalid SqlAuthStorage: No express application sql server instance`)
                }
                const db: MsSqlServerDb = this.app.locals.sqlserver
                const result: mssql.IResult<IPrincipal> = await db.query(`INSERT INTO principals(id, username, hash, tenant)
                    VALUES('${value.id}', '${value.username}', '${value.hash}', '${value.tenant}')`)
                return resolve(true)
            } catch (err) {
                return reject(err)
            }
        })
    }

    getPrincipal(username: string, tenant: string): Promise<IPrincipal> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.app || !this.app.locals || !this.app.locals.sqlserver) {
                    throw new Error(`Invalid SqlAuthStorage: No express application sql server instance`)
                }
                const db: MsSqlServerDb = this.app.locals.sqlserver

                const result = await db.query(`SELECT * FROM principals WHERE username='${username}' AND tenant='${tenant}'`)
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return null
                }
                return resolve(result.recordset[0] as IPrincipal)
            } catch (err) {
                return reject(err)
            }
        })
    }

}