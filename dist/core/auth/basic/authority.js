"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BasicAuthority = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jwt = __importStar(require("jsonwebtoken"));
const principal_1 = require("./principal");
const secret = process.env.JWTSECRET || '123';
class BasicAuthority {
    constructor(storage) {
        this.storage = storage;
    }
    attach(app) {
        app.post('/register', (req, res) => {
            const username = req.body.get('username');
            const password = req.body.get('password');
            const tenant = req.body.get('tenant');
        });
        app.post('/login', (req, res) => {
            const username = req.body.get('username');
            const password = req.body.get('password');
            const tenant = req.body.get('tenant');
        });
        app.all('/api/*', (req, res, next) => {
            return this.verify(req, res, next);
        });
    }
    register(username, password, tenant) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!username || !password || !tenant) {
                    throw new Error(`Invalid parameters to register method`);
                }
                // TODO: Validate tenant
                // TODO: Validate non-repeating username
                const hashedPassword = yield bcryptjs_1.default.hash(password, 10);
                const principle = new principal_1.BasicPrincipal(username, hashedPassword, tenant);
                const result = yield this.setPrincipal(principle);
                if (result instanceof Error)
                    throw result;
                delete result.hash;
                delete result.salt;
                return resolve(result);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    login(username, password, tenant) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!username || !password || !tenant) {
                    throw new Error(`Invalid parameters to login method`);
                }
                const principle = yield this.getPrincipal(username, tenant);
                if (!principle) {
                    setTimeout(() => {
                        return resolve(false);
                    }, 6500);
                }
                const isPasswordValid = yield bcryptjs_1.default.compare(password, principle.hash);
                if (!isPasswordValid) {
                    setTimeout(() => {
                        return resolve(false);
                    }, 6500);
                }
                const jwt = yield this.generateJwt(principle);
                return resolve(jwt);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    setPrincipal(value) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.storage.setPrincipal(value);
                return resolve(result);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    getPrincipal(username, tenant) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const result = yield this.storage.getPrincipal(username, tenant);
                return resolve(result);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    generateJwt(principle) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!principle) {
                    throw new Error(`Invalid principle parameter to generateJwt method`);
                }
                const payload = {
                    id: principle.id,
                    username: principle.username,
                    tenant: principle.tenant
                };
                const token = jwt.sign(payload, secret, { expiresIn: '1h' });
                return resolve(token);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    verify(req, res, next) {
        try {
            const token = req.headers['authorization'];
            if (!token) {
                throw new Error(`Invalid Authorization Token to verify method`);
            }
            const decoded = jwt.verify(token, secret);
            if (!decoded) {
                throw new Error(`Unauthorized`);
            }
            const anyreq = req;
            anyreq.user = decoded;
            return next();
        }
        catch (err) {
            return res.status(401).json({ error: 'Invalid Token' });
        }
    }
    refresh(token) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!token) {
                    throw new Error(`Invalid Token to refresh method`);
                }
                const decoded = jwt.verify(token, secret);
                if (!decoded) {
                    throw new Error(`Unauthorized`);
                }
                const response = yield this.generateJwt(decoded);
                if (!response) {
                    throw new Error(`Unauthorized`);
                }
                return resolve(response);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
}
exports.BasicAuthority = BasicAuthority;
