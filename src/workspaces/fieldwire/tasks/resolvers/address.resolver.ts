import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { DeviceResolver } from "./device.resolver";
import { ResolverParams } from "./resolver.params";

export class AddressResolver {

    constructor(private resolvedDevice: ResolvedDevice, private deviceResolver: DeviceResolver) {}

    resolveAddress(params: ResolverParams, row: any): string | null {
        if (!row) {
            return null
        }
        const possibleNames = ['ADDRESS', 'ADDRESS1', 'ADDRESS2', 'address', 
            'address1', 'address2', 'slcAddress']
        let value: string | null = null
        possibleNames.forEach((possibleName) => {
            if (!value && row.hasOwnProperty(possibleName)) {
                value = row[possibleName]
            }
        })
        return value
    }

}