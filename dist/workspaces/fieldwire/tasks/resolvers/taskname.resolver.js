"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskNameResolver = void 0;
class TaskNameResolver {
    constructor(resolvedDevice, deviceResolver) {
        this.resolvedDevice = resolvedDevice;
        this.deviceResolver = deviceResolver;
    }
    resolveTaskName(params, row, address) {
        if (!row) {
            return null;
        }
        // Name Sample: 0020020161 - Power Monitor Shunt (CT1)
        if (!address) {
            return `${this.resolvedDevice.shortName} (${this.resolvedDevice.category.handle})`;
        }
        return `${address} - ${this.resolvedDevice.shortName} (${this.resolvedDevice.category.handle})`;
    }
}
exports.TaskNameResolver = TaskNameResolver;
