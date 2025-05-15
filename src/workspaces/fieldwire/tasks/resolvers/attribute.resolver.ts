import { v4 } from 'uuid';

import { MaterialAttribute } from "../../repository/materialattribute";
import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { TaskAttributeSchema } from "../../schemas/taskattribute.schema";
import { TaskTypeAttributeSchema } from "../../schemas/tasktypeattribute";
import { DeviceResolver } from "./device.resolver";
import { ResolverParams } from "./resolver.params";

export class AttributeResolver {

    constructor(private resolvedDevice: ResolvedDevice, private deviceResolver: DeviceResolver) {}

    resolveAttributes(params: ResolverParams, row: any): Promise<MaterialAttribute[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const defaultTaskTypeId = this.deviceResolver.taskTypeAttributesFromFieldwire[0].task_type_id
                const preciseAttrs: MaterialAttribute[] = this.deviceResolver.materialAttributesFromDb.filter(s => s.projectId===params.projectId && s.materialId===this.resolvedDevice.id)
                const genericAttrs: MaterialAttribute[] = this.deviceResolver.materialAttributesFromDb.filter(s => s.projectId==='*' && s.materialId===this.resolvedDevice.id)
                // Make sure fieldwire has custom attributes available
                // Merge 2 collections together loading most precise first
                const attrs: MaterialAttribute[] = []
                preciseAttrs.forEach((preciseItem) => {
                    attrs.push(preciseItem)
                })
                genericAttrs.forEach((genericItem: MaterialAttribute) => {
                    const alreadyExistsTest = attrs.find(s => s.name===genericItem.name)
                    if (!alreadyExistsTest) {
                        attrs.push(genericItem)
                    }
                })

                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i]
                    let testAttrInFw: TaskTypeAttributeSchema|undefined = this.deviceResolver.taskTypeAttributesFromFieldwire.find(s => s.project_id===params.projectId && s.name===attr.name)
                    if (!testAttrInFw) {
                        // Create Custom Attribute in Fieldwire and assign id back into array in deviceResolver
                        console.log(`Need to create custom attribute "${attr.name}"`)
                        const toBeOrdinal = this.deviceResolver.taskTypeAttributesFromFieldwire.length + 1
                        const customTaskAttr: TaskTypeAttributeSchema = {
                            id: v4(), project_id: params.projectId, task_type_id: defaultTaskTypeId,
                            name: attr.name, 
                            kind: this.getKindOfAttribute(attr), // 21 is shorttext 22 is number
                            ordinal: toBeOrdinal,
                            visible: true, always_visibile: false,
                            creator_user_id: params.userId, last_editor_user_id: params.userId
                        }
                        if (!params.previewMode) {
                            testAttrInFw = await this.deviceResolver.fw.createProjectTaskTypeAttribute(customTaskAttr)
                            this.deviceResolver.taskTypeAttributesFromFieldwire.push(testAttrInFw)
                        } else {
                            this.deviceResolver.taskTypeAttributesFromFieldwire.push(customTaskAttr)
                        }
                    }
                }
                console.log(`Confirmed material attributes list:`)
                console.dir(attrs)
                return resolve(attrs)
            } catch (err) { 
                console.error(err)
                return reject(err)
            }
        })
    }

    public getKindOfAttribute(attr: MaterialAttribute): number {
        const safeString = attr && attr.valueType ? attr.valueType.toLowerCase():null
        switch(safeString) {
            case 'number':
            case 'int':
            case 'integer':
            case 'money':
            case 'currency':
            case 'decimal':
                return 22
            case 'text':
            case 'string':
            default:
                return 21
            
        }
    }

    public calculateAttributeValue(taskAttrToBeCreated: TaskAttributeSchema, 
        attr: MaterialAttribute, params: ResolverParams, row: any): TaskAttributeSchema {
        const defaultCalc = attr.defaultValue
        if (!defaultCalc) {
            return taskAttrToBeCreated
        }
        const valueType = this.getKindOfAttribute(attr)
        if (defaultCalc.startsWith("F'")) {
            const fieldName = defaultCalc.replace("F'","").replace("'", "")
            const testValue = row[fieldName]
            if (!testValue) {
                return taskAttrToBeCreated
            }
            if (valueType===22) {
                if (isNaN(testValue)) {
                    taskAttrToBeCreated.text_value = testValue
                    return taskAttrToBeCreated                            
                }
                taskAttrToBeCreated.number_value = +testValue
                return taskAttrToBeCreated
            }
            taskAttrToBeCreated.text_value = testValue
            return taskAttrToBeCreated
        }
        return taskAttrToBeCreated
    }
}