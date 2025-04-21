import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { SqlDb } from '../repository/sqldb'

export class FieldwireDevices {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/devices',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDevices()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }
    ]

}