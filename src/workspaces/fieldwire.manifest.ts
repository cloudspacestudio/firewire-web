import * as express from 'express'

import { AuthStrategy } from "../core/auth/authstrategy";
import { BaseManifest } from "../core/routing/base.manifest";
import { IManifestItem } from "../core/routing/imanifestitem";

export default class FieldwireManifest extends BaseManifest {

    appname: string = 'fieldwireapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []
    items: IManifestItem[] = [
        {
            method: 'get',
            path: '/api/fieldwire/test',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        return res.status(200).json({
                            message: 'Hello World'
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