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
exports.AttributeResolver = void 0;
const uuid_1 = require("uuid");
class AttributeResolver {
    constructor(resolvedDevice, deviceResolver) {
        this.resolvedDevice = resolvedDevice;
        this.deviceResolver = deviceResolver;
    }
    resolveAttributes(params, row) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const defaultTaskTypeId = this.deviceResolver.taskTypeAttributesFromFieldwire[0].task_type_id;
                const preciseAttrs = this.deviceResolver.materialAttributesFromDb.filter(s => s.projectId === params.projectId && s.materialId === this.resolvedDevice.id);
                const genericAttrs = this.deviceResolver.materialAttributesFromDb.filter(s => s.projectId === '*' && s.materialId === this.resolvedDevice.id);
                // Make sure fieldwire has custom attributes available
                // Merge 2 collections together loading most precise first
                const attrs = [];
                preciseAttrs.forEach((preciseItem) => {
                    attrs.push(preciseItem);
                });
                genericAttrs.forEach((genericItem) => {
                    const alreadyExistsTest = attrs.find(s => s.name === genericItem.name);
                    if (!alreadyExistsTest) {
                        attrs.push(genericItem);
                    }
                });
                for (let i = 0; i < attrs.length; i++) {
                    const attr = attrs[i];
                    let testAttrInFw = this.deviceResolver.taskTypeAttributesFromFieldwire.find(s => s.project_id === params.projectId && s.name === attr.name);
                    if (!testAttrInFw) {
                        // Create Custom Attribute in Fieldwire and assign id back into array in deviceResolver
                        console.log(`Need to create custom attribute "${attr.name}"`);
                        const toBeOrdinal = this.deviceResolver.taskTypeAttributesFromFieldwire.length + 1;
                        const customTaskAttr = {
                            id: (0, uuid_1.v4)(), project_id: params.projectId, task_type_id: defaultTaskTypeId,
                            name: attr.name,
                            kind: this.getKindOfAttribute(attr),
                            ordinal: toBeOrdinal,
                            visible: true, always_visibile: false,
                            creator_user_id: params.userId, last_editor_user_id: params.userId
                        };
                        if (!params.previewMode) {
                            testAttrInFw = yield this.deviceResolver.fw.createProjectTaskTypeAttribute(customTaskAttr);
                            this.deviceResolver.taskTypeAttributesFromFieldwire.push(testAttrInFw);
                        }
                        else {
                            this.deviceResolver.taskTypeAttributesFromFieldwire.push(customTaskAttr);
                        }
                    }
                }
                console.log(`Confirmed material attributes list:`);
                console.dir(attrs);
                return resolve(attrs);
            }
            catch (err) {
                console.error(err);
                return reject(err);
            }
        }));
    }
    getKindOfAttribute(attr) {
        const safeString = attr && attr.valueType ? attr.valueType.toLowerCase() : null;
        switch (safeString) {
            case 'number':
            case 'int':
            case 'integer':
            case 'money':
            case 'currency':
            case 'decimal':
                return 22;
            case 'text':
            case 'string':
            default:
                return 21;
        }
    }
    calculateAttributeValue(taskAttrToBeCreated, attr, params, row) {
        const defaultCalc = attr.defaultValue;
        if (!defaultCalc) {
            return taskAttrToBeCreated;
        }
        const valueType = this.getKindOfAttribute(attr);
        if (defaultCalc.startsWith("F'")) {
            const fieldName = defaultCalc.replace("F'", "").replace("'", "");
            const testValue = row[fieldName];
            if (!testValue) {
                return taskAttrToBeCreated;
            }
            if (valueType === 22) {
                if (isNaN(testValue)) {
                    taskAttrToBeCreated.text_value = testValue;
                    return taskAttrToBeCreated;
                }
                taskAttrToBeCreated.number_value = +testValue;
                return taskAttrToBeCreated;
            }
            taskAttrToBeCreated.text_value = testValue;
            return taskAttrToBeCreated;
        }
        return taskAttrToBeCreated;
    }
}
exports.AttributeResolver = AttributeResolver;
