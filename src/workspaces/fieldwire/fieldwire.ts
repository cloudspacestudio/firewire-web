import * as express from 'express'
import { v4 } from 'uuid'
import { AccountProjectSchema } from "./schemas/account.project.schema";
import { AccountProjectStatSchema } from "./schemas/account.projectstat.schema";
import { AccountProjectUserSchema } from "./schemas/account.project.user.schema";
import { ProjectFloorplanSchema } from './schemas/project.floorplan.schema';
import { ProjectTaskSchema } from "./schemas/projecttask.schema";
import { TaskEmailParams } from "./tasks/taskemail.params";
import { CreateTaskParams } from "./tasks/project.task.params";
import { ResolverParams } from "./tasks/resolvers/resolver.params";
import { DeviceResolver } from './tasks/resolvers/device.resolver'
import { Utils } from '../../core/utils'

import { ImportItem } from './schemas/importitem.schemas'
import { Device } from './repository/device';
import { Material } from './repository/material';
import { Category } from './repository/category';
import { Vendor } from './repository/vendor';
import { DeviceMaterial } from './repository/devicematerial';
import { SqlDb } from './repository/sqldb';
import { TestDevice } from './repository/testdevice';
import { ResolvedDevice } from './schemas/resolvedDevice';
import { TeamSchema } from './schemas/team.schema';
import { TaskTypeAttributeSchema } from './schemas/tasktypeattribute';
import { AttributeResolver } from './tasks/resolvers/attribute.resolver';
import { MaterialAttribute } from './repository/materialattribute';
import { TaskAttributeSchema } from './schemas/taskattribute.schema';
import { AddressResolver } from './tasks/resolvers/address.resolver';
import { TaskNameResolver } from './tasks/resolvers/taskname.resolver';
import { PositionResolver } from './tasks/resolvers/position.resolver';
import { SubTaskResolver } from './tasks/resolvers/subtask.resolver';
import { MaterialSubTask } from './repository/materialsubtask';
import { TaskRelationSchema } from './schemas/taskrelation.schema';
import { FormTemplate } from './schemas/form.template';
import { FormTemplateStatus } from './schemas/form.templatestatus';
import { FieldwireForm } from './schemas/fieldwire.form';
import { CreateFormSchema } from './schemas/createform.schema';
import { DailyReportSchema } from './schemas/dailyreport.schema';
import { FormSection } from './schemas/form.section';
import { FormSectionRecord } from './schemas/form.sectionrecord';
import { FormSectionRecordValue } from './schemas/form.sectionrecordvalue';
import { FormSectionRecordInput } from './schemas/form.sectionrecordinput';
import { DataTypeSchema } from './schemas/datatype.schema';
import { CreateFormRecordValueSchema } from './schemas/createformrecordvalue.schema';
import { DataTypeValueSchema } from './schemas/datatype.value.schema';
import { TaskRelatedSchema } from './schemas/taskrelated.schema';
import { FormSectionRecordInputValueSchema } from './schemas/formsectionrecordinputvalue.schema';

const apiKey = process.env.fieldwire
const defaultMaterialLabor = 2

export class FieldwireSDK {
    private _jwtToken: any = null
    private _globalUrl = `https://client-api.super.fieldwire.com`
    private _regionUrl = `https://client-api.us.fieldwire.com/api/v3/`
    
    static editableProjects = [
        '85285faa-a9dd-4c75-9f37-8a98faf4d09a', // Sample 01
        'd0105078-da46-4a42-809f-b015b0cf87c8', // Test
        '4b9a65d3-4ce4-4308-b93e-4513ff98fc72', // Block Setup 101
        '39bd5799-295a-41e4-aaea-839f78393de2', // Fieldwire Business Oklahoma Project
    ]

    // #region Token
    private async _getJwtToken(): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const response = await fetch(`${this._globalUrl}/api_keys/jwt`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: `{"api_token": "${apiKey}"}`
                });

                if (response.status >= 300) {
                    return reject(new Error(`${response.status}: ${response.statusText}`))
                }

                const result = await response.json()
                console.dir(new Date())
                console.dir(result)
                this._jwtToken = result.access_token
                // Opt into keep-alive iterator to refresh token every x minutes
                this.keepAliveToken()
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }

    private async keepAliveToken() {
        // Each call to _getJwtToken will callback to this function to start another timer and so on
        // So we don't need an interval, we need a timeout
        setTimeout(() => {
            this._getJwtToken()
        }, 1000 * 60 * 55) // 40 minutes
    }
    // #endregion

    // #region Fetch
    private async get(path: string, additionalHeaders?: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this._jwtToken) {
                    await this._getJwtToken()
                }

                const url = `${this._regionUrl}${path}`
                const headers = this._buildHeaders(additionalHeaders)
                const response = await fetch(url, {
                    method: 'GET',
                    headers: headers
                })

                if (response.status >= 300) {
                    return reject(new Error(`${response.status}: ${response.statusText}`))
                }

                const result = await response.json()
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    private async post(path: string, body: any, additionalHeaders?: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this._jwtToken) {
                    await this._getJwtToken()
                }
                if (!body) {
                    body = {}
                }
                const url = `${this._regionUrl}${path}`
                const headers = this._buildHeaders(additionalHeaders)
                console.log(`POST: ${url}`)
                //console.log(`HEADERS: ${JSON.stringify(headers)}`)
                console.log(`BODY: ${JSON.stringify(body, null, 1)}`)
                const response = await fetch(url, {
                    method: 'POST',
                    body: JSON.stringify(body),
                    headers: headers
                })

                if (response.status >= 300) {
                    return reject(new Error(`${response.status}: ${response.statusText}`))
                }
                const contentType = response.headers.get('Content-Type') || ''
                if (contentType.includes('application/json')) {
                    try {
                        const result = await response.json()
                        return resolve(result)
                    } catch (parseErr) {
                        const justParseText = response.bodyUsed ? 'OK': await response.text()
                        return resolve(justParseText)
                    }
                }
                const resultText = await response.text()
                return resolve(resultText)
            } catch (err) {
                return reject(err)
            }
        });
    }
    private async delete(path: string, additionalHeaders?: any): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!this._jwtToken) {
                    await this._getJwtToken()
                }

                const url = `${this._regionUrl}${path}`
                const headers = this._buildHeaders(additionalHeaders)
                
                const response = await fetch(url, {
                    method: 'DELETE',
                    headers: headers
                })
                
                if (response.status >= 300) {
                    return reject(new Error(`${response.status}: ${response.statusText}`))
                }

                return resolve({
                    status: response.status,
                    text: response.text
                })
            } catch (err) {
                return reject(err)
            }
        });
    }
    private _buildHeaders(additionalHeaders?: any) {
        let output = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Fieldwire-Version': '2025-07-01',
            'Authorization': `Bearer ${this._jwtToken}`
        }
        if (additionalHeaders) {
            output = Object.assign(output, additionalHeaders)
        }
        return output
    }
    // #endregion

    // #region Accounts
    public async accountProjects(): Promise<AccountProjectSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`account/projects`, {"Fieldwire-Filter": "active"})
                const output: AccountProjectSchema[] = []
                for(let i = 0; i < result.length; i++) {
                    const record = result[i]
                    if (FieldwireSDK.editableProjects.indexOf(record.id)>=0) {
                        output.push(record)
                    }
                }
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async accountProjectStats(): Promise<AccountProjectStatSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`account/project_stats`)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async accountProjectUsers(projectId: string): Promise<AccountProjectUserSchema> {
        return new Promise(async(resolve, reject) => {
            try {
                const result = await this.get(`account/projects/${projectId}/users`)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        })
    }
    // #endregion

    // #region Projects
    public async editableProjects(): Promise<string[]> {
        return new Promise(async(resolve, reject) => {
            return resolve(FieldwireSDK.editableProjects)
        })
    }
    public async projectFloorplans(projectId: string, includeCurrentSheet: boolean): Promise<ProjectFloorplanSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const suffix = includeCurrentSheet ? `?with_current_sheet=true`:``
                const result = await this.get(`projects/${projectId}/floorplans${suffix}`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async project(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}`)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async folders(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/folders`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async sheets(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/sheets`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async statuses(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/statuses`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async locations(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/locations`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async teams(projectId: string): Promise<TeamSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/teams`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async createTeam(input: TeamSchema): Promise<TeamSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(input.project_id) <0) {
                    throw new Error(`Attempted to modify project ${input.project_id} which is not an editable project`)
                }
                const safeHandle = input.handle && input.handle.length > 2 ?
                    input.handle.substring(0, 2):input.handle
                const result = await this.post(`projects/${input.project_id}/teams`, {
                    project_id: input.project_id,
                    handle: safeHandle,
                    name: input.name
                }, {})
                if (result.handle!==safeHandle) {
                    // handle was changed because was not unique in project
                    // update database record to match fieldwire handle
                    // TODO: UPDATE categories SET handle=result.handle WHERE categoryId='result.id'
                }
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async tasks(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/tasks`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async taskattributes(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/task_attributes`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async taskcheckitems(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/task_check_items`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async attachments(projectId: string): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/attachments`, {
                    "Fieldwire-Filter": "active"
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    
    // #endregion

    // #region Tasks
    public async projectTasks(projectId: string): Promise<ProjectTaskSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/tasks`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async taskDetail(projectId: string, taskId: string): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/tasks/${taskId}`)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectFloorplanTasks(projectId: string, floorplanId: string): Promise<ProjectTaskSchema[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/tasks?filters[floorplan_id_eq]=${floorplanId}`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        })
    }
    public async createTask(task: CreateTaskParams): Promise<AccountProjectSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(task.project_id) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${task.project_id}`)
                }
                const result = await this.post(`projects/${task.project_id}/tasks`, task, {
                })
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async createTaskAttribute(input: TaskAttributeSchema): Promise<TaskAttributeSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`)
                }
                const result = await this.post(`projects/${input.project_id}/tasks/${input.task_id}/task_attributes`, input, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async createTaskRelation(input: TaskRelationSchema): Promise<TaskRelationSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`)
                }
                const result = await this.post(`projects/${input.project_id}/task_relations`, input, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });        
    }
    public async taskEmail(params: TaskEmailParams): Promise<ProjectTaskSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const requestBody = {
                    body: params.body,
                    cc_sender: params.cc_sender,
                    email: params.email,
                    kind: params.kind,
                    subject: params.subject
                }
                console.dir(requestBody)
                const result = await this.post(`projects/${params.projectId}/tasks/${params.taskId}/email`, requestBody)
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectTaskTypeAttributes(projectId: string): Promise<TaskTypeAttributeSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/task_type_attributes`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async createProjectTaskTypeAttribute(input: TaskTypeAttributeSchema): Promise<TaskTypeAttributeSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(input.project_id) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${input.project_id}`)
                }
                const result = await this.post(`projects/${input.project_id}/task_types/${input.task_type_id}/task_type_attributes`, {
                    project_id: input.project_id,
                    task_type_id: input.task_type_id,
                    name: input.name,
                    kind: input.kind,
                    ordinal: input.ordinal,
                    creator_user_id: input.creator_user_id,
                    last_editor_user_id: input.last_editor_user_id
                }, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async deleteAllTasks(projectId: string, areYouSure: boolean): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                if (!areYouSure) {
                    throw new Error(`Fail safe here, you've disabled ability to delete tasks in the system`)
                }
                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const tasks = await this.projectTasks(projectId)
                if (!tasks || tasks.length <= 0) {
                    throw new Error(`No tasks found to delete in project ${projectId}`)
                }
                let deletedCount = 0
                for (let i = 0; i < tasks.length&&i < 50; i++) { // 50 is the default task page size
                    const task = tasks[i]
                    const result = await this.delete(`projects/${projectId}/tasks/${task.id}`, {
                    })
                    deletedCount++
                }
                return resolve({
                    message: `Successfully deleted ${deletedCount} records`
                })
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async taskFilterByStatus(projectId: string, statusId: string, startDate: string, endDate: string): Promise<ProjectTaskSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                //const startString = startDate.toISOString().split('T')[0]
                //const endString = endDate.toISOString().split('T')[0]
                const result = await this.get(`projects/${projectId}/tasks/filter_by_status?end_date=${endDate}&start_date=${startDate}&status_id=${statusId}`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectTaskRelations(projectId: string): Promise<TaskTypeAttributeSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/task_relations`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async taskRelatedTasks(projectId: string, taskId: string): Promise<TaskRelatedSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/tasks/${taskId}/related`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }

    
    // #endregion

    // #region Task Importer
    public async importTasks(params: ResolverParams, rows: any[], app: express.Application) {
        return new Promise(async(resolve, reject) => {
            try { 
                // #region Preconditions
                if (!params.previewMode) {
                    throw new Error(`Attempted to call preview method without preview mode variable being set to true`)
                }
                if (FieldwireSDK.editableProjects.indexOf(params.projectId) < 0) {
                    throw new Error(`Invalid Project Id: ${params.projectId} is not an editable project id`)
                }

                const deviceResolver: DeviceResolver = new DeviceResolver(this, app)
                await deviceResolver.init(params)

                const fwFloorplans = await this.projectFloorplans(params.projectId, true)
                if (!fwFloorplans || fwFloorplans.length <= 0) {
                    throw new Error('Attempting to modify a project with no floorplans')
                }
                const fwFloorplan = fwFloorplans.find(s => s.id===params.floorplanId)
                if (!fwFloorplan) {
                    throw new Error(`Cannot find record in project for floorplan id ${params.floorplanId}`)
                }
                // #endregion

                let importedCount = 0
                const output: PreviewResponse[] = []
                const unresolvedNames: string[] = []
                for(let i = 0; i < rows.length; i++) {
                    const row = rows[i]
                    
                    const rd: ResolvedDevice | null = await deviceResolver.resolveDevice(params, row)
                    if (!rd) {
                        output.push({
                            id: v4(),
                            row, 
                            resolvedDevice: undefined, 
                            subTaskDefs: [],
                            attrs: [],
                            messages: [`${row['Visibility']}`]
                        })
                        if(unresolvedNames.indexOf(row['Visibility'])<0) {
                            unresolvedNames.push(row['Visibility'])
                        }
                    } else {
                        // Setup Initial Preview Object
                        const preview: PreviewResponse = {
                            id: v4(),
                            row, 
                            resolvedDevice: rd, 
                            subTaskDefs: [],
                            attrs: [],
                            messages: []
                        }
                        // Resolve Team Id
                        if (!rd.fwTeamId) {
                            console.log(`Could not find category (team) id for device ${rd.name}`)
                            preview.messages.push(`Could not find category (team) id for device ${rd.name}`)
                        }
                        const addressResolver: AddressResolver = new AddressResolver(rd, deviceResolver)
                        const address = addressResolver.resolveAddress(params, row)

                        const taskNameResolver: TaskNameResolver = new TaskNameResolver(rd, deviceResolver)
                        const taskName = taskNameResolver.resolveTaskName(params, row, address)
        
                        const positionResolver: PositionResolver = new PositionResolver(rd, deviceResolver)
                        const position = positionResolver.resolvePosition(params, row, fwFloorplan)
                        console.dir(position)

                        //const locationResolver: DeviceResolver = new DeviceResolver(this, app)
                        //const priorityResolver: DeviceResolver = new DeviceResolver(this, app)
        
                        // should have root task w/category, any sub tasks
                        //  and attributes for that device ready
                        // create root task, create task attributes
                        // create sub task, relate to root task
                        // Create Sub Tasks for this Device
                        // Need to know if there are sub tasks or not so we can calculate manpower
                        //  either at the master level or sub task rollup
                        const deviceSubTaskResolver: SubTaskResolver = new SubTaskResolver(rd, deviceResolver)
                        const subTasks = await deviceSubTaskResolver.resolveSubTasks(params, row)
                        if (subTasks) {
                            preview.subTaskDefs = [...subTasks]
                        }
                        // Ensure Task Custom Attributes Exist
                        const deviceAttrsResolver: AttributeResolver = new AttributeResolver(rd, deviceResolver)
                        const attrs = await deviceAttrsResolver.resolveAttributes(params, row)
                        preview.attrs = []
                        for(let a = 0; a < attrs.length; a++) {
                            const attr = attrs[a]
                            const value = deviceAttrsResolver.calculatePreviewAttrValue(attr, params, row)
                            attr.toBeValue = value
                            preview.attrs.push(Object.assign({}, attr))
                        }
                        importedCount++
                        output.push(preview)
                    } // end had resolved device
                } // foreach row

                // Get unique list of devices
                const uniqueDeviceIds: string[] = []
                const uniqueDevices: ResolvedDevice[] = []
                for (let x = 0; x < output.length; x++) {
                    const record: PreviewResponse = output[x]
                    if (record.resolvedDevice && uniqueDeviceIds.indexOf(record.resolvedDevice.id)<0) {
                        uniqueDeviceIds.push(record.resolvedDevice.id)
                        uniqueDevices.push(Object.assign({}, record.resolvedDevice))
                    }
                    record.deviceId = record.resolvedDevice?.id
                    delete record.resolvedDevice
                }
                return resolve({
                    message: `Preview would have imported ${importedCount} of ${rows.length} records`,
                    preview: output,
                    devices: uniqueDevices,
                    unresolvedNames
                })
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async importTasksCommit(params: ResolverParams, rows: any[], app: express.Application) {
        return new Promise(async(resolve, reject) => {
            try {
                // Preconditions
                if (FieldwireSDK.editableProjects.indexOf(params.projectId) < 0) {
                    throw new Error(`Invalid Project Id: ${params.projectId} is not an editable project id`)
                }
                if (params.previewMode) {
                    throw new Error(`Cannot call import commit method with preview variable set to true`)
                }

                const deviceResolver: DeviceResolver = new DeviceResolver(this, app)
                await deviceResolver.init(params)
                const toBeCreatedRelationsDelay: TaskRelationSchema[] = []

                const fwFloorplans = await this.projectFloorplans(params.projectId, true)
                if (!fwFloorplans || fwFloorplans.length <= 0) {
                    throw new Error('Attempting to modify a project with no floorplans')
                }
                const fwFloorplan = fwFloorplans.find(s => s.id===params.floorplanId)
                if (!fwFloorplan) {
                    throw new Error(`Cannot find record in project for floorplan id ${params.floorplanId}`)
                }

                let importedCount = 0
                const output: any[] = []
                for(let i = 0; i < rows.length; i++) {
                    const row = rows[i]
                    
                    const rd: ResolvedDevice | null = await deviceResolver.resolveDevice(params, row)
                    if (!rd) {
                        console.log(`Unable to resolve device ${JSON.stringify(row)}`)
                        return
                    }
                    // Resolve Team Id
                    if (!rd.fwTeamId) {
                        console.log(`Could not find category (team) id for device ${rd.name}`)
                    }
                    
                    const addressResolver: AddressResolver = new AddressResolver(rd, deviceResolver)
                    const address = addressResolver.resolveAddress(params, row)

                    const taskNameResolver: TaskNameResolver = new TaskNameResolver(rd, deviceResolver)
                    const taskName = taskNameResolver.resolveTaskName(params, row, address)
    
                    const positionResolver: PositionResolver = new PositionResolver(rd, deviceResolver)
                    const position = positionResolver.resolvePosition(params, row, fwFloorplan)
                    console.dir(position)
                    //const locationResolver: DeviceResolver = new DeviceResolver(this, app)
                    //const priorityResolver: DeviceResolver = new DeviceResolver(this, app)
    
                    // should have root task w/category, any sub tasks
                    //  and attributes for that device ready
                    // create root task, create task attributes
                    // create sub task, relate to root task
                    // Create Sub Tasks for this Device
                    // Need to know if there are sub tasks or not so we can calculate manpower
                    //  either at the master level or sub task rollup
                    const deviceSubTaskResolver: SubTaskResolver = new SubTaskResolver(rd, deviceResolver)
                    const subTasks = await deviceSubTaskResolver.resolveSubTasks(params, row)

                    const task: CreateTaskParams = {
                        project_id: params.projectId, // From request
                        creator_user_id: params.userId, // From request
                        owner_user_id: params.userId, // From request
                        floorplan_id: params.floorplanId, // From request
                        team_id: rd.fwTeamId||'', // defeat ts complaint should never be null
                        is_local: params.floorplanId?true:false,

                        // Name Sample: 0020020161 - Power Monitor Shunt (CT1)
                        name: taskName||rd.name,
                        pos_x: position.posX,
                        pos_y: position.posY,
                        priority: 2,
                        location_id: undefined,
                        cost_value: rd.cost,
                        man_power_value: subTasks && subTasks.length > 0 ? undefined : rd.defaultLabor
                    }
                    let coreTaskId = v4()
                    if (!params.previewMode) {
                        const resultCreateCoreTask = await this.createTask(task)
                        coreTaskId = resultCreateCoreTask.id
                    }
                    rd.fwTaskId = coreTaskId

                    // Ensure Task Custom Attributes Exist
                    const deviceAttrsResolver: AttributeResolver = new AttributeResolver(rd, deviceResolver)
                    const attrs = await deviceAttrsResolver.resolveAttributes(params, row)
                    // Create Task Attributes for TaskId
                    for (let i = 0; i < attrs.length; i++) {
                        const customTaskAttrFromDb: MaterialAttribute = attrs[i]
                        const taskTypeAttributeLookup = deviceResolver.taskTypeAttributesFromFieldwire.find(s => s.name===customTaskAttrFromDb.name)
                        if (taskTypeAttributeLookup && taskTypeAttributeLookup.id) {
                            let taskAttribute: TaskAttributeSchema = {
                                project_id: params.projectId,
                                task_id: coreTaskId,
                                task_type_attribute_id: taskTypeAttributeLookup.id,
                                creator_user_id: +params.userId,
                                last_editor_user_id: +params.userId
                            }
                            // set either text_value or number_value depending on valueType and defaultValue from db
                            taskAttribute = deviceAttrsResolver.calculateAttributeValue(taskAttribute, customTaskAttrFromDb, params, row)
                            // Create the Task Attribute
                            if (!params.previewMode) {
                                const taskAttrResult = await this.createTaskAttribute(taskAttribute)
                                console.log(`Created Task Attribute`)
                                console.dir(taskAttrResult)    
                            }
                        }
                    }

                    // Create Sub Tasks
                    if (subTasks && subTasks.length > 0) {
                        for (let t = 0; t < subTasks.length; t++) {
                            const subTask: MaterialSubTask = subTasks[t]
                            const subTaskCreateItem: CreateTaskParams = {
                                project_id: params.projectId, // From request
                                creator_user_id: params.userId, // From request
                                owner_user_id: params.userId, // From request
                                floorplan_id: undefined, // params.floorplanId, // From request
                                team_id: rd.fwTeamId||'', // defeat ts complaint should never be null
                                is_local: false, // Sub tasks are never shown on floorplans
        
                                name: subTask.statusName,
                                pos_x: 0,
                                pos_y: 0,
                                priority: 2,
                                location_id: undefined,
                                cost_value: 0,
                                man_power_value: subTask.laborHours
                            }
                            if (!params.previewMode) {
                                const resultCreateSubTask = await this.createTask(subTaskCreateItem)
                                // Load Task Relationship
                                toBeCreatedRelationsDelay.push({
                                    project_id: params.projectId,
                                    task_1_id: coreTaskId,
                                    task_2_id: resultCreateSubTask.id,
                                    creator_user_id: +params.userId
                                })
                                await Utils.sleep(500)
                            }
                        } // end foreach sub task
                    } // end if sub tasks exist
                    importedCount++
                    await Utils.sleep(500)
                } // foreach row

                // We have imported all the rows, now process relations
                console.log(`Row import complete. Creating Task Relationships`)
                await Utils.sleep(5000)
                if (!params.previewMode && 
                    toBeCreatedRelationsDelay && 
                    toBeCreatedRelationsDelay.length > 0) {
                    for (let r = 0; r < toBeCreatedRelationsDelay.length; r++) {
                        const relation = toBeCreatedRelationsDelay[r]
                        const coreTaskId = relation.task_1_id
                        const subTaskId = relation.task_2_id
                        const body = {
                            project_id: relation.project_id,
                            creator_user_id: relation.creator_user_id,
                            task_1_id: relation.task_1_id,
                            task_2_id: relation.task_2_id
                        }
                        console.dir(body)
                        try {
                            const resultCreateTaskRelation = await this.createTaskRelation(body)
                            await Utils.sleep(1000)    
                        } catch (firstRetry) {
                            // Cause of one task being created before another, swap places
                            body.task_1_id = subTaskId
                            body.task_2_id = coreTaskId
                            const resultCreateTaskRelation = await this.createTaskRelation(body)
                            await Utils.sleep(1000)    
                        }
                    }
                }

                return resolve({
                    message: `Imported ${importedCount} records`,
                    output
                })
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }

    public async seedFromTestDevices(app: express.Application) {
        return new Promise(async(resolve, reject) => {
            try {
                const sqldb: SqlDb = new SqlDb(app)
                const testDevices: TestDevice[] = await sqldb.getTestDevices()
                const categories = await sqldb.getCategories()
                const devices = await sqldb.getDevices()
                const vendors = await sqldb.getVendors()
                const materials = await sqldb.getMaterials()
                const deviceMaterials = await sqldb.getDeviceMaterials()
                const eddyProducts = await sqldb.getEddyProducts()
                const eddyPricelist = await sqldb.getEddyPricelist()
                if (!testDevices || testDevices.length <= 0) {
                    return resolve(false)
                }
                for (let i = 0; i < testDevices.length; i++) {
                    const testDevice: TestDevice = testDevices[i]
                    let testCategory: Category|null|undefined = categories.find(s => s.handle===testDevice.handle)
                    if (!testCategory) {
                        // Let's create a new one and store the id
                        await sqldb.createCategory({
                            categoryId: '', name: testDevice.category, shortName: testDevice.category, handle: testDevice.handle
                        })
                        testCategory = await sqldb.getCategoryByHandle(testDevice.handle)
                    }
                    const testVendor: Vendor|undefined = vendors.find(s => s.name===testDevice.vendorId)
                    if (testCategory && testVendor) {
                        // if this is edwards we have product details
                        const testPricelist = eddyPricelist.find(s => s.PartNumber===testDevice.partNumber)
                        const testProduct = eddyProducts.find(s => s.PartNumber===testDevice.partNumber)
                        // Look if we have the material
                        let testMaterial: Material | null | undefined = materials.find(s => s.vendorId===testVendor.vendorId && s.partNumber===testDevice.partNumber)
                        if (!testMaterial) {
                            // We need to create the material record
                            const newMaterial: Material = {
                                materialId: '',
                                name: testDevice.title,
                                shortName: testDevice.title,
                                vendorId: testVendor?.vendorId,
                                categoryId: testCategory?.categoryId,
                                partNumber: testDevice.partNumber,
                                link: testProduct?testProduct.ProductID:'',
                                cost: testPricelist?testPricelist.SalesPrice:(testProduct?testProduct.SalesPrice:0),
                                defaultLabor: defaultMaterialLabor,
                                slcAddress: testDevice.slcAddress,
                                serialNumber: testDevice.serialNumber,
                                strobeAddress: testDevice.strobeAddress,
                                speakerAddress: testDevice.speakerAddress
                            }
                            await sqldb.createMaterial(newMaterial)
                            testMaterial = await sqldb.getMaterialByPartNumber(newMaterial.partNumber)
                        }
                        if (testMaterial) {
                            // Check if device already exists, if not create it
                            let testDeviceInDb: Device | null | undefined = devices.find(s => s.partNumber===testDevice?.partNumber && s.vendorId===testVendor.vendorId)
                            if (!testDeviceInDb) {
                                // We need to create the device record
                                const newDevice: Device = {
                                    deviceId: '',
                                    name: testDevice.title,
                                    shortName: testDevice.title,
                                    vendorId: testVendor?.vendorId,
                                    categoryId: testCategory?.categoryId,
                                    partNumber: testDevice.partNumber,
                                    link: testProduct?testProduct.ProductID:'',
                                    cost: testPricelist?testPricelist.SalesPrice:(testProduct?testProduct.SalesPrice:0),
                                    defaultLabor: defaultMaterialLabor,
                                    slcAddress: testDevice.slcAddress,
                                    serialNumber: testDevice.serialNumber,
                                    strobeAddress: testDevice.strobeAddress,
                                    speakerAddress: testDevice.speakerAddress
                                }
                                await sqldb.createDevice(newDevice)
                                testDeviceInDb = await sqldb.getDeviceByPartNumber(newDevice.partNumber)
                            }
                            if (testDeviceInDb) {
                                // We have Material and Device now
                                // Make record into devicematerials
                                let testDeviceMaterial: DeviceMaterial|undefined|null = deviceMaterials.find(s => s.deviceId===testDeviceInDb?.deviceId&&s.materialId===testMaterial?.materialId)
                                if (!testDeviceMaterial) {
                                    await sqldb.createDeviceMaterialMap(testDeviceInDb?.deviceId, testMaterial?.materialId)
                                    testDeviceMaterial = await sqldb.getDeviceMaterialByIds(testDeviceInDb?.deviceId, testMaterial?.materialId)
                                }
                            }
                        }
                    }
                }
                return resolve(testDevices)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    // #endregion

    // #region Forms
    public async projectFormTemplates(projectId: string): Promise<FormTemplate[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/form_templates`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async dataTypeById(projectId: string, dataTypeId: string): Promise<DataTypeSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                const result: DataTypeSchema = await this.get(`projects/${projectId}/data_types/${dataTypeId}`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectFormFull(projectId: string, formId: string): Promise<FormTemplate[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/forms/${formId}/structure`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectDataTypes(projectId: string): Promise<DataTypeSchema[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/data_types`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectFormTemplateStatuses(projectId: string): Promise<FormTemplateStatus[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/form_template_form_statuses`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async projectForms(projectId: string): Promise<FieldwireForm[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.get(`projects/${projectId}/forms`, {
                    'Fieldwire-Filter': 'active'
                })
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async formSectionsForForm(projectId: string, formId: string): Promise<FormSection[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result: FormSection[] = await this.get(`projects/${projectId}/form_sections`, {
                    'Fieldwire-Filter': 'active'
                })
                //console.dir(result)
                const output = result.filter(s => s.form_id===formId)
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async formSectionRecordsForSection(projectId: string, sectionId: string): Promise<FormSectionRecord[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result: FormSectionRecord[] = await this.get(`projects/${projectId}/form_section_records`, {
                    'Fieldwire-Filter': 'active'
                })
                const output = result.filter(s => s.form_section_id===sectionId)
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async formSectionRecordValuesForSectionRecord(projectId: string, sectionRecordId: string): Promise<FormSectionRecordValue[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result: FormSectionRecordValue[] = await this.get(`projects/${projectId}/form_section_record_values`, {
                    'Fieldwire-Filter': 'active'
                })
                const output = result.filter(s => s.form_section_record_id===sectionRecordId)
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        });
    }
    public async formSectionRecordInputsForSectionRecord(projectId: string, sectionRecordId: string): Promise<FormSectionRecordInput[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result: FormSectionRecordInput[] = await this.get(`projects/${projectId}/form_section_record_inputs`, {
                    'Fieldwire-Filter': 'active',
                    'Fieldwire-Per-Page': 1000
                })
                console.log(`Searching formSectionRecordInputsForSectionRecord ${result.length} records for form_section_record_id of ${sectionRecordId}`)
                const output = result.filter(s => s.form_section_record_id===sectionRecordId)
                console.log(`Search in formSectionRecordInputsForSectionRecord found ${output.length} records`)
                return resolve(output)
            } catch (err) {
                return reject(err)
            }
        });
    }


    public async createProjectForm(projectId: string, input: CreateFormSchema): Promise<FieldwireForm> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const result = await this.post(`projects/${projectId}/forms`, input, {})
                if (!result) {
                    throw new Error(`Invalid Form Creation Response`)
                }
                if (result instanceof Error) {
                    throw result
                }
                const newFormId = result.id
                const generateResult = await this.post(`projects/${projectId}/forms/${newFormId}/generate`, {}, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async createFormSectionRecordValue(projectId: string, input: CreateFormRecordValueSchema): Promise<FormSectionRecordValue> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const result = await this.post(`projects/${projectId}/form_section_record_values`, input, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async createDataTypeValue(projectId: string, input: DataTypeValueSchema): Promise<DataTypeValueSchema> {
        return new Promise(async (resolve, reject) => {
            try {
                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const result = await this.post(`projects/${projectId}/data_type_values`, input, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }
    public async getFormSectionRecordInputValues(projectId: string): Promise<FormSectionRecordInputValueSchema> {
        return new Promise(async(resolve, reject) => {
            try {

            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    public async createFormSectionRecordInputValues(projectId: string, input: FormSectionRecordInputValueSchema): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                // form_section_record_input_values
                // input.value_id is the id of the createDataTypeValue POST
                // input.value_type is DataTypeValue

                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const result = await this.post(`projects/${projectId}/form_section_record_input_values`, input, {})
                return resolve(result)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }
    
    public async loadDailyReport(projectId: string, input: DailyReportSchema): Promise<any> {
        return new Promise(async (resolve, reject) => {
            try {
                const tableName = `Fieldwire Task Summary`
                if (FieldwireSDK.editableProjects.indexOf(projectId) < 0) {
                    throw new Error(`Attempted to edit a non-editable project: ${projectId}`)
                }
                const sections = await this.formSectionsForForm(projectId, input.form_id)
                if (!sections || sections.length <= 0) {
                    throw new Error(`Unable to retrieve form sections for form ${input.form_id}`)
                }
                const section = sections.find(s => s.name.toLowerCase()===tableName.toLowerCase())
                if (!section) {
                    throw new Error(`Cannot determine Work Log section for form ${input.form_id}`)
                }

                const formSectionRecords = await this.formSectionRecordsForSection(projectId, section.id)
                if (!formSectionRecords || formSectionRecords.length <= 0) {
                    throw new Error(`Unable to retrieve form section records for form ${input.form_id}`)
                }
                // #endregion
                const sectionRecord = formSectionRecords.find(s => s.name.toLowerCase()==='work log')
                if (!sectionRecord) {
                    throw new Error(`Cannot determine Work Log section record for form ${input.form_id}: Looking for ${tableName}`)
                }
                console.log(`sectionRecord`)
                console.dir(sectionRecord)
                const dataTypes: DataTypeSchema[] = await this.projectDataTypes(projectId)
                // We are hardcoding new records each time
                // TODO: Get form_section_record values and test each row to see if already on form

                // For each work log entry - create section record input
                for(let i = 0; i < input.worklog.length; i++) {
                    // Create Form Table Row
                    const worklogentry = input.worklog[i]
                    // Limit run for debugging to one row
                    if (worklogentry.Trade) { //}==='Cable') {
                        const formSectionRecordValueBody = {
                            creator_user_id: 1684559,
                            last_editor_user_id: 1684559,
                            form_section_record_id: sectionRecord.id,
                            ordinal: 1
                        }
                        const sectionRecordValueResult: FormSectionRecordValue = await this.createFormSectionRecordValue(projectId, formSectionRecordValueBody)
                        await Utils.sleep(1000)
                        // use sectionRecordValueResult.id as form_section_record_value_id
                        console.log(`createFormSectionRecordValue: Row`)
                        console.dir(formSectionRecordValueBody)
                        console.dir(sectionRecordValueResult)
                        
                        // Columns
                        const sectionRecordInputs = await this.formSectionRecordInputsForSectionRecord(projectId, sectionRecordValueResult.form_section_record_id)
                        //const sectionRecordInputs = await this.formSectionRecordInputsForSectionRecord(projectId, sectionRecord.id)
                        console.dir(`formSectionRecordInputsForSectionRecord: Columns`)
                        console.dir(sectionRecord.id)
                        console.dir(sectionRecordInputs)
                        await Utils.sleep(1000)
                        for (let x = 0; x < sectionRecordInputs.length; x++) {
                            const sectionRecordInput: FormSectionRecordInput = sectionRecordInputs[x]
                            // use sectionRecordInput.form_section_record_input_id
                            const dataType = dataTypes.find(s => s.id===sectionRecordInput.data_type_id)
                            if (dataType) {
                                let data: DataTypeValueSchema = {
                                    creator_user_id: 1684559,
                                    last_editor_user_id: 1684559,
                                    data_type_id: dataType.id,
                                }
                                if (dataType.kind==='string') {
                                    data.string_value=worklogentry.Trade
                                }
                                if (dataType.kind==='decimal') {
                                    data.decimal_value=worklogentry.Hours
                                }
                                if (dataType.kind==='bigint') {
                                    data.bigint_value=worklogentry.Quantity
                                }
                                const dataTypeValueResult = await this.createDataTypeValue(projectId, data)
                                console.log(`createDataTypeValue: Data Value Placeholder`)
                                console.dir(data)
                                console.dir(dataTypeValueResult)

                                const createFormSectionRecordInputValueBody = {
                                    form_section_record_input_id: sectionRecordInput.id, // this is fine
                                    form_section_record_value_id: sectionRecordValueResult.id||'', // cannot find this value?
                                    value_id: dataTypeValueResult.id||'',
                                    creator_user_id: 1684559,
                                    last_editor_user_id: 1684559,
                                    value_type: 'DataTypeValue'
                                }
                                // const createFormSectionRecordInputValueBody = {
                                //     form_section_record_input_id: sectionRecordValueResult.id, // this is fine
                                //     form_section_record_value_id: sectionRecordInput.id||'', // cannot find this value?
                                //     value_id: dataTypeValueResult.id||'',
                                //     creator_user_id: 1684559,
                                //     last_editor_user_id: 1684559,
                                //     value_type: 'DataTypeValue'
                                // })
                                const mapValueToColumnResult = await this.createFormSectionRecordInputValues(projectId, createFormSectionRecordInputValueBody)
                                console.log(`createFormSectionRecordInputValues: Link Data Value to Column`)
                                console.dir(createFormSectionRecordInputValueBody)
                                console.dir(mapValueToColumnResult)
                                await Utils.sleep(200)
                            }
                        }
                    }

                }

                return resolve(input)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        });
    }

    // #endregion

    // #region AWS
    // aws_post_tokens
    public async aws_post_tokens(): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            try {
                const result = await this.post(`aws_post_tokens`, {})
                return resolve(result)
            } catch (err) {
                return reject(err)
            }
        });
    }
    // #endregion

}

export interface PreviewResponse {
    id: string
    row: any
    deviceId?: string
    resolvedDevice?: ResolvedDevice
    messages: string[]
    subTaskDefs: MaterialSubTask[]
    attrs: MaterialAttribute[]
}

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
