import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'

export class FieldwireDevices {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/devices',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const result = await fieldwire.devices(req.app)
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