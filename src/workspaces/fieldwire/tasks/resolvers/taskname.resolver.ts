import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { DeviceResolver } from "./device.resolver";
import { ResolverParams } from "./resolver.params";

export class TaskNameResolver {

    constructor(private resolvedDevice: ResolvedDevice, private deviceResolver: DeviceResolver) {}

    resolveTaskName(params: ResolverParams, row: any, address: string|null): string | null {
        if (!row) {
            return null
        }
        // Name Sample: 0020020161 - Power Monitor Shunt (CT1)
        if (!address) {
            return `${this.resolvedDevice.shortName} (${this.resolvedDevice.category.handle})`
        }
        return `${address} - ${this.resolvedDevice.shortName} (${this.resolvedDevice.category.handle})`
    }

}