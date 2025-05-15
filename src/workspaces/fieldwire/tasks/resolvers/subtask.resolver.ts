import { MaterialAttribute } from "../../repository/materialattribute";
import { MaterialSubTask } from "../../repository/materialsubtask";
import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { TaskAttributeSchema } from "../../schemas/taskattribute.schema";
import { TaskTypeAttributeSchema } from "../../schemas/tasktypeattribute";
import { DeviceResolver } from "./device.resolver";
import { ResolverParams } from "./resolver.params";

export class SubTaskResolver {

    constructor(private resolvedDevice: ResolvedDevice, private deviceResolver: DeviceResolver) {}

    resolveSubTasks(params: ResolverParams, row: any): Promise<MaterialSubTask[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const preciseTasks: MaterialSubTask[] = this.deviceResolver.materialSubTasksFromDb.filter(s => s.projectId===params.projectId && s.materialId===this.resolvedDevice.id)
                const genericTasks: MaterialSubTask[] = this.deviceResolver.materialSubTasksFromDb.filter(s => s.projectId==='*' && s.materialId===this.resolvedDevice.id)
                // Make sure fieldwire has custom attributes available
                // Merge 2 collections together loading most precise first
                const tasks: MaterialSubTask[] = []
                preciseTasks.forEach((preciseItem) => {
                    tasks.push(preciseItem)
                })
                genericTasks.forEach((genericItem: MaterialSubTask) => {
                    const alreadyExistsTest = tasks.find(s => s.statusName===genericItem.statusName)
                    if (!alreadyExistsTest) {
                        tasks.push(genericItem)
                    }
                })

                console.log(`Confirmed material subtasks list:`)
                console.dir(tasks)
                return resolve(tasks)
            } catch (err) { 
                console.error(err)
                return reject(err)
            }
        })
    }

}