import express from 'express'

import { BaseManifest } from "../../core/routing/base.manifest"
import { AuthStrategy } from "../../core/auth/authstrategy"
import { IManifestItem } from '../../core/routing/imanifestitem'
import { MsSqlServerDb } from '../../core/databases/mssqldb'

export default class FieldwireManifest extends BaseManifest {

    constructor() {
        super()
    }

    appname: string = 'missionapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []

    attach(app: express.Application) {
        return super.attach(app)
    }

    items: IManifestItem[] = [{
        method: 'get',
        path: '/api/tenants',
        fx: (req: express.Request, res: express.Response) => {
            return new Promise(async(resolve, reject) => {
                try {
                    const sql: MsSqlServerDb = req.app.locals.sqlserver
                    const result = await sql.query(`SELECT * FROM tenants`)
                    if (!result || !result.recordset || result.recordset.length <= 0) {
                        return res.status(500).json({
                            message: `No tenants table data found`
                        })
                    }
                    return res.status(200).json({
                        rows: result.recordset
                    })
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            })
        }
    }]


}