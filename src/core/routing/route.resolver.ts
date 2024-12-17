import * as express from 'express'

import { BaseManifest } from "./base.manifest";
import { IManifestItem } from "./imanifestitem";
import { Utils } from '../utils';

export class RouteResolver {

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
                    const instance: BaseManifest = await Utils.loadClassInstance(filepath, [app])
                    if (instance && instance && instance.items && Array.isArray(instance.items) && instance.items.length > 0) {
                        // Register dependencies if not already registered

                        // Determine Verify Function
                        const verify = this.authVerifyNone
                        for (let item of instance.items) {
                            console.log(`Registered ${item.method}: ${item.path}`)
                            anyApp[item.method](item.path, verify, item.fx)
                        }
                    }
                }
                return resolve(true)
            } catch (err) {
                console.error(err)
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