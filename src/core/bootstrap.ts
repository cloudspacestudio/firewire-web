import express from 'express'
import helmet from 'helmet'
import * as path from 'node:path'
import * as jwt from 'jsonwebtoken'
import { createPublicKey, KeyObject, JsonWebKey as NodeJsonWebKey } from 'crypto'
import 'dotenv/config'
import { ContentPostgresDb } from './databases/postgresdb'
import { PoolConfig } from 'pg'
import { ContentMongoDb, IMongoConfig } from './databases/mongodb'
import { MsSqlServerDb, ISqlServerConfig } from './databases/mssqldb'
import { RouteResolver } from './routing/route.resolver'

interface OpenIdConfiguration {
    issuer: string
    jwks_uri: string
}

interface JsonWebKeySet {
    keys: EntraJsonWebKey[]
}

interface EntraJsonWebKey {
    kid: string
    kty: string
    use?: string
    alg?: string
    n?: string
    e?: string
    x5c?: string[]
    [key: string]: unknown
}

export class Bootstrap {
    private tokenIssuers: string[] = []
    private tokenAudiences: string[] = []
    private tokenTenantId: string = ''
    private requiredScopes: string[] = this.resolveRequiredScopes()
    private jwkByKid: Map<string, EntraJsonWebKey> = new Map<string, EntraJsonWebKey>()

    start(routeless: boolean = false): Promise<express.Application> {
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
                if (!routeless) {
                    await this.initializeTokenValidation()
                    app.use('/api', this.apiBearerLogger)

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
                }

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

    private async initializeTokenValidation(): Promise<void> {
        if (this.jwkByKid.size > 0 && this.tokenIssuers.length > 0 && this.tokenAudiences.length > 0) {
            return
        }

        const tenantId = process.env.ENTRA_TENANT_ID || process.env.FIREWIRETENANTID || ''
        const envAudience = process.env.ENTRA_API_AUDIENCE || process.env.FIREWIRECLIENTID || ''
        if (!tenantId || !envAudience) {
            throw new Error('Missing Entra token validation settings. Set ENTRA_TENANT_ID (or FIREWIRETENANTID) and ENTRA_API_AUDIENCE (or FIREWIRECLIENTID).')
        }

        const metadataUrl = `https://login.microsoftonline.com/${encodeURIComponent(tenantId)}/v2.0/.well-known/openid-configuration`
        const metadataRes = await fetch(metadataUrl, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        if (metadataRes.status >= 300) {
            const body = await metadataRes.text()
            throw new Error(`Failed to retrieve Entra OpenID metadata (${metadataRes.status}): ${body}`)
        }
        const metadata = await metadataRes.json() as OpenIdConfiguration
        if (!metadata.issuer || !metadata.jwks_uri) {
            throw new Error('Entra OpenID metadata response is missing issuer or jwks_uri.')
        }

        const jwksRes = await fetch(metadata.jwks_uri, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            }
        })
        if (jwksRes.status >= 300) {
            const body = await jwksRes.text()
            throw new Error(`Failed to retrieve Entra signing keys (${jwksRes.status}): ${body}`)
        }
        const jwks = await jwksRes.json() as JsonWebKeySet
        if (!jwks.keys || !Array.isArray(jwks.keys) || jwks.keys.length <= 0) {
            throw new Error('Entra JWKS response does not include signing keys.')
        }

        this.jwkByKid.clear()
        for (const key of jwks.keys) {
            if (key && key.kid) {
                this.jwkByKid.set(key.kid, key)
            }
        }
        if (this.jwkByKid.size <= 0) {
            throw new Error('No key ids (kid) were found in Entra JWKS response.')
        }

        this.tokenTenantId = tenantId
        const configuredAudiences = envAudience
            .split(',')
            .map(s => s.trim())
            .filter(s => !!s)
        const primaryAudience = configuredAudiences[0]
        const audienceSet = new Set<string>(configuredAudiences)
        audienceSet.add(`api://${primaryAudience}`)
        this.tokenAudiences = Array.from(audienceSet)

        const issuerSet = new Set<string>()
        issuerSet.add(metadata.issuer)
        issuerSet.add(`https://login.microsoftonline.com/${tenantId}/v2.0`)
        issuerSet.add(`https://sts.windows.net/${tenantId}/`)
        this.tokenIssuers = Array.from(issuerSet)

        console.log(`miSSion.webserver: loaded Entra metadata and ${this.jwkByKid.size} signing key(s)`)
        console.log(`miSSion.webserver: accepted token audiences`)
        console.dir(this.tokenAudiences)
        console.log(`miSSion.webserver: accepted token issuers`)
        console.dir(this.tokenIssuers)
    }

    private apiBearerLogger: express.RequestHandler = (req: express.Request, res: express.Response, next: express.NextFunction): void => {
        const authHeader = req.headers.authorization
        if (!authHeader) {
            res.status(401).json({
                message: 'Unauthorized'
            })
            return
        }

        const [scheme, token] = authHeader.split(' ')
        if (!scheme || !token || scheme.toLowerCase() !== 'bearer') {
            res.status(401).json({
                message: 'Unauthorized'
            })
            return
        }

        const decoded = jwt.decode(token, { complete: true })

        try {
            const decodedHeader = decoded && typeof decoded === 'object' && 'header' in decoded ? (decoded as any).header : null
            const kid = decodedHeader && decodedHeader.kid ? decodedHeader.kid : ''
            if (!kid || !this.jwkByKid.has(kid)) {
                throw new Error('Unable to resolve signing key for token.')
            }

            const jwk = this.jwkByKid.get(kid) as EntraJsonWebKey
            const publicKey: KeyObject = createPublicKey({ key: jwk as unknown as NodeJsonWebKey, format: 'jwk' })
            const verified = jwt.verify(token, publicKey, {
                algorithms: ['RS256', 'RS384', 'RS512'],
                issuer: this.tokenIssuers,
                audience: this.tokenAudiences
            })

            if (verified && typeof verified === 'object' && 'tid' in verified) {
                const tokenTid = (verified as any).tid
                if (tokenTid && tokenTid !== this.tokenTenantId) {
                    throw new Error('Token tenant mismatch.')
                }
            }

            if (!this.hasRequiredScope(verified)) {
                throw new Error('Token missing required scope.')
            }

            const anyReq: any = req
            anyReq.bearerToken = token
            anyReq.bearerTokenOutput = verified
            next()
        } catch (err: any) {
            if (err && err.message) {
                console.log(`verification error: ${err.message}`)
            }
            res.status(401).json({
                message: 'Unauthorized'
            })
            return
        }
    }

    private resolveRequiredScopes(): string[] {
        const raw = process.env.ENTRA_REQUIRED_SCOPES || 'user_impersonation'
        return raw
            .split(',')
            .map(s => s.trim())
            .filter(s => !!s)
    }

    private hasRequiredScope(verified: any): boolean {
        if (!this.requiredScopes || this.requiredScopes.length <= 0) {
            return true
        }
        if (!verified || typeof verified !== 'object') {
            return false
        }

        const tokenScopes = typeof verified.scp === 'string'
            ? verified.scp.split(' ').map((s: string) => s.trim()).filter((s: string) => !!s)
            : []
        const tokenRoles = Array.isArray(verified.roles)
            ? verified.roles.filter((s: unknown) => typeof s === 'string')
            : []
        const tokenPermissions = new Set<string>([...tokenScopes, ...tokenRoles])

        return this.requiredScopes.some(scope => tokenPermissions.has(scope))
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
