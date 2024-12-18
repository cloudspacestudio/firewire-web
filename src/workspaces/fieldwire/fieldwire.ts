import { AccountProjectSchema } from "./accounts/account.project.schema";
import { AccountProjectStatSchema } from "./accounts/account.projectstat.schema";
import { AccountProjectUserSchema } from "./accounts/account.project.user.schema";

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
    public async accountProjectUsers(projectId: string): Promise<any> {
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
    public async projectFloorplans(projectId: string, includeCurrentSheet: boolean): Promise<AccountProjectUserSchema[]> {
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
