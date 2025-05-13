import * as express from 'express'
import { ResolverParams } from "./resolver.params";
import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { FieldwireSDK } from "../../fieldwire";
import { Device } from '../../repository/device';
import { Category } from '../../repository/category';
import { Vendor } from '../../repository/vendor';
import { SqlDb } from '../../repository/sqldb';
import { Material } from '../../repository/material';
import { DeviceMaterial } from '../../repository/devicematerial';
import { TeamSchema } from '../../schemas/team.schema';
import { MaterialAttribute } from '../../repository/materialattribute';
import { TaskTypeAttributeSchema } from '../../schemas/tasktypeattribute';
import { MaterialSubTask } from '../../repository/materialsubtask';
import { DeviceResolutionStrategy } from '../../repository/deviceResolutionStrategy';
import { DeviceAlias } from '../../repository/devicealias';
import { DeviceStrategies, FormulaStrategy } from '../strategies/device.strategies';

export class DeviceResolver {

    public devicesFromDb: Device[] = []
    public categoriesFromDb: Category[] = []
    public vendorsFromDb: Vendor[] = []
    public materialsFromDb: Material[] = []
    public deviceMaterialsFromDb: DeviceMaterial[] = []
    public materialAttributesFromDb: MaterialAttribute[] = []
    public materialSubTasksFromDb: MaterialSubTask[] = []
    public deviceResolutionStrategiesFromDb: DeviceResolutionStrategy[] = []
    public deviceAliasesFromDb: DeviceAlias[] = []

    public selectedDeviceResolutionStrategy: DeviceResolutionStrategy|null|undefined = null

    public teamsFromFieldwire: TeamSchema[] = []
    public taskTypeAttributesFromFieldwire: TaskTypeAttributeSchema[] = []
    
    public deviceCache: ResolvedDevice[] = []
    public sqldb: SqlDb = new SqlDb(this.app)

    constructor(public fw: FieldwireSDK, public app: express.Application) {}

    init(params: ResolverParams): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                // Load Devices
                if (!this.devicesFromDb || this.devicesFromDb.length <= 0) {
                    this.devicesFromDb = await this.sqldb.getDevices()
                }
                // Load Category
                if (!this.categoriesFromDb || this.categoriesFromDb.length <= 0) {
                    this.categoriesFromDb = await this.sqldb.getCategories()
                }
                // Load Vendor
                if (!this.vendorsFromDb || this.vendorsFromDb.length <= 0) {
                    this.vendorsFromDb = await this.sqldb.getVendors()
                }
                // Load Materials
                if (!this.materialsFromDb || this.materialsFromDb.length <= 0) {
                    this.materialsFromDb = await this.sqldb.getMaterials()
                }
                // Load Device Materials
                if (!this.deviceMaterialsFromDb || this.deviceMaterialsFromDb.length <= 0) {
                    this.deviceMaterialsFromDb = await this.sqldb.getDeviceMaterials()
                }
                // Load Material Attributes
                if (!this.materialAttributesFromDb || this.materialAttributesFromDb.length <= 0) {
                    this.materialAttributesFromDb = await this.sqldb.getMaterialAttributes()
                }
                // Load Material Sub Tasks
                if (!this.materialSubTasksFromDb || this.materialSubTasksFromDb.length <= 0) {
                    this.materialSubTasksFromDb = await this.sqldb.getMaterialSubTasks()
                }
                if (!this.deviceResolutionStrategiesFromDb || this.deviceResolutionStrategiesFromDb.length <= 0) {
                    this.deviceResolutionStrategiesFromDb = await this.sqldb.getDeviceResolutionStrategies()
                }
                if (!this.deviceAliasesFromDb || this.deviceAliasesFromDb.length <= 0) {
                    this.deviceAliasesFromDb = await this.sqldb.getDeviceAliases()
                }

                // Load "Teams" Categories for project from fieldwire
                this.teamsFromFieldwire = await this.fw.teams(params.projectId)
                // Load "Task Type Attributes" for project from fieldwire
                this.taskTypeAttributesFromFieldwire = await this.fw.projectTaskTypeAttributes(params.projectId)

                // Now determine the device resolution strategy
                this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.batchId===params.batchId)
                if (!this.selectedDeviceResolutionStrategy) {
                    this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.projectId===params.projectId)
                }
                if (!this.selectedDeviceResolutionStrategy) {
                    this.selectedDeviceResolutionStrategy = this.deviceResolutionStrategiesFromDb.find(s => s.projectId==='*')
                }
                

                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }

    resolveDevice(params: ResolverParams, row: any): Promise<ResolvedDevice|null> {
        return new Promise(async(resolve, reject) => {
            try {
                const selectedDevice: Device | null = await this.resolveDeviceRecord(params, row)
                if (!selectedDevice) {
                    console.log(`Unable to locate a device record "${JSON.stringify(row)}"`)
                    return resolve(null)
                }

                const test = this.deviceCache.find(s => s.name===selectedDevice.name)
                if (test) {
                    return resolve(test)
                }

                const category = this.categoriesFromDb.find(s => s.categoryId===selectedDevice.categoryId)
                const vendor = this.vendorsFromDb.find(s => s.vendorId===selectedDevice.vendorId)
                if (!category) {
                    console.log(`Unable to locate corresponding related category for device "${selectedDevice.name}" using categoryId of "${selectedDevice.categoryId}"`)
                    return resolve(null)
                }
                if (!vendor) {
                    console.log(`Unable to locate corresponding related vendor for device "${selectedDevice.name}" using vendorId of "${selectedDevice.vendorId}"`)
                    return resolve(null)
                }
                let fwTeam = this.teamsFromFieldwire.find(s=>s.name===category.name)
                if (!fwTeam) {
                    // Do we automatically create the category in Fieldwire?
                    fwTeam = await this.fw.createTeam({
                        
                        id: '',
                        handle: category.handle,
                        name: category.name,
                        project_id: params.projectId
                    })
                    this.teamsFromFieldwire.push(fwTeam)
                }
                const resolvedDevice: ResolvedDevice = {
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
                }
                // resolve this device product list
                const deviceMaterialsTest = this.deviceMaterialsFromDb.filter(s => s.deviceId===selectedDevice.deviceId)
                if (deviceMaterialsTest && deviceMaterialsTest.length > 0) {
                    // We found records, load from materials repo
                    deviceMaterialsTest.forEach((deviceMaterial: DeviceMaterial) => {
                        const materialTest = this.materialsFromDb.find(s => s.materialId===deviceMaterial.materialId)
                        if (materialTest) {
                            resolvedDevice.materials.push(materialTest)
                        } else {
                            console.warn(`Unable to locate material id ${deviceMaterial.materialId} for device ${selectedDevice.name}`)
                        }
                    })
                } else {
                    // There were no device material records found. Default to use device part number
                    const materialByPartAndVendor = this.materialsFromDb.find((s: Material) => s.partNumber===selectedDevice.partNumber && s.vendorId===selectedDevice.vendorId)
                    if (materialByPartAndVendor) {
                        resolvedDevice.materials.push(materialByPartAndVendor)
                    } else {
                        console.warn(`Unable to set default material to match device id ${selectedDevice.name} for part number ${selectedDevice.partNumber} and vendor id ${selectedDevice.vendorId}`)
                    }
                }

                this.deviceCache.push(resolvedDevice)
                return resolve(resolvedDevice)
            } catch (err) {
                return reject(err)
            }
        })
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
    private resolveDeviceRecord(params: ResolverParams, row: any): Promise<Device|null> {
        return new Promise(async(resolve, reject) => {
            try {
                if (this.selectedDeviceResolutionStrategy) {
                    // Use the strategy from formula to read the device key and fetch the device
                    // Syntax of column names to use as lookups in device table
                    // name=Visibility|part number=partNumber etc.
                    // for simplicity and until we lock in the strategy, use static values
                    const deviceStrategies: DeviceStrategies = new DeviceStrategies()
                    const strategy: FormulaStrategy | undefined = deviceStrategies.strategies.find(s=>s.name===this.selectedDeviceResolutionStrategy?.formula)
                    if (strategy) {
                        const strategyResult = await strategy.fx(params, row, this.devicesFromDb, this.deviceAliasesFromDb)
                        return resolve(strategyResult)
                    } else {
                        const defaultResult = await this.defaultResolveDeviceRecord(params, row)
                        return resolve(defaultResult)
                    }
                } else {
                    const result = await this.defaultResolveDeviceRecord(params, row)
                    return resolve(result)
                }
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })

    }

    private defaultResolveDeviceRecord(params: ResolverParams, row: any): Promise<Device|null> {
        return new Promise(async(resolve, reject) => {
            const defaultDeviceFieldName = 'Visibility'
            try {
                const test = this.devicesFromDb.find(s => s.name===row[defaultDeviceFieldName])
                if (test) {
                    return resolve(test)
                }
                // Check device aliases
                return resolve(DeviceResolver.searchForAlias(row[defaultDeviceFieldName], params,
                    this.devicesFromDb, this.deviceAliasesFromDb
                ))
            } catch (err) {
                return reject(err)
            }
        })
    }

    static searchForAlias(text: string, params: ResolverParams, 
        devicesFromDb: Device[],
        deviceAliasesFromDb: DeviceAlias[]): Device|null {
        let aliases = deviceAliasesFromDb.filter(s => s.aliasText===text && s.batchId===params.batchId)
        if (aliases.length <= 0) {
            aliases = deviceAliasesFromDb.filter(s => s.aliasText === text && s.projectId===params.projectId)
        }
        if (aliases.length <= 0) {
            aliases = deviceAliasesFromDb.filter(s => s.aliasText===text && s.projectId==='*')
        }
        if (aliases.length <= 0) {
            return null
        }
        let foundDevice: Device|null = null
        aliases.forEach((alias: DeviceAlias) => {
            const test = devicesFromDb.find(s => s.name===alias.matchToText)
            if (test && !foundDevice) {
                foundDevice = Object.assign({}, test)
            }
        })
        return foundDevice
    }

}