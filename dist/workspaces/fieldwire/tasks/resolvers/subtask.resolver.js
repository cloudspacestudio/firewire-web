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
exports.SubTaskResolver = void 0;
class SubTaskResolver {
    constructor(resolvedDevice, deviceResolver) {
        this.resolvedDevice = resolvedDevice;
        this.deviceResolver = deviceResolver;
    }
    resolveSubTasks(params, row) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const preciseTasks = this.deviceResolver.materialSubTasksFromDb.filter(s => s.projectId === params.projectId && s.materialId === this.resolvedDevice.id);
                const genericTasks = this.deviceResolver.materialSubTasksFromDb.filter(s => s.projectId === '*' && s.materialId === this.resolvedDevice.id);
                // Make sure fieldwire has custom attributes available
                // Merge 2 collections together loading most precise first
                const tasks = [];
                preciseTasks.forEach((preciseItem) => {
                    tasks.push(preciseItem);
                });
                genericTasks.forEach((genericItem) => {
                    const alreadyExistsTest = tasks.find(s => s.statusName === genericItem.statusName);
                    if (!alreadyExistsTest) {
                        tasks.push(genericItem);
                    }
                });
                console.log(`Confirmed material subtasks list:`);
                console.dir(tasks);
                return resolve(tasks);
            }
            catch (err) {
                console.error(err);
                return reject(err);
            }
        }));
    }
}
exports.SubTaskResolver = SubTaskResolver;
