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
                    //console.log(`HEADERS: ${JSON.stringify(headers)}`)
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
                    const response = yield fetch(url, {
                        method: 'DELETE',
                        headers: headers
                    });
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
            'Fieldwire-Version': '2025-07-01',
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
                    const result = yield this.get(`account/projects`, { "Fieldwire-Filter": "active" });
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
    editableProjects() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                return resolve(FieldwireSDK.editableProjects);
            }));
        });
    }
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
    taskDetail(projectId, taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/tasks/${taskId}`);
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    projectFloorplanTasks(projectId, floorplanId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/tasks?filters[floorplan_id_eq]=${floorplanId}`, {
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
    taskFilterByStatus(projectId, statusId, startDate, endDate) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    //const startString = startDate.toISOString().split('T')[0]
                    //const endString = endDate.toISOString().split('T')[0]
                    const result = yield this.get(`projects/${projectId}/tasks/filter_by_status?end_date=${endDate}&start_date=${startDate}&status_id=${statusId}`, {
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
    projectTaskRelations(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/task_relations`, {
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
    taskRelatedTasks(projectId, taskId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/tasks/${taskId}/related`, {
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
    // #endregion
    // #region Task Importer
    importTasks(params, rows, app) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                try {
                    // #region Preconditions
                    if (!params.previewMode) {
                        throw new Error(`Attempted to call preview method without preview mode variable being set to true`);
                    }
                    if (FieldwireSDK.editableProjects.indexOf(params.projectId) < 0) {
                        throw new Error(`Invalid Project Id: ${params.projectId} is not an editable project id`);
                    }
                    const deviceResolver = new device_resolver_1.DeviceResolver(this, app);
                    yield deviceResolver.init(params);
                    const fwFloorplans = yield this.projectFloorplans(params.projectId, true);
                    if (!fwFloorplans || fwFloorplans.length <= 0) {
                        throw new Error('Attempting to modify a project with no floorplans');
                    }
                    const fwFloorplan = fwFloorplans.find(s => s.id === params.floorplanId);
                    if (!fwFloorplan) {
                        throw new Error(`Cannot find record in project for floorplan id ${params.floorplanId}`);
                    }
                    // #endregion
                    let importedCount = 0;
                    const output = [];
                    const unresolvedNames = [];
                    for (let i = 0; i < rows.length; i++) {
                        const row = rows[i];
                        const rd = yield deviceResolver.resolveDevice(params, row);
                        if (!rd) {
                            output.push({
                                id: (0, uuid_1.v4)(),
                                row,
                                resolvedDevice: undefined,
                                subTaskDefs: [],
                                attrs: [],
                                messages: [`${row['Visibility']}`]
                            });
                            if (unresolvedNames.indexOf(row['Visibility']) < 0) {
                                unresolvedNames.push(row['Visibility']);
                            }
                        }
                        else {
                            // Setup Initial Preview Object
                            const preview = {
                                id: (0, uuid_1.v4)(),
                                row,
                                resolvedDevice: rd,
                                subTaskDefs: [],
                                attrs: [],
                                messages: []
                            };
                            // Resolve Team Id
                            if (!rd.fwTeamId) {
                                console.log(`Could not find category (team) id for device ${rd.name}`);
                                preview.messages.push(`Could not find category (team) id for device ${rd.name}`);
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
                            if (subTasks) {
                                preview.subTaskDefs = [...subTasks];
                            }
                            // Ensure Task Custom Attributes Exist
                            const deviceAttrsResolver = new attribute_resolver_1.AttributeResolver(rd, deviceResolver);
                            const attrs = yield deviceAttrsResolver.resolveAttributes(params, row);
                            preview.attrs = [];
                            for (let a = 0; a < attrs.length; a++) {
                                const attr = attrs[a];
                                const value = deviceAttrsResolver.calculatePreviewAttrValue(attr, params, row);
                                attr.toBeValue = value;
                                preview.attrs.push(Object.assign({}, attr));
                            }
                            importedCount++;
                            output.push(preview);
                        } // end had resolved device
                    } // foreach row
                    // Get unique list of devices
                    const uniqueDeviceIds = [];
                    const uniqueDevices = [];
                    for (let x = 0; x < output.length; x++) {
                        const record = output[x];
                        if (record.resolvedDevice && uniqueDeviceIds.indexOf(record.resolvedDevice.id) < 0) {
                            uniqueDeviceIds.push(record.resolvedDevice.id);
                            uniqueDevices.push(Object.assign({}, record.resolvedDevice));
                        }
                        record.deviceId = (_a = record.resolvedDevice) === null || _a === void 0 ? void 0 : _a.id;
                        delete record.resolvedDevice;
                    }
                    return resolve({
                        message: `Preview would have imported ${importedCount} of ${rows.length} records`,
                        preview: output,
                        devices: uniqueDevices,
                        unresolvedNames
                    });
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    importTasksCommit(params, rows, app) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    // Preconditions
                    if (FieldwireSDK.editableProjects.indexOf(params.projectId) < 0) {
                        throw new Error(`Invalid Project Id: ${params.projectId} is not an editable project id`);
                    }
                    if (params.previewMode) {
                        throw new Error(`Cannot call import commit method with preview variable set to true`);
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
                            project_id: params.projectId, // From request
                            creator_user_id: params.userId, // From request
                            owner_user_id: params.userId, // From request
                            floorplan_id: params.floorplanId, // From request
                            team_id: rd.fwTeamId || '', // defeat ts complaint should never be null
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
                        rd.fwTaskId = coreTaskId;
                        // Ensure Task Custom Attributes Exist
                        const deviceAttrsResolver = new attribute_resolver_1.AttributeResolver(rd, deviceResolver);
                        const attrs = yield deviceAttrsResolver.resolveAttributes(params, row);
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
                            }
                        }
                        // Create Sub Tasks
                        if (subTasks && subTasks.length > 0) {
                            for (let t = 0; t < subTasks.length; t++) {
                                const subTask = subTasks[t];
                                const subTaskCreateItem = {
                                    project_id: params.projectId, // From request
                                    creator_user_id: params.userId, // From request
                                    owner_user_id: params.userId, // From request
                                    floorplan_id: undefined, // params.floorplanId, // From request
                                    team_id: rd.fwTeamId || '', // defeat ts complaint should never be null
                                    is_local: false, // Sub tasks are never shown on floorplans
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
                                    // Load Task Relationship
                                    toBeCreatedRelationsDelay.push({
                                        project_id: params.projectId,
                                        task_1_id: coreTaskId,
                                        task_2_id: resultCreateSubTask.id,
                                        creator_user_id: +params.userId
                                    });
                                    yield utils_1.Utils.sleep(500);
                                }
                            } // end foreach sub task
                        } // end if sub tasks exist
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
                            const body = {
                                project_id: relation.project_id,
                                creator_user_id: relation.creator_user_id,
                                task_1_id: relation.task_1_id,
                                task_2_id: relation.task_2_id
                            };
                            console.dir(body);
                            try {
                                const resultCreateTaskRelation = yield this.createTaskRelation(body);
                                yield utils_1.Utils.sleep(1000);
                            }
                            catch (firstRetry) {
                                // Cause of one task being created before another, swap places
                                body.task_1_id = subTaskId;
                                body.task_2_id = coreTaskId;
                                const resultCreateTaskRelation = yield this.createTaskRelation(body);
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
    // #region Forms
    projectFormTemplates(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_templates`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    dataTypeById(projectId, dataTypeId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/data_types/${dataTypeId}`, {
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
    projectFormFull(projectId, formId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/forms/${formId}/structure`, {
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
    projectDataTypes(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/data_types`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    projectFormTemplateStatuses(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_template_form_statuses`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    projectForms(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/forms`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    return resolve(result);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    formSectionsForForm(projectId, formId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_sections`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    //console.dir(result)
                    const output = result.filter(s => s.form_id === formId);
                    return resolve(output);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    formSectionRecordsForSection(projectId, sectionId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_section_records`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    const output = result.filter(s => s.form_section_id === sectionId);
                    return resolve(output);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    formSectionRecordValuesForSectionRecord(projectId, sectionRecordId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_section_record_values`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    const output = result.filter(s => s.form_section_record_id === sectionRecordId);
                    return resolve(output);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    formSectionRecordInputsForSectionRecord(projectId, sectionRecordId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const result = yield this.get(`projects/${projectId}/form_section_record_inputs`, {
                        'Fieldwire-Filter': 'active',
                        'Fieldwire-Per-Page': 1000
                    });
                    console.log(`Searching formSectionRecordInputsForSectionRecord ${result.length} records for form_section_record_id of ${sectionRecordId}`);
                    const output = result.filter(s => s.form_section_record_id === sectionRecordId);
                    console.log(`Search in formSectionRecordInputsForSectionRecord found ${output.length} records`);
                    return resolve(output);
                }
                catch (err) {
                    return reject(err);
                }
            }));
        });
    }
    createProjectForm(projectId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const result = yield this.post(`projects/${projectId}/forms`, input, {});
                    if (!result) {
                        throw new Error(`Invalid Form Creation Response`);
                    }
                    if (result instanceof Error) {
                        throw result;
                    }
                    const newFormId = result.id;
                    const generateResult = yield this.post(`projects/${projectId}/forms/${newFormId}/generate`, {}, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createFormSectionRecordValue(projectId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const result = yield this.post(`projects/${projectId}/form_section_record_values`, input, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createDataTypeValue(projectId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const result = yield this.post(`projects/${projectId}/data_type_values`, input, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    getFormSectionRecordInputValues(projectId) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    createFormSectionRecordInputValues(projectId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    // form_section_record_input_values
                    // input.value_id is the id of the createDataTypeValue POST
                    // input.value_type is DataTypeValue
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const result = yield this.post(`projects/${projectId}/form_section_record_input_values`, input, {});
                    return resolve(result);
                }
                catch (err) {
                    console.error(err);
                    return reject(err);
                }
            }));
        });
    }
    loadDailyReport(projectId, input) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                try {
                    const tableName = `Fieldwire Task Summary`;
                    if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                        throw new Error(`Attempted to edit a non-editable project: ${projectId}`);
                    }
                    const sections = yield this.formSectionsForForm(projectId, input.form_id);
                    if (!sections || sections.length <= 0) {
                        throw new Error(`Unable to retrieve form sections for form ${input.form_id}`);
                    }
                    const section = sections.find(s => s.name.toLowerCase() === tableName.toLowerCase());
                    if (!section) {
                        throw new Error(`Cannot determine Work Log section for form ${input.form_id}`);
                    }
                    const formSectionRecords = yield this.formSectionRecordsForSection(projectId, section.id);
                    if (!formSectionRecords || formSectionRecords.length <= 0) {
                        throw new Error(`Unable to retrieve form section records for form ${input.form_id} section ${section.id}`);
                    }
                    // #endregion
                    const sectionRecord = formSectionRecords.find(s => s.name.toLowerCase() === tableName.toLowerCase());
                    if (!sectionRecord) {
                        //console.dir(formSectionRecords)
                        throw new Error(`Cannot determine Work Log section record for form ${input.form_id}: Looking for ${tableName}`);
                    }
                    console.log(`sectionRecord`);
                    console.dir(sectionRecord);
                    const dataTypes = yield this.projectDataTypes(projectId);
                    // We are hardcoding new records each time
                    // TODO: Get form_section_record values and test each row to see if already on form
                    // For each work log entry - create section record input
                    for (let i = 0; i < input.worklog.length; i++) {
                        // Create Form Table Row
                        const worklogentry = input.worklog[i];
                        // Limit run for debugging to one row
                        if (worklogentry.Trade) { //}==='Cable') {
                            const formSectionRecordValueBody = {
                                creator_user_id: 1684559,
                                last_editor_user_id: 1684559,
                                form_section_record_id: sectionRecord.id,
                                ordinal: 1
                            };
                            const sectionRecordValueResult = yield this.createFormSectionRecordValue(projectId, formSectionRecordValueBody);
                            yield utils_1.Utils.sleep(1000);
                            // use sectionRecordValueResult.id as form_section_record_value_id
                            console.log(`createFormSectionRecordValue: Row`);
                            console.dir(formSectionRecordValueBody);
                            console.dir(sectionRecordValueResult);
                            // Columns
                            const sectionRecordInputs = yield this.formSectionRecordInputsForSectionRecord(projectId, sectionRecordValueResult.form_section_record_id);
                            //const sectionRecordInputs = await this.formSectionRecordInputsForSectionRecord(projectId, sectionRecord.id)
                            console.dir(`formSectionRecordInputsForSectionRecord: Columns`);
                            console.dir(sectionRecord.id);
                            console.dir(sectionRecordInputs);
                            yield utils_1.Utils.sleep(1000);
                            for (let x = 0; x < sectionRecordInputs.length; x++) {
                                const sectionRecordInput = sectionRecordInputs[x];
                                // use sectionRecordInput.form_section_record_input_id
                                console.log(`******************************************`);
                                console.log(`Looking for data type value ${sectionRecordInput.data_type_id}`);
                                const dataType = dataTypes.find(s => s.id === sectionRecordInput.data_type_id);
                                if (!dataType) {
                                    console.log(`Could not find data type ${sectionRecordInput.data_type_id}`);
                                    console.log(`Data Types Length: ${dataTypes.length}`);
                                    console.log(`******************************************`);
                                }
                                if (dataType) {
                                    let data = {
                                        creator_user_id: 1684559,
                                        last_editor_user_id: 1684559,
                                        data_type_id: dataType.id,
                                    };
                                    if (dataType.kind === 'string') {
                                        data.string_value = worklogentry.Trade;
                                    }
                                    if (dataType.kind === 'decimal') {
                                        data.decimal_value = worklogentry.Hours;
                                    }
                                    if (dataType.kind === 'bigint') {
                                        data.bigint_value = worklogentry.Quantity;
                                    }
                                    const dataTypeValueResult = yield this.createDataTypeValue(projectId, data);
                                    console.log(`createDataTypeValue: Data Value Placeholder`);
                                    console.dir(data);
                                    console.dir(dataTypeValueResult);
                                    const createFormSectionRecordInputValueBody = {
                                        form_section_record_input_id: sectionRecordInput.id, // this is fine
                                        form_section_record_value_id: sectionRecordValueResult.id || '', // cannot find this value?
                                        value_id: dataTypeValueResult.id || '',
                                        creator_user_id: 1684559,
                                        last_editor_user_id: 1684559,
                                        value_type: 'DataTypeValue'
                                    };
                                    // const createFormSectionRecordInputValueBody = {
                                    //     form_section_record_input_id: sectionRecordValueResult.id, // this is fine
                                    //     form_section_record_value_id: sectionRecordInput.id||'', // cannot find this value?
                                    //     value_id: dataTypeValueResult.id||'',
                                    //     creator_user_id: 1684559,
                                    //     last_editor_user_id: 1684559,
                                    //     value_type: 'DataTypeValue'
                                    // })
                                    const mapValueToColumnResult = yield this.createFormSectionRecordInputValues(projectId, createFormSectionRecordInputValueBody);
                                    console.log(`createFormSectionRecordInputValues: Link Data Value to Column`);
                                    console.dir(createFormSectionRecordInputValueBody);
                                    console.dir(mapValueToColumnResult);
                                    yield utils_1.Utils.sleep(200);
                                }
                            }
                        }
                    }
                    return resolve(input);
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
    '85285faa-a9dd-4c75-9f37-8a98faf4d09a', // Sample 01
    'd0105078-da46-4a42-809f-b015b0cf87c8', // Test
    '4b9a65d3-4ce4-4308-b93e-4513ff98fc72', // Block Setup 101
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
