import * as express from 'express'

import { AuthStrategy } from "../../core/auth/authstrategy";
import { BaseManifest } from "../../core/routing/base.manifest";
import { IManifestItem } from "../../core/routing/imanifestitem";
import { FieldwireSDK } from './fieldwire';

import { FieldwireAccounts } from './accounts/accounts';
import { FieldwireProjects } from './projects/projects';
import { FieldwireTasks } from './tasks/tasks';
import { FieldwireDevices } from './devices/devices';
import { FieldwireAWS } from './aws/aws';
import { MsSqlServerDb } from '../../core/databases/mssqldb';
import { FieldwireForms } from './forms/forms';

const sqlServerInitIntervalMs = 1000 * 60 * 10 // 10 minutes

export default class FieldwireManifest extends BaseManifest {

    constructor() {
        super()
        this.items.push(...FieldwireAccounts.manifestItems)
        this.items.push(...FieldwireProjects.manifestItems)
        this.items.push(...FieldwireAWS.manifestItems)
        this.items.push(...FieldwireTasks.manifestItems)
        this.items.push(...FieldwireDevices.manifestItems)
        this.items.push(...FieldwireForms.manifestItems)
    }

    appname: string = 'fieldwireapi'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []

    attach(app: express.Application) {
        return new Promise(async(resolve, reject) => {
            const fieldwireInstance = new FieldwireSDK()
            app.locals.fieldwire = fieldwireInstance
    
            if (app.locals.sqlserver) {
                setInterval(async() => {
                    const sql: MsSqlServerDb = app.locals.sqlserver
                    try {
                        const initResult = await sql.init()
                        sql.query(`SELECT TOP 1 FROM devices`)
                        console.log(`miSSion.webserver: sqlserver: keepalive`)
                    } catch (err) {
                        console.error(err)
                    }
                }, sqlServerInitIntervalMs)
            }
            return resolve(true)
        })
    }

    items: IManifestItem[] = []
}
/*
    Test task id of Block Setup 101: "id": "1a55452b-5ce6-4c7d-ad01-660890c3aebf"
    Block Setup 101: 4b9a65d3-4ce4-4308-b93e-4513ff98fc72
    Samsung Office Building: dc15eebb-6c6e-4bc1-86da-68019d5a16d3
    Test: d0105078-da46-4a42-809f-b015b0cf87c8
*/