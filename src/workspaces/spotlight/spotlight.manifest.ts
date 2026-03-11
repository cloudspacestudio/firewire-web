import express from 'express'

import { BaseManifest } from "../../core/routing/base.manifest"
import { AuthStrategy } from "../../core/auth/authstrategy"
import { IManifestItem } from '../../core/routing/imanifestitem'
import { MsSqlServerDb } from '../../core/databases/mssqldb'
import { ContentMongoDb, ObjectId } from '../../core/databases/mongodb'

export default class SpotlightManifest extends BaseManifest {

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
        path: '/api/spotlights',
        fx: (req: express.Request, res: express.Response) => {
            return new Promise(async(resolve, reject) => {
                try {
                    const mongoDb: ContentMongoDb = req.app.locals.mongodb
                    const result = await mongoDb.find('listspotlights', {}, {})
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
    },
    {
        method: 'get',        
        path: '/api/spotlights/:id',
        fx: (req: express.Request, res: express.Response) => {
            return new Promise(async(resolve, reject) => {
                try {
                    const mongoDb: ContentMongoDb = req.app.locals.mongodb
                    //const tempId: ObjectId = new ObjectId(req.params.id)
                    const result = await mongoDb.findOne('spotlights', { id: req.params.id }, {})
                    console.dir(result)
                    return res.status(200).json(result)
                } catch (err: Error|any) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    })
                }
            })
        }
    }]


}