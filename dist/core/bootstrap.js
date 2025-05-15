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
exports.Bootstrap = void 0;
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const path = __importStar(require("node:path"));
require("dotenv/config");
const postgresdb_1 = require("./databases/postgresdb");
const mongodb_1 = require("./databases/mongodb");
const mssqldb_1 = require("./databases/mssqldb");
const route_resolver_1 = require("./routing/route.resolver");
class Bootstrap {
    start(routeless = false) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            console.log(`miSSion.webserver: starting`);
            const app = (0, express_1.default)();
            try {
                app.use((0, helmet_1.default)());
                console.log(`miSSion.webserver: helmet applied`);
                app.set('view engine', 'ejs');
                console.log(`miSSion.webserver: view engine ejs initialized`);
                app.use(express_1.default.json());
                console.log(`miSSion.webserver: json support enabled`);
                // #region Mongo DB Setup
                if (process.env.MONGOURL) {
                    console.log(`miSSion.webserver: discovered mongodb env`);
                    const mongoConfig = {
                        remoteuri: process.env.MONGOURL || '',
                        dbname: process.env.MONGODBNAME || '',
                        appname: process.env.APPNAME || '',
                        timeout: 5000
                    };
                    const mongoDb = new mongodb_1.ContentMongoDb(mongoConfig);
                    console.log(`miSSion.webserver: stoodup mongodb`);
                    app.locals.mongodb = mongoDb;
                }
                // #endregion
                // #region Postgres DB Setup
                if (process.env.PGHOST) {
                    console.log(`miSSion.webserver: discovered postgres env`);
                    const postgresCert = ''; //fs.readFileSync(`ca-certificate.crt`).toString()
                    const postgresConfig = {
                        user: process.env.PGUSER,
                        password: process.env.PGPWD,
                        host: process.env.PGHOST,
                        port: +(process.env.PGPORT || 0),
                        database: process.env.PGDATABASE
                    };
                    if (postgresConfig.host !== 'localhost') {
                        postgresConfig.ssl = {
                            rejectUnauthorized: false,
                            ca: postgresCert
                        };
                    }
                    const postgresDb = new postgresdb_1.ContentPostgresDb(postgresConfig);
                    console.log(`miSSion.webserver: stoodup postgres db`);
                    app.locals.postgresdb = postgresDb;
                }
                // #endregion
                // #region Sql Server DB Setup
                if (process.env.SQLSRV) {
                    console.log(`miSSion.webserver: discovered sql server env`);
                    const sqlConfig = {
                        server: process.env.SQLSRV,
                        database: process.env.SQLDB || '',
                        driver: 'msnodesqlv8'
                    };
                    if (process.env.SQLUSER) {
                        sqlConfig.user = process.env.SQLUSER;
                        sqlConfig.password = process.env.SQLPWD;
                    }
                    else {
                        // Use Windows Authentication
                        sqlConfig.options = {
                            trustedConnection: true,
                            trustServerCertificate: true
                        };
                    }
                    if (process.env.SQLSRV === 'localhost') {
                        sqlConfig.options = {
                            trustedConnected: false,
                            trustServerCertificate: true
                        };
                    }
                    const sqlserver = new mssqldb_1.MsSqlServerDb(sqlConfig);
                    console.log(`miSSion.webserver: stoodup sql server`);
                    console.dir(sqlConfig);
                    app.locals.sqlserver = sqlserver;
                }
                // #endregion
                // Run any prestartup precondition checks on app and environment
                // If preStart returns anything other than success, the server is dead
                const preStartupResult = yield this.preStart(app);
                if (!preStartupResult || !preStartupResult.success) {
                    const failedApp = this.setServerIntoFailedState(preStartupResult);
                    return resolve(failedApp);
                }
                // Read manifest and create endpoints
                if (!routeless) {
                    console.log(`miSSion.webserver: initializing workspace routes`);
                    const resolver = new route_resolver_1.RouteResolver(path.join(process.cwd(), 'src', 'workspaces'));
                    console.log(`miSSion.webserver: attaching routes to webserver`);
                    yield resolver.attach(app);
                    // Check that at least 1 route was registered with functionality
                    if (resolver.routeCount <= 0) {
                        // No routes were attached
                        const failedApp = this.setServerIntoFailedState({
                            code: 400,
                            success: false,
                            message: `No routes were identified in this system`
                        });
                        return resolve(failedApp);
                    }
                    // Any requests to API that were not routed return JSON 404
                    app.all('/api/*', (req, res) => {
                        res.sendStatus(404).json();
                    });
                    // All get requests not handled return HTML 404
                    app.get('**', (req, res) => {
                        // Send index.html for SPA
                        res.sendStatus(404);
                    });
                    // Any requests not otherwise handled return generic 404
                    app.all('**', (req, res) => {
                        res.sendStatus(404);
                    });
                }
                // Check for any post registration preconditions before starting server listener
                const postStartResult = yield this.postStart(app);
                if (!postStartResult.success) {
                    const failedApp = this.setServerIntoFailedState(postStartResult);
                    return resolve(failedApp);
                }
                return resolve(app);
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.log(`miSSion.webserver: start(): error`);
                    console.error(err);
                }
                const failedApp = this.setServerIntoFailedState({
                    success: false, code: 500, message: err && err.message ? err.message : 'Unknown Error'
                });
                return resolve(failedApp);
            }
        }));
    }
    // Return a BootstrapStartupResponse. success of false will result in server always rendering error state
    preStart(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Must have app secret key defined
                if (!process.env.MISSIONSECRET) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Missing MISSIONSECRET environment variable`
                    });
                }
                // Must have sql server backend defined
                if (!app || !app.locals || !app.locals.sqlserver) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Missing upstream master sql server database connection`
                    });
                }
                // Verify existence of root and root tenant
                // If they do not exist, we will show the initial setup ejs pages
                const sql = app.locals.sqlserver;
                const tenants = yield sql.query(`SELECT * FROM tenants`);
                if (!tenants || !tenants.recordset || tenants.recordset.length <= 0) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Unable to retrieve list of tenants`
                    });
                }
                /*
                    recordset: any[]
                    output: object
                    rowsAffected: number[]
                */
                return resolve({
                    success: true,
                    code: 0,
                    message: 'OK'
                });
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.log(`Bootstrap.preStart: error`);
                    console.error(err);
                }
                return resolve({
                    success: false,
                    code: 500,
                    message: err && err.message ? err.message : `Unknown error occurred: ${err ? err.toString() : 'void'}`
                });
            }
        }));
    }
    // Return a BootstrapStartupResponse. success of false will result in server always rendering error state
    postStart(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                return resolve({
                    success: true,
                    code: 0,
                    message: `OK`
                });
            }
            catch (err) {
                if (!err.handled) {
                    err.handled = true;
                    console.log(`Bootstrap.postStart: error`);
                    console.error(err);
                }
                return resolve({
                    success: false,
                    code: 500,
                    message: err && err.message ? err.message : `Unknown error occurred: ${err ? err.toString() : 'void'}`
                });
            }
        }));
    }
    setServerIntoFailedState(startupResponse) {
        const app = (0, express_1.default)();
        try {
            console.log(`miSSion.webserver: ERROR Set Server into Failed State`);
            console.dir(startupResponse);
            app.use((0, helmet_1.default)());
            app.set('view engine', 'ejs');
            app.all('**', (req, res) => {
                if (req.headers.accept && req.headers.accept.includes('application/json')) {
                    res.status(startupResponse.code).json(startupResponse);
                }
                else {
                    res.render('booterror', startupResponse);
                }
            });
            return app;
        }
        catch (err) {
            console.error(`Unable to set server into failed state`);
            console.error(err);
            return app;
        }
    }
}
exports.Bootstrap = Bootstrap;
