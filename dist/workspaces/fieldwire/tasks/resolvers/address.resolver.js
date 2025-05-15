"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddressResolver = void 0;
class AddressResolver {
    constructor(resolvedDevice, deviceResolver) {
        this.resolvedDevice = resolvedDevice;
        this.deviceResolver = deviceResolver;
    }
    resolveAddress(params, row) {
        if (!row) {
            return null;
        }
        const possibleNames = ['ADDRESS', 'ADDRESS1', 'ADDRESS2', 'address',
            'address1', 'address2', 'slcAddress'];
        let value = null;
        possibleNames.forEach((possibleName) => {
            if (!value && row.hasOwnProperty(possibleName)) {
                value = row[possibleName];
            }
        });
        return value;
    }
}
exports.AddressResolver = AddressResolver;
