import * as express from 'express'

import { BaseManifest } from "./base.manifest";
import { IManifestItem } from "./imanifestitem";
import { Utils } from '../utils';

export class RouteResolver {

    routeCount: number = 0
    constructor(private path: string) {}

    attach(app: express.Application): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                const validPath = await Utils.directoryExists(this.path)
                if (!validPath) {
                    throw new Error(`Invalid path sent to RouteResolver: ${this.path}`)
                }
                const files = await Utils.getFilesWithPhrase(this.path, 'manifest.')
                const anyApp: any = app
                for (let filepath of files) {
                    const instance: BaseManifest = await Utils.loadManifest(filepath, [])
                    if (instance && instance && instance.items && Array.isArray(instance.items) && instance.items.length > 0) {
                        // Register dependencies if not already registered
                        await instance.attach(app)
                        
                        // Determine Verify Function
                        const verify = this.authVerifyNone
                        for (let item of instance.items) {
                            console.log(`Registered ${item.method}: ${item.path}`)
                            anyApp[item.method](item.path, verify, item.fx)
                            this.routeCount++
                        }
                    }
                }
                return resolve(true)
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.log(`RouteResolver.attach: error`)
                    console.error(err)
                }
                return reject(err)
            }
        })
    }

    authVerifyNone(req: express.Request, res: express.Response, next: express.NextFunction): Promise<any> {
        return new Promise(async(resolve, reject) => {
            return next(null)
        })
    }

}