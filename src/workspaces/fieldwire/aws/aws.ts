import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'

export class FieldwireAWS {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/aws_post_tokens',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const result = await fieldwire.aws_post_tokens()
                        return res.status(200).json(result)
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