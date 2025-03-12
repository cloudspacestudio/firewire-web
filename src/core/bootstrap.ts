import express from 'express'
import helmet from 'helmet'
import * as path from 'node:path'
import 'dotenv/config'
import { ContentPostgresDb } from './databases/postgresdb'
import { PoolConfig } from 'pg'
import { ContentMongoDb, IMongoConfig } from './databases/mongodb'
import { MsSqlServerDb, ISqlServerConfig } from './databases/mssqldb'
import { RouteResolver } from './routing/route.resolver'

export class Bootstrap {

    start(): Promise<express.Application> {
        return new Promise(async(resolve, reject) => {
            console.log(`miSSion.webserver: starting`)
            const app = express()
            try {
                app.use(helmet())
                console.log(`miSSion.webserver: helmet applied`)
                app.set('view engine', 'ejs')
                console.log(`miSSion.webserver: view engine ejs initialized`)
                app.use(express.json())
                console.log(`miSSion.webserver: json support enabled`)
                
                // #region Mongo DB Setup
                if (process.env.MONGOURL) {
                    console.log(`miSSion.webserver: discovered mongodb env`)
                    const mongoConfig: IMongoConfig = {
                        remoteuri: process.env.MONGOURL||'',
                        dbname: process.env.MONGODBNAME||'',
                        appname: process.env.APPNAME||'',
                        timeout: 5000
                    }
                    const mongoDb = new ContentMongoDb(mongoConfig)
                    console.log(`miSSion.webserver: stoodup mongodb`)
                    app.locals.mongodb = mongoDb
                }
                // #endregion
                
                // #region Postgres DB Setup
                if (process.env.PGHOST) {
                    console.log(`miSSion.webserver: discovered postgres env`)
                    const postgresCert = '' //fs.readFileSync(`ca-certificate.crt`).toString()
                    const postgresConfig: PoolConfig = {
                        user: process.env.PGUSER,
                        password: process.env.PGPWD,
                        host: process.env.PGHOST,
                        port: +(process.env.PGPORT||0),
                        database: process.env.PGDATABASE
                    }
                    if(postgresConfig.host!=='localhost') {
                        postgresConfig.ssl = {
                            rejectUnauthorized: false,
                            ca: postgresCert
                        }
                    }
                    const postgresDb = new ContentPostgresDb(postgresConfig)
                    console.log(`miSSion.webserver: stoodup postgres db`)
                    app.locals.postgresdb = postgresDb
                
                }
                // #endregion
                
                // #region Sql Server DB Setup
                if (process.env.SQLSRV) {
                    console.log(`miSSion.webserver: discovered sql server env`)
                    const sqlConfig: ISqlServerConfig = {
                        server: process.env.SQLSRV,
                        database: process.env.SQLDB||'',
                        driver: 'msnodesqlv8'
                    }
                    if (process.env.SQLUSER) {
                        sqlConfig.user = process.env.SQLUSER
                        sqlConfig.password = process.env.SQLPWD
                    } else {
                        // Use Windows Authentication
                        sqlConfig.options = {
                            trustedConnection: true,
                            trustServerCertificate: true
                        }
                    }
                    if (process.env.SQLSRV==='localhost') {
                        sqlConfig.options = {
                            trustedConnected: false,
                            trustServerCertificate: true
                        }
                    }
                    const sqlserver = new MsSqlServerDb(sqlConfig)
                    console.log(`miSSion.webserver: stoodup sql server`)
                    app.locals.sqlserver = sqlserver
                }
                // #endregion

                // Run any prestartup precondition checks on app and environment
                // If preStart returns anything other than success, the server is dead
                const preStartupResult = await this.preStart(app)
                if (!preStartupResult || !preStartupResult.success) {
                    const failedApp = this.setServerIntoFailedState(preStartupResult)
                    return resolve(failedApp)
                }
                
                // Read manifest and create endpoints
                console.log(`miSSion.webserver: initializing workspace routes`)
                const resolver: RouteResolver = new RouteResolver(path.join(process.cwd(), 'src', 'workspaces'))
                console.log(`miSSion.webserver: attaching routes to webserver`)
                await resolver.attach(app)

                // Check that at least 1 route was registered with functionality
                if (resolver.routeCount <= 0) {
                    // No routes were attached
                    const failedApp = this.setServerIntoFailedState({
                        code: 400,
                        success: false,
                        message: `No routes were identified in this system`
                    })
                    return resolve(failedApp)
                }
                
                // Any requests to API that were not routed return JSON 404
                app.all('/api/*', (req, res) => {
                    res.sendStatus(404).json()
                })
                
                // All get requests not handled return HTML 404
                app.get('**', (req, res) => {
                    // Send index.html for SPA
                    res.sendStatus(404)
                })
                
                // Any requests not otherwise handled return generic 404
                app.all('**', (req, res) => {
                    res.sendStatus(404)
                })

                // Check for any post registration preconditions before starting server listener
                const postStartResult = await this.postStart(app)
                if (!postStartResult.success) {
                    const failedApp = this.setServerIntoFailedState(postStartResult)
                    return resolve(failedApp)
                }
                return resolve(app)       
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.log(`miSSion.webserver: start(): error`)
                    console.error(err)
                }
                const failedApp = this.setServerIntoFailedState({
                    success: false, code: 500, message: err && err.message ? err.message : 'Unknown Error'
                })
                return resolve(failedApp)
            }
        })
    }

    // Return a BootstrapStartupResponse. success of false will result in server always rendering error state
    preStart(app: express.Application): Promise<BootstrapStartupResponse> {
        return new Promise(async(resolve, reject) => {
            try {
                // Must have app secret key defined
                if (!process.env.MISSIONSECRET) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Missing MISSIONSECRET environment variable`
                    })
                }
                // Must have sql server backend defined
                if (!app || !app.locals || !app.locals.sqlserver) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Missing upstream master sql server database connection`
                    })
                }
                // Verify existence of root and root tenant
                // If they do not exist, we will show the initial setup ejs pages
                const sql: MsSqlServerDb = app.locals.sqlserver
                const tenants = await sql.query(`SELECT * FROM tenants`)
                if (!tenants || !tenants.recordset || tenants.recordset.length <= 0) {
                    return resolve({
                        success: false,
                        code: 500,
                        message: `Unable to retrieve list of tenants`
                    })
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
                })
            } catch (err:any) {
                if (!err.handled) {
                    err.handled = true
                    console.log(`Bootstrap.preStart: error`)
                    console.error(err)
                }
                return resolve({
                    success: false,
                    code: 500,
                    message: err && err.message ? err.message: `Unknown error occurred: ${err ? err.toString():'void'}`
                })
            }
        })
    }

    // Return a BootstrapStartupResponse. success of false will result in server always rendering error state
    postStart(app: express.Application): Promise<BootstrapStartupResponse> {
        return new Promise(async(resolve, reject) => {
            try {
                return resolve({
                    success: true,
                    code: 0,
                    message: `OK`
                })
            } catch (err: any) {
                if (!err.handled) {
                    err.handled = true
                    console.log(`Bootstrap.postStart: error`)
                    console.error(err)
                }
                return resolve({
                    success: false,
                    code: 500,
                    message: err && err.message ? err.message: `Unknown error occurred: ${err ? err.toString():'void'}`
                })
            }
        })
    }

    setServerIntoFailedState(startupResponse: BootstrapStartupResponse): express.Application {
        const app = express()
        try {
            console.log(`miSSion.webserver: ERROR Set Server into Failed State`)
            console.dir(startupResponse)
            app.use(helmet())
            app.set('view engine', 'ejs')

            app.all('**', (req, res) => {
                if (req.headers.accept && req.headers.accept.includes('application/json')) {
                    res.status(startupResponse.code).json(startupResponse)
                } else {
                    res.render('booterror', startupResponse)
                }
            })
            return app
        } catch (err: any) {
            console.error(`Unable to set server into failed state`)
            console.error(err)
            return app
        }
    }
}

export interface BootstrapStartupResponse {
    success: boolean
    code: number
    message: string
}