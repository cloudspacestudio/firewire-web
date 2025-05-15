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
const base_manifest_1 = require("../../core/routing/base.manifest");
const authstrategy_1 = require("../../core/auth/authstrategy");
class FieldwireManifest extends base_manifest_1.BaseManifest {
    constructor() {
        super();
        this.appname = 'missionapi';
        this.authStrategy = authstrategy_1.AuthStrategy.none;
        this.dependencies = [];
        this.items = [{
                method: 'get',
                path: '/api/tenants',
                fx: (req, res) => {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const sql = req.app.locals.sqlserver;
                            const result = yield sql.query(`SELECT * FROM tenants`);
                            if (!result || !result.recordset || result.recordset.length <= 0) {
                                return res.status(500).json({
                                    message: `No tenants table data found`
                                });
                            }
                            return res.status(200).json({
                                rows: result.recordset
                            });
                        }
                        catch (err) {
                            return res.status(500).json({
                                message: err && err.message ? err.message : err
                            });
                        }
                    }));
                }
            }];
    }
    attach(app) {
        return super.attach(app);
    }
}
exports.default = FieldwireManifest;
