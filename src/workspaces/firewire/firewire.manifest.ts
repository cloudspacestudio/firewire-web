import * as express from 'express'

import { AuthStrategy } from '../../core/auth/authstrategy'
import { BaseManifest } from '../../core/routing/base.manifest'
import { IManifestItem } from '../../core/routing/imanifestitem'
import { FirewireData } from './data/firewire.data'
import { FirewireAboutData } from './data/firewire.about.data'
import { FirewireProjectSettingsData } from './data/firewire.project-settings.data'
import { FirewireProjectsData } from './data/firewire.projects.data'
import { FirewireUserPreferencesData } from './data/firewire.user-preferences.data'
import { FirewireDocumentAnalysisData } from './data/firewire.document-analysis.data'

export default class FirewireManifest extends BaseManifest {
    constructor() {
        super()
        this.items.push(...FirewireAboutData.manifestItems)
        this.items.push(...FirewireData.manifestItems)
        this.items.push(...FirewireProjectSettingsData.manifestItems)
        this.items.push(...FirewireProjectsData.manifestItems)
        this.items.push(...FirewireUserPreferencesData.manifestItems)
        this.items.push(...FirewireDocumentAnalysisData.manifestItems)
    }

    appname: string = 'firewireapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []

    attach(app: express.Application) {
        return super.attach(app)
    }

    items: IManifestItem[] = []
}
