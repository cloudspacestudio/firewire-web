import * as express from 'express'

import { AuthStrategy } from "../auth/authstrategy"
import { IManifestItem } from "./imanifestitem"

export class BaseManifest {

    public constructor() {}

    appname: string = ''
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = [] // sqlserver, postgresdb, mongodb

    items: IManifestItem[] = []

    attach(app: express.Application) {
        // override in derived class
        return
    }

}
