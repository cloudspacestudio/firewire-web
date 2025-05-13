import { ResolverParams } from "../resolvers/resolver.params"
import { Device } from "../../repository/device"
import { DeviceAlias } from "../../repository/devicealias"
import { DeviceResolver } from "../resolvers/device.resolver"

export class DeviceStrategies {

    constructor() {}

    public strategies: FormulaStrategy[] = [
        {
            name: 'test.fa2.01',
            fx(params: ResolverParams, row: any, devicesFromDb: Device[], aliasesFromDb: DeviceAlias[]): Promise<Device|null> {
                return new Promise(async(resolve, reject) => {
                    try {
                        const title = row['Visibility']
                        const deviceA = row['DEVICEA']
                        const deviceC = row['DEVICEC']

                        // Look for simple first
                        const testSimple = devicesFromDb.find(s => s.name===title)
                        if (testSimple) {
                            return resolve(testSimple)
                        }
                        if (deviceA) {
                            // Lookup by part number
                            const testDeviceA = devicesFromDb.find(s => s.partNumber===deviceA)
                            if (testDeviceA) {
                                return resolve(testDeviceA)
                            }
                        }
                        if (deviceC) {
                            const testDeviceC = devicesFromDb.find(s => s.partNumber===deviceC)
                            if(testDeviceC) {
                                return resolve(testDeviceC)
                            }
                        }
                        // Check device aliases
                        const aliasedDevice = DeviceResolver.searchForAlias(title, params, devicesFromDb, aliasesFromDb)
                        if (aliasedDevice) {
                            return resolve(aliasedDevice)
                        }
                        return resolve(null)
                    } catch (err) {
                        return reject(err)
                    }
                })
            }
        }
    ]

}

export interface FormulaStrategy {
    name: string
    fx(params: ResolverParams, row: any, devicesFromDb: Device[], aliasesFromDb: DeviceAlias[]): Promise<Device|null>
}