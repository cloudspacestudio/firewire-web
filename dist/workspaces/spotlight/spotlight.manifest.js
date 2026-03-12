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
class SpotlightManifest extends base_manifest_1.BaseManifest {
    constructor() {
        super();
        this.appname = 'missionapi';
        this.authStrategy = authstrategy_1.AuthStrategy.none;
        this.dependencies = [];
        this.items = [{
                method: 'get',
                path: '/api/spotlights',
                fx: (req, res) => {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const mongoDb = req.app.locals.mongodb;
                            const result = yield mongoDb.find('listspotlights', {}, {});
                            return res.status(200).json({
                                rows: result
                            });
                        }
                        catch (err) {
                            return res.status(500).json({
                                message: err && err.message ? err.message : err
                            });
                        }
                    }));
                }
            },
            {
                method: 'get',
                path: '/api/spotlights/:id',
                fx: (req, res) => {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const mongoDb = req.app.locals.mongodb;
                            //const tempId: ObjectId = new ObjectId(req.params.id)
                            const result = yield mongoDb.findOne('spotlights', { id: req.params.id }, {});
                            console.dir(result);
                            return res.status(200).json(result);
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
exports.default = SpotlightManifest;
