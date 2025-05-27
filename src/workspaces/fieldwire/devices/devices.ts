import * as express from 'express'
import { FieldwireSDK } from '../fieldwire'
import { SqlDb } from '../repository/sqldb'

export class FieldwireDevices {

    static manifestItems = [
        {
            method: 'get',
            path: '/api/fieldwire/devices',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDevices()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/vwdevices',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwDevices()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/vwmaterials',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwMaterials()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/categories',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getCategories()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/vendors',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVendors()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/eddyproducts',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getEddyProducts()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        {
            method: 'get',
            path: '/api/fieldwire/eddypricelist',
            fx: (req: express.Request, res: express.Response) => {
                const fieldwire: FieldwireSDK = req.app.locals.fieldwire
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getEddyPricelist()
                        return res.status(200).json({
                            rows: result
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }

    ]

}