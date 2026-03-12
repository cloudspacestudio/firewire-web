import * as express from 'express'

import { AuthStrategy } from '../../core/auth/authstrategy'
import { BaseManifest } from '../../core/routing/base.manifest'
import { IManifestItem } from '../../core/routing/imanifestitem'
import { FirewireData } from './data/firewire.data'
import { FirewireProjectSettingsData } from './data/firewire.project-settings.data'
import { FirewireProjectsData } from './data/firewire.projects.data'

export default class FirewireManifest extends BaseManifest {
    constructor() {
        super()
        this.items.push(...FirewireData.manifestItems)
        this.items.push(...FirewireProjectSettingsData.manifestItems)
        this.items.push(...FirewireProjectsData.manifestItems)
        this.items.push(...FirewireData.legacyFieldwireAliasItems)
        this.items.push(...FirewireProjectSettingsData.legacyFieldwireAliasItems)
        this.items.push(...FirewireProjectsData.legacyFieldwireAliasItems)
    }

    appname: string = 'firewireapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []

    attach(app: express.Application) {
        return super.attach(app)
    }

    items: IManifestItem[] = []
}
