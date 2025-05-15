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
exports.DeviceStrategies = void 0;
const device_resolver_1 = require("../resolvers/device.resolver");
class DeviceStrategies {
    constructor() {
        this.strategies = [
            {
                name: 'test.fa2.01',
                fx(params, row, devicesFromDb, aliasesFromDb) {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const title = row['Visibility'];
                            const deviceA = row['DEVICEA'];
                            const deviceC = row['DEVICEC'];
                            // Look for simple first
                            const testSimple = devicesFromDb.find(s => s.name === title);
                            if (testSimple) {
                                return resolve(testSimple);
                            }
                            if (deviceA) {
                                // Lookup by part number
                                const testDeviceA = devicesFromDb.find(s => s.partNumber === deviceA);
                                if (testDeviceA) {
                                    return resolve(testDeviceA);
                                }
                            }
                            if (deviceC) {
                                const testDeviceC = devicesFromDb.find(s => s.partNumber === deviceC);
                                if (testDeviceC) {
                                    return resolve(testDeviceC);
                                }
                            }
                            // Check device aliases
                            const aliasedDevice = device_resolver_1.DeviceResolver.searchForAlias(title, params, devicesFromDb, aliasesFromDb);
                            if (aliasedDevice) {
                                return resolve(aliasedDevice);
                            }
                            return resolve(null);
                        }
                        catch (err) {
                            return reject(err);
                        }
                    }));
                }
            }
        ];
    }
}
exports.DeviceStrategies = DeviceStrategies;
