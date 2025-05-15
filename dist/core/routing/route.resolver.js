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
exports.RouteResolver = void 0;
const utils_1 = require("../utils");
class RouteResolver {
    constructor(path) {
        this.path = path;
        this.routeCount = 0;
    }
    attach(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const validPath = yield utils_1.Utils.directoryExists(this.path);
                if (!validPath) {
                    throw new Error(`Invalid path sent to RouteResolver: ${this.path}`);
                }
                const files = yield utils_1.Utils.getFilesWithPhrase(this.path, 'manifest.');
                const anyApp = app;
                for (let filepath of files) {
                    const instance = yield utils_1.Utils.loadManifest(filepath, []);
                    if (instance && instance && instance.items && Array.isArray(instance.items) && instance.items.length > 0) {
                        // Register dependencies if not already registered
                        yield instance.attach(app);
                        // Determine Verify Function
                        const verify = this.authVerifyNone;
                        for (let item of instance.items) {
                            console.log(`Registered ${item.method}: ${item.path}`);
                            anyApp[item.method](item.path, verify, item.fx);
                            this.routeCount++;
                        }
                    }
                }
                return resolve(true);
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.log(`RouteResolver.attach: error`);
                    console.error(err);
                }
                return reject(err);
            }
        }));
    }
    authVerifyNone(req, res, next) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            return next(null);
        }));
    }
}
exports.RouteResolver = RouteResolver;
