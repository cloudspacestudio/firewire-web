import { AccountProjectSchema } from "./accounts/account.project.schema";
import { AccountProjectStatSchema } from "./accounts/account.projectstat.schema";
import { AccountProjectUserSchema } from "./accounts/account.project.user.schema";
import { ProjectFloorplanSchema } from './projects/project.floorplan.schema';
import { ProjectTaskSchema } from "./tasks/projecttask.schema";
import { TaskEmailParams } from "./tasks/taskemail.params";

const apiKey = process.env.fieldwire

export class FieldwireSDK {
    private _jwtToken: any = null
    private _globalUrl = `https://client-api.super.fieldwire.com`
    private _regionUrl = `https://client-api.us.fieldwire.com/api/v3/`
    
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
                const result = await this.get(`projects/${projectId}/floorplans${suffix}`)
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
