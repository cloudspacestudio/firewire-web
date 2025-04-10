import { AccountProjectSchema } from "./accounts/account.project.schema";
import { AccountProjectStatSchema } from "./accounts/account.projectstat.schema";
import { AccountProjectUserSchema } from "./accounts/account.project.user.schema";
import { ProjectFloorplanSchema } from './projects/project.floorplan.schema';
import { ProjectTaskSchema } from "./tasks/projecttask.schema";
import { TaskEmailParams } from "./tasks/taskemail.params";
import { CreateTaskParams } from "./tasks/project.task.params";

const apiKey = process.env.fieldwire

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
                console.log(`HEADERS: ${JSON.stringify(headers)}`)
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
    private _buildHeaders(additionalHeaders?: any) {
        let output = {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Fieldwire-Version': '2024-11-01',
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
                const result = await this.get(`account/projects`)
                return resolve(result)
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
    public async teams(projectId: string): Promise<AccountProjectSchema> {
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
    public async projectTaskTypeAttrinutes(projectId: string): Promise<any> {
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
    // #endregion

    // #region Devices
    public async devices(app: any): Promise<any[]> {
        return new Promise(async (resolve, reject) => {
            try {
                if (app.locals && app.locals.devices) {
                    return resolve([...app.locals.devices])
                }
                const sql = app.locals.sqlserver
                const result = await sql.query(`SELECT * FROM materials`)
                if (!result || !result.recordset) {
                    throw new Error(`No materials found`)
                }
                app.locals.devices = [...result.recordset]
                return resolve([...app.locals.devices])
            } catch (err) {
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

    // #region Utils

    // Get Category Info for Project and Row combination
    static getTeamIdFromName(projectId: string, name: string): string {
        // projectId: Sample 01: 85285faa-a9dd-4c75-9f37-8a98faf4d09a
        // projectId: Test: d0105078-da46-4a42-809f-b015b0cf87c8
        // projectId: Block Setup 101: 4b9a65d3-4ce4-4308-b93e-4513ff98fc72
        // projectId: Fieldwire Business Oklahoma Project: 39bd5799-295a-41e4-aaea-839f78393de2

        if (projectId==='4b9a65d3-4ce4-4308-b93e-4513ff98fc72') {
            // speaker strobe 9219b7f1-85a3-42be-8df0-f460334c04e1
            // pull station 970973b7-dca7-4302-8d07-38a97f7efe2c
            // VESDA detector 77558dd3-cd37-43f5-8d57-dd10289ce532
            // speaker strobe ceiling 3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a
            const defaultTeam = '970973b7-dca7-4302-8d07-38a97f7efe2c' // pull station 970973b7-dca7-4302-8d07-38a97f7efe2c
            if (!name) {
                return defaultTeam
            }
            if (name.toLowerCase().indexOf('cd')) {
                return '9219b7f1-85a3-42be-8df0-f460334c04e1' // speaker strobe 9219b7f1-85a3-42be-8df0-f460334c04e1
            }
            if (name.toLowerCase().indexOf('heat')) {
                return '77558dd3-cd37-43f5-8d57-dd10289ce532' // VESDA detector 77558dd3-cd37-43f5-8d57-dd10289ce532
            }
            if (name.toLowerCase().indexOf('wp sv')) {
                return '3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a' // speaker strobe ceiling 3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a
            }
            switch(name.toLowerCase()) {
                default:
                    return defaultTeam
            }
        }

        throw new Error(`No maps for project ${projectId}`)
    }

    // #endregion

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
