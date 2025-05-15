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
exports.SqlAuthStorage = void 0;
class SqlAuthStorage {
    constructor(app) {
        this.app = app;
    }
    setPrincipal(value) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.app || !this.app.locals || !this.app.locals.sqlserver) {
                    throw new Error(`Invalid SqlAuthStorage: No express application sql server instance`);
                }
                const db = this.app.locals.sqlserver;
                const result = yield db.query(`INSERT INTO principals(id, username, hash, tenant)
                    VALUES('${value.id}', '${value.username}', '${value.hash}', '${value.tenant}')`);
                return resolve(true);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    getPrincipal(username, tenant) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.app || !this.app.locals || !this.app.locals.sqlserver) {
                    throw new Error(`Invalid SqlAuthStorage: No express application sql server instance`);
                }
                const db = this.app.locals.sqlserver;
                const result = yield db.query(`SELECT * FROM principals WHERE username='${username}' AND tenant='${tenant}'`);
                if (!result || !result.recordset || result.recordset.length <= 0) {
                    return null;
                }
                return resolve(result.recordset[0]);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
}
exports.SqlAuthStorage = SqlAuthStorage;
