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
exports.FieldwireSDK = void 0;
const uuid_1 = require("uuid");
const device_resolver_1 = require("./tasks/resolvers/device.resolver");
const utils_1 = require("../../core/utils");
const sqldb_1 = require("./repository/sqldb");
const attribute_resolver_1 = require("./tasks/resolvers/attribute.resolver");
const address_resolver_1 = require("./tasks/resolvers/address.resolver");
const taskname_resolver_1 = require("./tasks/resolvers/taskname.resolver");
const position_resolver_1 = require("./tasks/resolvers/position.resolver");
const subtask_resolver_1 = require("./tasks/resolvers/subtask.resolver");
const apiKey = process.env.fieldwire;
const defaultMaterialLabor = 2;
class FieldwireSDK {
    constructor() {
        this._jwtToken = null;
        this._globalUrl = `https://client-api.super.fieldwire.com`;
        this._regionUrl = `https://client-api.us.fieldwire.com/api/v3/`;
        // #endregion
    }
    // #region Token
    _getJwtToken() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const response = yield fetch(`${this._globalUrl}/api_keys/jwt`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Accept': 'application/json'
                        },
                        body: `{"api_token": "${apiKey}"}`
                    });
                    if (response.status >= 300) {
                        return reject(new Error(`${response.status}: ${response.statusText}`));
                    }
                    const result = yield response.json();
                    console.dir(new Date());
                    console.dir(result);
                    this._jwtToken = result.access_token;
                    // Opt into keep-alive iterator to refresh token every x minutes
                    this.keepAliveToken();
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    keepAliveToken() {
        return __awaiter(this, void 0, void 0, function* () {
            // Each call to _getJwtToken will callback to this function to start another timer and so on
            // So we don't need an interval, we need a timeout
            setTimeout(() => {
                this._getJwtToken();
            }, 1000 * 60 * 55); // 40 minutes
        });
    }
    // #endregion
    // #region Fetch
    get(path, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!this._jwtToken) {
                        yield this._getJwtToken();
                    }
                    const url = `${this._regionUrl}${path}`;
                    const headers = this._buildHeaders(additionalHeaders);
                    const response = yield fetch(url, {
                        method: 'GET',
                        headers: headers
                    });
                    if (response.status >= 300) {
                        return reject(new Error(`${response.status}: ${response.statusText}`));
                    }
                    const result = yield response.json();
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    post(path, body, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!this._jwtToken) {
                        yield this._getJwtToken();
                    }
                    if (!body) {
                        body = {};
                    }
                    const url = `${this._regionUrl}${path}`;
                    const headers = this._buildHeaders(additionalHeaders);
                    console.log(`POST: ${url}`);
                    console.log(`HEADERS: ${JSON.stringify(headers)}`);
                    console.log(`BODY: ${JSON.stringify(body, null, 1)}`);
                    const response = yield fetch(url, {
                        method: 'POST',
                        body: JSON.stringify(body),
                        headers: headers
                    });
                    if (response.status >= 300) {
                        return reject(new Error(`${response.status}: ${response.statusText}`));
                    }
                    const contentType = response.headers.get('Content-Type') || '';
                    if (contentType.includes('application/json')) {
                        try {
                            const result = yield response.json();
                            return resolve(result);
                        }
                        catch (parseErr) {
                            const justParseText = response.bodyUsed ? 'OK' : yield response.text();
                            return resolve(justParseText);
                        }
                    }
                    const resultText = yield response.text();
                    return resolve(resultText);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    delete(path, additionalHeaders) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!this._jwtToken) {
                        yield this._getJwtToken();
                    }
                    const url = `${this._regionUrl}${path}`;
                    const headers = this._buildHeaders(additionalHeaders);
                    //console.log(`DELETE: ${url}`)
                    const response = yield fetch(url, {
                        method: 'DELETE',
                        headers: headers
                    });
                    //console.log(`DELETE: Status ${response.status}`)
                    if (response.status >= 300) {
                        return reject(new Error(`${response.status}: ${response.statusText}`));
                    }
                    return resolve({
                        status: response.status,
                        text: response.text
                    });
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    _buildHeaders(additionalHeaders) {
        let output = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Fieldwire-Version': '2024-11-01',
            'Authorization': `Bearer ${this._jwtToken}`
        };
        if (additionalHeaders) {
            output = Object.assign(output, additionalHeaders);
        }
        return output;
    }
    // #endregion
    // #region Accounts
    accountProjects() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`account/projects`);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    accountProjectStats() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`account/project_stats`);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    accountProjectUsers(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`account/projects/${projectId}/users`);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    // #endregion
    // #region Projects
    projectFloorplans(projectId, includeCurrentSheet) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const suffix = includeCurrentSheet ? `?with_current_sheet=true` : ``;
                    const result = yield this.get(`projects/${projectId}/floorplans${suffix}`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    project(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}`);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    folders(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/folders`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    sheets(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/sheets`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    statuses(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/statuses`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    locations(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/locations`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    teams(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/teams`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    createTeam(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                        throw new Error(`Attempted to modify project ${input.project_id} which is not an editable project`);
                    }
                    const safeHandle = input.handle && input.handle.length > 2 ?
                        input.handle.substring(0, 2) : input.handle;
                    const result = yield this.post(`projects/${input.project_id}/teams`, {
                        project_id: input.project_id,
                        handle: safeHandle,
                        name: input.name
                    }, {});
                    if (result.handle !== safeHandle) {
                        // handle was changed because was not unique in project
                        // update database record to match fieldwire handle
                        // TODO: UPDATE categories SET handle=result.handle WHERE categoryId='result.id'
                    }
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    tasks(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/tasks`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    taskattributes(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/task_attributes`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    taskcheckitems(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/task_check_items`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    attachments(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/attachments`, {
                        "Fieldwire-Filter": "active"
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    // #endregion
    // #region Tasks
    projectTasks(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/tasks`, {
                        'Fieldwire-Filter': 'active'
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    createTask(task) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(task.project_id) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${task.project_id}`);
                    }
                    const result = yield this.post(`projects/${task.project_id}/tasks`, task, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createTaskAttribute(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`);
                    }
                    const result = yield this.post(`projects/${input.project_id}/tasks/${input.task_id}/task_attributes`, input, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createTaskRelation(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`);
                    }
                    const result = yield this.post(`projects/${input.project_id}/task_relations`, input, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    taskEmail(params) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const requestBody = {
                        body: params.body,
                        cc_sender: params.cc_sender,
                        email: params.email,
                        kind: params.kind,
                        subject: params.subject
                    };
                    console.dir(requestBody);
                    const result = yield this.post(`projects/${params.projectId}/tasks/${params.taskId}/email`, requestBody);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    projectTaskTypeAttributes(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/task_type_attributes`, {
                        'Fieldwire-Filter': 'active'
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    createProjectTaskTypeAttribute(input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`);
                    }
                    const result = yield this.post(`projects/${input.project_id}/task_types/${input.task_type_id}/task_type_attributes`, {
                        project_id: input.project_id,
                        task_type_id: input.task_type_id,
                        name: input.name,
                        kind: input.kind,
                        ordinal: input.ordinal,
                        creator_user_id: input.creator_user_id,
                        last_editor_user_id: input.last_editor_user_id
                    }, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    deleteAllTasks(projectId, areYouSure) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (!areYouSure) {
                        throw new Error(`Fail safe here, you've disabled ability to delete tasks in the system`);
                    }
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const tasks = yield this.projectTasks(projectId);
                    if (!tasks || tasks.length <= 0) {
                        throw new Error(`No tasks found to delete in project ${projectId}`);
                    }
                    let deletedCount = 0;
                    for (let i = 0; i < tasks.length && i < 50; i++) { // 50 is the default task page size
                        const task = tasks[i];
                        const result = yield this.delete(`projects/${projectId}/tasks/${task.id}`, {});
                        deletedCount++;
                    }
                    return resolve({
                        message: `Successfully deleted ${deletedCount} records`
                    });
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    // #endregion
    // #region Task Importer
    importTasks(params, rows, app) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(params.projectId) < 0) {
                        throw new Error(`Invalid Project Id: ${params.projectId} is not an editable project id`);
                    }
                    const deviceResolver = new device_resolver_1.DeviceResolver(this, app);
                    yield deviceResolver.init(params);
                    const toBeCreatedRelationsDelay = [];
                    const fwFloorplans = yield this.projectFloorplans(params.projectId, true);
                    if (!fwFloorplans || fwFloorplans.length <= 0) {
                        throw new Error('Attempting to modify a project with no floorplans');
                    }
                    const fwFloorplan = fwFloorplans.find(s => s.id === params.floorplanId);
                    if (!fwFloorplan) {
                        throw new Error(`Cannot find record in project for floorplan id ${params.floorplanId}`);
                    }
                    let importedCount = 0;
                    const output = [];
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        const preview = {};
                        const rd = yield deviceResolver.resolveDevice(params, row);
                        if (!rd) {
                            console.log(`Unable to resolve device ${JSON.stringify(row)}`);
                            return;
                        }
                        // Resolve Team Id
                        if (!rd.fwTeamId) {
                            console.log(`Could not find category (team) id for device ${rd.name}`);
                        }
                        const addressResolver = new address_resolver_1.AddressResolver(rd, deviceResolver);
                        const address = addressResolver.resolveAddress(params, row);
                        const taskNameResolver = new taskname_resolver_1.TaskNameResolver(rd, deviceResolver);
                        const taskName = taskNameResolver.resolveTaskName(params, row, address);
                        const positionResolver = new position_resolver_1.PositionResolver(rd, deviceResolver);
                        const position = positionResolver.resolvePosition(params, row, fwFloorplan);
                        console.dir(position);
                        //const locationResolver: DeviceResolver = new DeviceResolver(this, app)
                        //const priorityResolver: DeviceResolver = new DeviceResolver(this, app)
                        // should have root task w/category, any sub tasks
                        //  and attributes for that device ready
                        // create root task, create task attributes
                        // create sub task, relate to root task
                        // Create Sub Tasks for this Device
                        // Need to know if there are sub tasks or not so we can calculate manpower
                        //  either at the master level or sub task rollup
                        const deviceSubTaskResolver = new subtask_resolver_1.SubTaskResolver(rd, deviceResolver);
                        const subTasks = yield deviceSubTaskResolver.resolveSubTasks(params, row);
                        const task = {
                            project_id: params.projectId,
                            creator_user_id: params.userId,
                            owner_user_id: params.userId,
                            floorplan_id: params.floorplanId,
                            team_id: rd.fwTeamId || '',
                            is_local: params.floorplanId ? true : false,
                            // Name Sample: 0020020161 - Power Monitor Shunt (CT1)
                            name: taskName || rd.name,
                            pos_x: position.posX,
                            pos_y: position.posY,
                            priority: 2,
                            location_id: undefined,
                            cost_value: rd.cost,
                            man_power_value: subTasks && subTasks.length > 0 ? undefined : rd.defaultLabor
                        };
                        let coreTaskId = (0, uuid_1.v4)();
                        if (!params.previewMode) {
                            const resultCreateCoreTask = yield this.createTask(task);
                            coreTaskId = resultCreateCoreTask.id;
                        }
                        else {
                            preview.taskId = coreTaskId;
                            preview.task = task;
                        }
                        rd.fwTaskId = coreTaskId;
                        // Ensure Task Custom Attributes Exist
                        const deviceAttrsResolver = new attribute_resolver_1.AttributeResolver(rd, deviceResolver);
                        const attrs = yield deviceAttrsResolver.resolveAttributes(params, row);
                        if (params.previewMode) {
                            preview.attrs = attrs;
                            preview.customAttrs = [];
                        }
                        // Create Task Attributes for TaskId
                        for (let i = 0; i < attrs.length; i++) {
                            const customTaskAttrFromDb = attrs[i];
                            const taskTypeAttributeLookup = deviceResolver.taskTypeAttributesFromFieldwire.find(s => s.name === customTaskAttrFromDb.name);
                            if (taskTypeAttributeLookup && taskTypeAttributeLookup.id) {
                                let taskAttribute = {
                                    project_id: params.projectId,
                                    task_id: coreTaskId,
                                    task_type_attribute_id: taskTypeAttributeLookup.id,
                                    creator_user_id: +params.userId,
                                    last_editor_user_id: +params.userId
                                };
                                // set either text_value or number_value depending on valueType and defaultValue from db
                                taskAttribute = deviceAttrsResolver.calculateAttributeValue(taskAttribute, customTaskAttrFromDb, params, row);
                                // Create the Task Attribute
                                if (!params.previewMode) {
                                    const taskAttrResult = yield this.createTaskAttribute(taskAttribute);
                                    console.log(`Created Task Attribute`);
                                    console.dir(taskAttrResult);
                                }
                                else {
                                    preview.customAttrs.push(taskAttribute);
                                }
                            }
                        }
                        // Create Sub Tasks
                        if (subTasks && subTasks.length > 0) {
                            if (params.previewMode) {
                                preview.subTasks = [];
                            }
                            for (let t = 0; t < subTasks.length; t++) {
                                const subTask = subTasks[t];
                                const subTaskCreateItem = {
                                    project_id: params.projectId,
                                    creator_user_id: params.userId,
                                    owner_user_id: params.userId,
                                    floorplan_id: undefined,
                                    team_id: rd.fwTeamId || '',
                                    is_local: false,
                                    name: subTask.statusName,
                                    pos_x: 0,
                                    pos_y: 0,
                                    priority: 2,
                                    location_id: undefined,
                                    cost_value: 0,
                                    man_power_value: subTask.laborHours
                                };
                                if (!params.previewMode) {
                                    const resultCreateSubTask = yield this.createTask(subTaskCreateItem);
                                    console.log(`Create Sub Task in Fieldwire`);
                                    console.dir(resultCreateSubTask);
                                    // Load Task Relationship
                                    toBeCreatedRelationsDelay.push({
                                        project_id: params.projectId,
                                        task_1_id: coreTaskId,
                                        task_2_id: resultCreateSubTask.id,
                                        creator_user_id: +params.userId
                                    });
                                    yield utils_1.Utils.sleep(500);
                                }
                                else {
                                    preview.subTasks.push(subTaskCreateItem);
                                }
                            } // end foreach sub task
                        } // end if sub tasks exist
                        if (params.previewMode) {
                            output.push(preview);
                        }
                        importedCount++;
                        yield utils_1.Utils.sleep(500);
                    } // foreach row
                    // We have imported all the rows, now process relations
                    console.log(`Row import complete. Creating Task Relationships`);
                    yield utils_1.Utils.sleep(5000);
                    if (!params.previewMode &&
                        toBeCreatedRelationsDelay &&
                        toBeCreatedRelationsDelay.length > 0) {
                        for (let r = 0; r < toBeCreatedRelationsDelay.length; r++) {
                            const relation = toBeCreatedRelationsDelay[r];
                            const coreTaskId = relation.task_1_id;
                            const subTaskId = relation.task_2_id;
                            console.log(`Create Task Relation`);
                            const body = {
                                project_id: relation.project_id,
                                creator_user_id: relation.creator_user_id,
                                task_1_id: relation.task_1_id,
                                task_2_id: relation.task_2_id
                            };
                            console.dir(body);
                            try {
                                const resultCreateTaskRelation = yield this.createTaskRelation(body);
                                console.log(`Created Task Relation`);
                                console.dir(resultCreateTaskRelation);
                                yield utils_1.Utils.sleep(1000);
                            }
                            catch (firstRetry) {
                                // Cause of one task being created before another, swap places
                                body.task_1_id = subTaskId;
                                body.task_2_id = coreTaskId;
                                const resultCreateTaskRelation = yield this.createTaskRelation(body);
                                console.log(`Created Task Relation`);
                                console.dir(resultCreateTaskRelation);
                                yield utils_1.Utils.sleep(1000);
                            }
                        }
                    }
                    return resolve({
                        message: `Imported ${importedCount} records`,
                        output
                    });
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    seedFromTestDevices(app) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(app);
                    const testDevices = yield sqldb.getTestDevices();
                    const categories = yield sqldb.getCategories();
                    const devices = yield sqldb.getDevices();
                    const vendors = yield sqldb.getVendors();
                    const materials = yield sqldb.getMaterials();
                    const deviceMaterials = yield sqldb.getDeviceMaterials();
                    const eddyProducts = yield sqldb.getEddyProducts();
                    const eddyPricelist = yield sqldb.getEddyPricelist();
                    if (!testDevices || testDevices.length <= 0) {
                        return resolve(false);
                    }
                    for (let i = 0; i < testDevices.length; i++) {
                        const testDevice = testDevices[i];
                        let testCategory = categories.find(s => s.handle === testDevice.handle);
                        if (!testCategory) {
                            // Let's create a new one and store the id
                            yield sqldb.createCategory({
                                categoryId: '', name: testDevice.category, shortName: testDevice.category, handle: testDevice.handle
                            });
                            testCategory = yield sqldb.getCategoryByHandle(testDevice.handle);
                        }
                        const testVendor = vendors.find(s => s.name === testDevice.vendorId);
                        if (testCategory && testVendor) {
                            // if this is edwards we have product details
                            const testPricelist = eddyPricelist.find(s => s.PartNumber === testDevice.partNumber);
                            const testProduct = eddyProducts.find(s => s.PartNumber === testDevice.partNumber);
                            // Look if we have the material
                            let testMaterial = materials.find(s => s.vendorId === testVendor.vendorId && s.partNumber === testDevice.partNumber);
                            if (!testMaterial) {
                                // We need to create the material record
                                const newMaterial = {
                                    materialId: '',
                                    name: testDevice.title,
                                    shortName: testDevice.title,
                                    vendorId: testVendor === null || testVendor === void 0 ? void 0 : testVendor.vendorId,
                                    categoryId: testCategory === null || testCategory === void 0 ? void 0 : testCategory.categoryId,
                                    partNumber: testDevice.partNumber,
                                    link: testProduct ? testProduct.ProductID : '',
                                    cost: testPricelist ? testPricelist.SalesPrice : (testProduct ? testProduct.SalesPrice : 0),
                                    defaultLabor: defaultMaterialLabor,
                                    slcAddress: testDevice.slcAddress,
                                    serialNumber: testDevice.serialNumber,
                                    strobeAddress: testDevice.strobeAddress,
                                    speakerAddress: testDevice.speakerAddress
                                };
                                yield sqldb.createMaterial(newMaterial);
                                testMaterial = yield sqldb.getMaterialByPartNumber(newMaterial.partNumber);
                            }
                            if (testMaterial) {
                                // Check if device already exists, if not create it
                                let testDeviceInDb = devices.find(s => s.partNumber === (testDevice === null || testDevice === void 0 ? void 0 : testDevice.partNumber) && s.vendorId === testVendor.vendorId);
                                if (!testDeviceInDb) {
                                    // We need to create the device record
                                    const newDevice = {
                                        deviceId: '',
                                        name: testDevice.title,
                                        shortName: testDevice.title,
                                        vendorId: testVendor === null || testVendor === void 0 ? void 0 : testVendor.vendorId,
                                        categoryId: testCategory === null || testCategory === void 0 ? void 0 : testCategory.categoryId,
                                        partNumber: testDevice.partNumber,
                                        link: testProduct ? testProduct.ProductID : '',
                                        cost: testPricelist ? testPricelist.SalesPrice : (testProduct ? testProduct.SalesPrice : 0),
                                        defaultLabor: defaultMaterialLabor,
                                        slcAddress: testDevice.slcAddress,
                                        serialNumber: testDevice.serialNumber,
                                        strobeAddress: testDevice.strobeAddress,
                                        speakerAddress: testDevice.speakerAddress
                                    };
                                    yield sqldb.createDevice(newDevice);
                                    testDeviceInDb = yield sqldb.getDeviceByPartNumber(newDevice.partNumber);
                                }
                                if (testDeviceInDb) {
                                    // We have Material and Device now
                                    // Make record into devicematerials
                                    let testDeviceMaterial = deviceMaterials.find(s => s.deviceId === (testDeviceInDb === null || testDeviceInDb === void 0 ? void 0 : testDeviceInDb.deviceId) && s.materialId === (testMaterial === null || testMaterial === void 0 ? void 0 : testMaterial.materialId));
                                    if (!testDeviceMaterial) {
                                        yield sqldb.createDeviceMaterialMap(testDeviceInDb === null || testDeviceInDb === void 0 ? void 0 : testDeviceInDb.deviceId, testMaterial === null || testMaterial === void 0 ? void 0 : testMaterial.materialId);
                                        testDeviceMaterial = yield sqldb.getDeviceMaterialByIds(testDeviceInDb === null || testDeviceInDb === void 0 ? void 0 : testDeviceInDb.deviceId, testMaterial === null || testMaterial === void 0 ? void 0 : testMaterial.materialId);
                                    }
                                }
                            }
                        }
                    }
                    return resolve(testDevices);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    // #endregion
    // #region AWS
    // aws_post_tokens
    aws_post_tokens() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.post(`aws_post_tokens`, {});
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
}
exports.FieldwireSDK = FieldwireSDK;
FieldwireSDK.editableProjects = [
    '85285faa-a9dd-4c75-9f37-8a98faf4d09a',
    'd0105078-da46-4a42-809f-b015b0cf87c8',
    '4b9a65d3-4ce4-4308-b93e-4513ff98fc72',
    '39bd5799-295a-41e4-aaea-839f78393de2', // Fieldwire Business Oklahoma Project
];
/* Hierarchy of

    Account
        Project
            User
            Floorplan
                Sheet
                Attachment
                Hyperlink
                Markup
                Task
                    TaskCheckItem
                    Bubble
                Form

                
                    FormSection
                    FormSectionRecord
                        FormSectionRecordInput
                        FormSectionRecordValue
                        FormSectionRecordInputValue
*/
