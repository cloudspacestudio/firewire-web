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

export class DeviceResolver {

    public devicesFromDb: Device[] = []
    public categoriesFromDb: Category[] = []
    public vendorsFromDb: Vendor[] = []
    public materialsFromDb: Material[] = []
    public deviceMaterialsFromDb: DeviceMaterial[] = []
    public materialAttributesFromDb: MaterialAttribute[] = []
    public materialSubTasksFromDb: MaterialSubTask[] = []

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

                // Load "Teams" Categories for project from fieldwire
                this.teamsFromFieldwire = await this.fw.teams(params.projectId)
                // Load "Task Type Attributes" for project from fieldwire
                this.taskTypeAttributesFromFieldwire = await this.fw.projectTaskTypeAttributes(params.projectId)

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
                const deviceNameFromRow = this.resolveDeviceName(params, row)
                if (!deviceNameFromRow) {
                    console.log(`Cannot determine device name for row ${JSON.stringify(row)}`)
                    return resolve(null)
                }
                const test = this.deviceCache.find(s => s.name===deviceNameFromRow)
                if (test) {
                    return resolve(test)
                }

                // First look for device with the desired field name
                const testDeviceExists = this.devicesFromDb.find(s => s.name===deviceNameFromRow || s.shortName===deviceNameFromRow)
                if (!testDeviceExists) {
                    console.log(`Unable to locate a device record for name "${deviceNameFromRow}"`)
                    return resolve(null)
                }

                const category = this.categoriesFromDb.find(s => s.categoryId===testDeviceExists.categoryId)
                const vendor = this.vendorsFromDb.find(s => s.vendorId===testDeviceExists.vendorId)
                if (!category) {
                    console.log(`Unable to locate corresponding related category for device "${deviceNameFromRow}" using categoryId of "${testDeviceExists.categoryId}"`)
                    return resolve(null)
                }
                if (!vendor) {
                    console.log(`Unable to locate corresponding related vendor for device "${deviceNameFromRow}" using vendorId of "${testDeviceExists.vendorId}"`)
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
                        id: testDeviceExists.deviceId,
                        name: testDeviceExists.name,
                        shortName: testDeviceExists.shortName,
                        partNumber: testDeviceExists.partNumber,
                        link: testDeviceExists.link,
                        cost: testDeviceExists.cost,
                        defaultLabor: testDeviceExists.defaultLabor,
                        category: category,
                        vendor: vendor,
                        materials: [],
                        slcAddress: testDeviceExists.slcAddress,
                        serialNumber: testDeviceExists.serialNumber,
                        strobeAddress: testDeviceExists.strobeAddress,
                        speakerAddress: testDeviceExists.speakerAddress,
                        fwTeamId: fwTeam.id
                }
                // resolve this device product list
                const deviceMaterialsTest = this.deviceMaterialsFromDb.filter(s => s.deviceId===testDeviceExists.deviceId)
                if (deviceMaterialsTest && deviceMaterialsTest.length > 0) {
                    // We found records, load from materials repo
                    deviceMaterialsTest.forEach((deviceMaterial: DeviceMaterial) => {
                        const materialTest = this.materialsFromDb.find(s => s.materialId===deviceMaterial.materialId)
                        if (materialTest) {
                            resolvedDevice.materials.push(materialTest)
                        } else {
                            console.warn(`Unable to locate material id ${deviceMaterial.materialId} for device ${testDeviceExists.name}`)
                        }
                    })
                } else {
                    // There were no device material records found. Default to use device part number
                    const materialByPartAndVendor = this.materialsFromDb.find((s: Material) => s.partNumber===testDeviceExists.partNumber && s.vendorId===testDeviceExists.vendorId)
                    if (materialByPartAndVendor) {
                        resolvedDevice.materials.push(materialByPartAndVendor)
                    } else {
                        console.warn(`Unable to set default material to match device id ${testDeviceExists.name} for part number ${testDeviceExists.partNumber} and vendor id ${testDeviceExists.vendorId}`)
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
    private resolveDeviceName(params: ResolverParams, row: any): string {
        return row['Visibility']
    }

}