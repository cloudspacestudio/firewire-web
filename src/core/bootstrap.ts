import express from 'express'
import helmet from 'helmet'
import ejs from 'ejs'
import * as fs from 'node:fs'
import * as path from 'node:path'
import 'dotenv/config'
import { v4 } from 'uuid'
import { ContentPostgresDb } from './datasources/postgresdb'
import { PoolConfig } from 'pg'
import { ContentMongoDb, IMongoConfig } from './datasources/mongodb'
import { MsSqlServerDb, ISqlServerConfig } from './datasources/mssqldb'
import { RouteResolver } from './routing/route.resolver'

export class Bootstrap {

    start(): Promise<express.Application> {
        return new Promise(async(resolve, reject) => {
            try {
                const app = express()
                
                app.use(helmet())
                app.set('view engine', 'ejs')
                app.use(express.json())
                
                // #region Mongo DB Setup
                if (process.env.MONGOURL) {
                    const mongoConfig: IMongoConfig = {
                        remoteuri: process.env.MONGOURL||'',
                        dbname: process.env.MONGODBNAME||'',
                        appname: process.env.APPNAME||'',
                        timeout: 5000
                    }
                    const mongoDb = new ContentMongoDb(mongoConfig)
                    app.locals.mongodb = mongoDb
                }
                // #endregion
                
                // #region Postgres DB Setup
                if (process.env.PGHOST) {
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
                    app.locals.postgresdb = postgresDb    
                
                }
                // #endregion
                
                // #region Sql Server DB Setup
                if (process.env.SQLSRV) {
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
                    const sqlserver = new MsSqlServerDb(sqlConfig)
                    app.locals.sqlserver = sqlserver
                }
                // #endregion

                // Read manifest and create endpoints
                const resolver: RouteResolver = new RouteResolver(path.join(process.cwd(), 'src', 'workspaces'))
                await resolver.attach(app)
                
                app.all('/api/*', (req, res) => {
                    res.sendStatus(404)
                })
                
                app.get('**', (req, res) => {
                    // Send index.html for SPA
                    res.sendStatus(404)
                })
                
                app.all('**', (req, res) => {
                    res.sendStatus(404)
                })
                
                return resolve(app)       
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }

}