"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicPrincipal = void 0;
const uuid_1 = require("uuid");
class BasicPrincipal {
    constructor(username, hash, tenant) {
        this.id = '';
        this.username = '';
        this.hash = '';
        this.tenant = '';
        this.id = (0, uuid_1.v4)();
        this.username = username;
        this.hash = hash;
        this.tenant = tenant;
    }
}
exports.BasicPrincipal = BasicPrincipal;
