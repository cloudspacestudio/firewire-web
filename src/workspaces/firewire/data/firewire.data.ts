import * as express from 'express'
import { SqlDb } from '../../fieldwire/repository/sqldb'

export class FirewireData {

    static manifestItems = [
        // Get Devices
        {
            method: 'get',
            path: '/api/firewire/devices',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get Device
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDevice(deviceId)
                        return res.status(200).json(result)
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        },
        // Get View Devices
        {
            method: 'get',
            path: '/api/firewire/vwdevices',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get View Device Materials
        {
            method: 'get',
            path: '/api/firewire/vwdevicematerials',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwDeviceMaterials()
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
        // Get View Device Materials by Device Id
        {
            method: 'get',
            path: '/api/firewire/vwdevicematerials/:deviceId',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getDeviceMaterialByDeviceId(deviceId)
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
        // Get Device Attributes by Device Id
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/attributes',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getMaterialAttributesByDeviceId(deviceId)
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
        // Get Device Sub Tasks by Device Id
        {
            method: 'get',
            path: '/api/firewire/devices/:deviceId/subtasks',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const deviceId = req.params.deviceId
                        if (!deviceId) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing deviceId parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getMaterialSubTasksByDeviceId(deviceId)
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
        // Get View Materials
        {
            method: 'get',
            path: '/api/firewire/vwmaterials',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get Categories
        {
            method: 'get',
            path: '/api/firewire/categories',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get Vendors
        {
            method: 'get',
            path: '/api/firewire/vendors',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get Eddy Products
        {
            method: 'get',
            path: '/api/firewire/eddyproducts',
            fx: (req: express.Request, res: express.Response) => {
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
        // Get Eddy Pricelist
        {
            method: 'get',
            path: '/api/firewire/eddypricelist',
            fx: (req: express.Request, res: express.Response) => {
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
        },
        // Get View Eddy Pricelist combined with Eddy Products
        {
            method: 'get',
            path: '/api/firewire/vweddypricelist',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwEddyPricelist()
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
        // Get View Eddy Pricelist combined with Eddy Products by Part Number
        {
            method: 'get',
            path: '/api/firewire/vweddypricelist/:partNumber',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const partNumber = req.params.partNumber
                        if (!partNumber) {
                            return res.status(400).json({
                                message: 'Invalid Payload: Missing partNumber parameter'
                            })
                        }
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getVwEddyPricelistByPartNumber(partNumber)
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
        // Get Category Labor
        {
            method: 'get',
            path: '/api/firewire/categorylabors',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const sqldb: SqlDb = new SqlDb(req.app)
                        const result = await sqldb.getCategoryLabors()
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

    static legacyFieldwireAliasItems = FirewireData.manifestItems.map((item) => {
        const normalizedMethod = item.method.toLowerCase()
        const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
            ? normalizedMethod
            : 'get'

        return {
            ...item,
            method,
            path: item.path.replace('/api/firewire/', '/api/fieldwire/')
        }
    })
}
