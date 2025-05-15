"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const authstrategy_1 = require("../../core/auth/authstrategy");
const base_manifest_1 = require("../../core/routing/base.manifest");
const fieldwire_1 = require("./fieldwire");
const accounts_1 = require("./accounts/accounts");
const projects_1 = require("./projects/projects");
const tasks_1 = require("./tasks/tasks");
const devices_1 = require("./devices/devices");
const aws_1 = require("./aws/aws");
const sqlServerInitIntervalMs = 1000 * 60 * 10; // 10 minutes
class FieldwireManifest extends base_manifest_1.BaseManifest {
    constructor() {
        super();
        this.appname = 'fieldwireapi';
        this.authStrategy = authstrategy_1.AuthStrategy.none;
        this.dependencies = [];
        this.items = [];
        this.items.push(...accounts_1.FieldwireAccounts.manifestItems);
        this.items.push(...projects_1.FieldwireProjects.manifestItems);
        this.items.push(...aws_1.FieldwireAWS.manifestItems);
        this.items.push(...tasks_1.FieldwireTasks.manifestItems);
        this.items.push(...devices_1.FieldwireDevices.manifestItems);
    }
    attach(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const fieldwireInstance = new fieldwire_1.FieldwireSDK();
            app.locals.fieldwire = fieldwireInstance;
            if (app.locals.sqlserver) {
                setInterval(() => __awaiter(this, void 0, void 0, function* () {
                    const sql = app.locals.sqlserver;
                    try {
                        const initResult = yield sql.init();
                        console.log(`miSSion.webserver: sqlserver: keepalive`);
                    }
                    catch (err) {
                        console.error(err);
                    }
                }), sqlServerInitIntervalMs);
            }
            return resolve(true);
        }));
    }
}
exports.default = FieldwireManifest;
/*
    Test task id of Block Setup 101: "id": "1a55452b-5ce6-4c7d-ad01-660890c3aebf"
    Block Setup 101: 4b9a65d3-4ce4-4308-b93e-4513ff98fc72
    Samsung Office Building: dc15eebb-6c6e-4bc1-86da-68019d5a16d3
    Test: d0105078-da46-4a42-809f-b015b0cf87c8
*/ 
