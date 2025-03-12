import * as mssql from 'mssql'

export class MsSqlServerDb {

    public pool: mssql.ConnectionPool | null = null
    private _connected: boolean = false
    
    constructor(private config: ISqlServerConfig) {
    }

    init(): Promise<mssql.ConnectionPool> {
        return new Promise(async(resolve, reject) => {
            try {
                if (this.pool) {
                    return resolve(this.pool)
                }
                this.pool = await mssql.connect(this.config)
                return resolve(this.pool)
            } catch (err) {
                return reject(err)
            }
        })
    }

    query(statement: string): Promise<mssql.IResult<any>> {
        return new Promise(async(resolve, reject) => {
            try {
                const pool: mssql.ConnectionPool = await this.init()
                if (!pool || pool instanceof Error) {
                    throw new Error(`Invalid SQL Connection Pool instance`)
                }
                const result = await pool.request().query(statement)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        })
    }
}

export interface ISqlServerConfig {
    user?: string
    password?: string
    server: string
    database: string
    options?: any
    driver?: string
}
export interface ISqlServerConfigOptions {
    trustedConnection: boolean
    trustServerCertificate: boolean
}