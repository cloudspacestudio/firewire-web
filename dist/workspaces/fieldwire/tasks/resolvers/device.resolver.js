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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeviceResolver = void 0;
const sqldb_1 = require("../../repository/sqldb");
const device_strategies_1 = require("../strategies/device.strategies");
class DeviceResolver {
    constructor(fw, app) {
        this.fw = fw;
        this.app = app;
        this.devicesFromDb = [];
        this.categoriesFromDb = [];
        this.vendorsFromDb = [];
        this.materialsFromDb = [];
        this.deviceMaterialsFromDb = [];
        this.materialAttributesFromDb = [];
        this.materialSubTasksFromDb = [];
        this.deviceResolutionStrategiesFromDb = [];
        this.deviceAliasesFromDb = [];
        this.selectedDeviceResolutionStrategy = null;
        this.teamsFromFieldwire = [];
        this.taskTypeAttributesFromFieldwire = [];
        this.deviceCache = [];
        this.sqldb = new sqldb_1.SqlDb(this.app);
    }
    init(params) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                // Load Devices
                if (!this.devicesFromDb || this.devicesFromDb.length <= 0) {
                    this.devicesFromDb = yield this.sqldb.getDevices();
                }
                // Load Category
                if (!this.categoriesFromDb || this.categoriesFromDb.length <= 0) {
                    this.categoriesFromDb = yield this.sqldb.getCategories();
                }
                // Load Vendor
                if (!this.vendorsFromDb || this.vendorsFromDb.length <= 0) {
                    this.vendorsFromDb = yield this.sqldb.getVendors();
                }
                // Load Materials
                if (!this.materialsFromDb || this.materialsFromDb.length <= 0) {
                    this.materialsFromDb = yield this.sqldb.getMaterials();
                }
                // Load Device Materials
                if (!this.deviceMaterialsFromDb || this.deviceMaterialsFromDb.length <= 0) {
                    this.deviceMaterialsFromDb = yield this.sqldb.getDeviceMaterials();
                }
                // Load Material Attributes
                if (!this.materialAttributesFromDb || this.materialAttributesFromDb.length <= 0) {
                    this.materialAttributesFromDb = yield this.sqldb.getMaterialAttributes();
                }
                // Load Material Sub Tasks
                if (!this.materialSubTasksFromDb || this.materialSubTasksFromDb.length <= 0) {
                    this.materialSubTasksFromDb = yield this.sqldb.getMaterialSubTasks();
                }
                if (!this.deviceResolutionStrategiesFromDb || this.deviceResolutionStrategiesFromDb.length <= 0) {
                    this.deviceResolutionStrategiesFromDb = yield this.sqldb.getDeviceResolutionStrategies();
                }
                if (!this.deviceAliasesFromDb || this.deviceAliasesFromDb.length <= 0) {
                    this.deviceAliasesFromDb = yield this.sqldb.getDeviceAliases();
                }
                // Load "Teams" Categories for project from fieldwire
                this.teamsFromFieldwire = yield this.fw.teams(params.projectId);
                // Load "Task Type Attributes" for project from fieldwire
                this.taskTypeAttributesFromFieldwire = yield this.fw.projectTaskTypeAttributes(params.projectId);
                // Now determine the device resolution strategy
                this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.batchId === params.batchId);
                if (!this.selectedDeviceResolutionStrategy) {
                    this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.projectId === params.projectId);
                }
                if (!this.selectedDeviceResolutionStrategy) {
                    this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.projectId === '*');
                }
                return resolve(true);
            }
            catch (err) {
                console.error(err);
                return reject(err);
            }
        }));
    }
    resolveDevice(params, row) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const selectedDevice = yield this.resolveDeviceRecord(params, row);
                if (!selectedDevice) {
                    return resolve(null);
                }
                const test = this.deviceCache.find(s => s.name === selectedDevice.name);
                if (test) {
                    return resolve(test);
                }
                const category = this.categoriesFromDb.find(s => s.categoryId === selectedDevice.categoryId);
                const vendor = this.vendorsFromDb.find(s => s.vendorId === selectedDevice.vendorId);
                if (!category) {
                    console.log(`Unable to locate corresponding related category for device "${selectedDevice.name}" using categoryId of "${selectedDevice.categoryId}"`);
                    return resolve(null);
                }
                if (!vendor) {
                    console.log(`Unable to locate corresponding related vendor for device "${selectedDevice.name}" using vendorId of "${selectedDevice.vendorId}"`);
                    return resolve(null);
                }
                let fwTeam = this.teamsFromFieldwire.find(s => s.name === category.name);
                if (!fwTeam) {
                    // Do we automatically create the category in Fieldwire?
                    fwTeam = yield this.fw.createTeam({
                        id: '',
                        handle: category.handle,
                        name: category.name,
                        project_id: params.projectId
                    });
                    this.teamsFromFieldwire.push(fwTeam);
                }
                const resolvedDevice = {
                    id: selectedDevice.deviceId,
                    name: selectedDevice.name,
                    shortName: selectedDevice.shortName,
                    partNumber: selectedDevice.partNumber,
                    link: selectedDevice.link,
                    cost: selectedDevice.cost,
                    defaultLabor: selectedDevice.defaultLabor,
                    category: category,
                    vendor: vendor,
                    materials: [],
                    slcAddress: selectedDevice.slcAddress,
                    serialNumber: selectedDevice.serialNumber,
                    strobeAddress: selectedDevice.strobeAddress,
                    speakerAddress: selectedDevice.speakerAddress,
                    fwTeamId: fwTeam.id
                };
                // resolve this device product list
                const deviceMaterialsTest = this.deviceMaterialsFromDb.filter(s => s.deviceId === selectedDevice.deviceId);
                if (deviceMaterialsTest && deviceMaterialsTest.length > 0) {
                    // We found records, load from materials repo
                    deviceMaterialsTest.forEach((deviceMaterial) => {
                        const materialTest = this.materialsFromDb.find(s => s.materialId === deviceMaterial.materialId);
                        if (materialTest) {
                            resolvedDevice.materials.push(materialTest);
                        }
                        else {
                            console.warn(`Unable to locate material id ${deviceMaterial.materialId} for device ${selectedDevice.name}`);
                        }
                    });
                }
                else {
                    // There were no device material records found. Default to use device part number
                    const materialByPartAndVendor = this.materialsFromDb.find((s) => s.partNumber === selectedDevice.partNumber && s.vendorId === selectedDevice.vendorId);
                    if (materialByPartAndVendor) {
                        resolvedDevice.materials.push(materialByPartAndVendor);
                    }
                    else {
                        console.warn(`Unable to set default material to match device id ${selectedDevice.name} for part number ${selectedDevice.partNumber} and vendor id ${selectedDevice.vendorId}`);
                    }
                }
                this.deviceCache.push(resolvedDevice);
                return resolve(resolvedDevice);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    /*
        In the file, what is the field name to use as the "device name"
        This field name can vary by project, batch or even floorplan if desired
        Returned maps use projectId, batchId, floorplanId fields where * means default
        e.g. projectId: *, batchId: *, floorplanId: * means "all imports"
        e.g. projectId: 123, batchId: *, floorplanId: * means if projectId = 123
        can use any function to interrogate the row and params and return a value
        return value is expected to match either devices.name, devices.shortName
        return value can return an alias from devicealiases table as well
    */
    resolveDeviceRecord(params, row) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (this.selectedDeviceResolutionStrategy) {
                    // Use the strategy from formula to read the device key and fetch the device
                    // Syntax of column names to use as lookups in device table
                    // name=Visibility|part number=partNumber etc.
                    // for simplicity and until we lock in the strategy, use static values
                    const deviceStrategies = new device_strategies_1.DeviceStrategies();
                    const strategy = deviceStrategies.strategies.find(s => { var _a; return s.name === ((_a = this.selectedDeviceResolutionStrategy) === null || _a === void 0 ? void 0 : _a.formula); });
                    if (strategy) {
                        const strategyResult = yield strategy.fx(params, row, this.devicesFromDb, this.deviceAliasesFromDb);
                        return resolve(strategyResult);
                    }
                    else {
                        const defaultResult = yield this.defaultResolveDeviceRecord(params, row);
                        return resolve(defaultResult);
                    }
                }
                else {
                    const result = yield this.defaultResolveDeviceRecord(params, row);
                    return resolve(result);
                }
            }
            catch (err) {
                console.error(err);
                return reject(err);
            }
        }));
    }
    defaultResolveDeviceRecord(params, row) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            const defaultDeviceFieldName = 'Visibility';
            try {
                const test = this.devicesFromDb.find(s => s.name === row[defaultDeviceFieldName]);
                if (test) {
                    return resolve(test);
                }
                // Check device aliases
                return resolve(DeviceResolver.searchForAlias(row[defaultDeviceFieldName], params, this.devicesFromDb, this.deviceAliasesFromDb));
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    static searchForAlias(text, params, devicesFromDb, deviceAliasesFromDb) {
        let aliases = deviceAliasesFromDb.filter(s => s.aliasText === text && s.batchId === params.batchId);
        if (aliases.length <= 0) {
            aliases = deviceAliasesFromDb.filter(s => s.aliasText === text && s.projectId === params.projectId);
        }
        if (aliases.length <= 0) {
            aliases = deviceAliasesFromDb.filter(s => s.aliasText === text && s.projectId === '*');
        }
        if (aliases.length <= 0) {
            return null;
        }
        let foundDevice = null;
        aliases.forEach((alias) => {
            const test = devicesFromDb.find(s => s.name === alias.matchToText);
            if (test && !foundDevice) {
                foundDevice = Object.assign({}, test);
            }
        });
        return foundDevice;
    }
}
exports.DeviceResolver = DeviceResolver;
