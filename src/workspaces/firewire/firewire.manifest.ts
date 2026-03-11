import * as express from 'express'

import { AuthStrategy } from "../../core/auth/authstrategy";
import { BaseManifest } from "../../core/routing/base.manifest";
import { IManifestItem } from "../../core/routing/imanifestitem";
import { FirewireData } from "./data/firewire.data";

export default class FirewireManifest extends BaseManifest {

    constructor() {
        super()
        this.items.push(...FirewireData.manifestItems)
        this.items.push(...FirewireData.legacyFieldwireAliasItems)
    }

    appname: string = 'firewireapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []

    attach(app: express.Application) {
        return super.attach(app)
    }

    items: IManifestItem[] = []
}
