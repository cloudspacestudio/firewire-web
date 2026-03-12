"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const authstrategy_1 = require("../../core/auth/authstrategy");
const base_manifest_1 = require("../../core/routing/base.manifest");
const firewire_data_1 = require("./data/firewire.data");
const firewire_project_settings_data_1 = require("./data/firewire.project-settings.data");
const firewire_projects_data_1 = require("./data/firewire.projects.data");
class FirewireManifest extends base_manifest_1.BaseManifest {
    constructor() {
        super();
        this.appname = 'firewireapi';
        this.authStrategy = authstrategy_1.AuthStrategy.none;
        this.dependencies = [];
        this.items = [];
        this.items.push(...firewire_data_1.FirewireData.manifestItems);
        this.items.push(...firewire_project_settings_data_1.FirewireProjectSettingsData.manifestItems);
        this.items.push(...firewire_projects_data_1.FirewireProjectsData.manifestItems);
        this.items.push(...firewire_data_1.FirewireData.legacyFieldwireAliasItems);
        this.items.push(...firewire_project_settings_data_1.FirewireProjectSettingsData.legacyFieldwireAliasItems);
        this.items.push(...firewire_projects_data_1.FirewireProjectsData.legacyFieldwireAliasItems);
    }
    attach(app) {
        return super.attach(app);
    }
}
exports.default = FirewireManifest;
