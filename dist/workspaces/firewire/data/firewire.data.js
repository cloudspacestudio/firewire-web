"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirewireData = void 0;
const sqldb_1 = require("../../fieldwire/repository/sqldb");
class FirewireData {
}
exports.FirewireData = FirewireData;
_a = FirewireData;
FirewireData.manifestItems = [
    // Get Devices
    {
        method: 'get',
        path: '/api/firewire/devices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDevices();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDevice(deviceId);
                    return res.status(200).json(result);
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Devices
    {
        method: 'get',
        path: '/api/firewire/vwdevices',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwDevices();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Device Materials
    {
        method: 'get',
        path: '/api/firewire/vwdevicematerials',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwDeviceMaterials();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Device Materials by Device Id
    {
        method: 'get',
        path: '/api/firewire/vwdevicematerials/:deviceId',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDeviceMaterialByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Attributes by Device Id
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId/attributes',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getMaterialAttributesByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Device Sub Tasks by Device Id
    {
        method: 'get',
        path: '/api/firewire/devices/:deviceId/subtasks',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const deviceId = req.params.deviceId;
                    if (!deviceId) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing deviceId parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getMaterialSubTasksByDeviceId(deviceId);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Materials
    {
        method: 'get',
        path: '/api/firewire/vwmaterials',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwMaterials();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Categories
    {
        method: 'get',
        path: '/api/firewire/categories',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getCategories();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Vendors
    {
        method: 'get',
        path: '/api/firewire/vendors',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVendors();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Eddy Products
    {
        method: 'get',
        path: '/api/firewire/eddyproducts',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getEddyProducts();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Eddy Pricelist
    {
        method: 'get',
        path: '/api/firewire/eddypricelist',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getEddyPricelist();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Eddy Pricelist combined with Eddy Products
    {
        method: 'get',
        path: '/api/firewire/vweddypricelist',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwEddyPricelist();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get View Eddy Pricelist combined with Eddy Products by Part Number
    {
        method: 'get',
        path: '/api/firewire/vweddypricelist/:partNumber',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const partNumber = req.params.partNumber;
                    if (!partNumber) {
                        return res.status(400).json({
                            message: 'Invalid Payload: Missing partNumber parameter'
                        });
                    }
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getVwEddyPricelistByPartNumber(partNumber);
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    },
    // Get Category Labor
    {
        method: 'get',
        path: '/api/firewire/categorylabors',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getCategoryLabors();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    }
];
FirewireData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => {
    const normalizedMethod = item.method.toLowerCase();
    const method = normalizedMethod === 'get' || normalizedMethod === 'post' || normalizedMethod === 'put' || normalizedMethod === 'patch' || normalizedMethod === 'delete'
        ? normalizedMethod
        : 'get';
    return Object.assign(Object.assign({}, item), { method, path: item.path.replace('/api/firewire/', '/api/fieldwire/') });
});
