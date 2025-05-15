"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseManifest = void 0;
const authstrategy_1 = require("../auth/authstrategy");
class BaseManifest {
    constructor() {
        this.appname = '';
        this.authStrategy = authstrategy_1.AuthStrategy.none;
        this.dependencies = []; // sqlserver, postgresdb, mongodb
        this.items = [];
    }
    attach(app) {
        // override in derived class
        return Promise.resolve(true);
    }
}
exports.BaseManifest = BaseManifest;
