import * as express from 'express'

import { AuthStrategy } from "../auth/authstrategy"
import { IManifestItem } from "./imanifestitem"

export class BaseManifest {

    constructor(app: express.Application) {}

    appname: string = ''
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = [] // sqlserver, postgresdb, mongodb 
    items: IManifestItem[] = []
}
