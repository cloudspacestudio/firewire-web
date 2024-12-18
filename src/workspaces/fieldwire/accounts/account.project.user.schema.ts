export interface AccountProjectUserSchema {
    created_at: Date
    updated_at: Date
    email_address: AccountProjectUserEmailSchema[]
    id: number
    account_id: number
    company: string
    company_type: string
    email: string
    first_name: string
    invited_by_id: number
    is_confirmed: boolean
    is_email_deliverable: boolean
    job_title: string
    language: string
    last_name: string
    phone_number: string
    photo_url: string
    trade_type: string
    is_admin: boolean
    is_approved: boolean
    user_blocked_at: Date
    user_deleted_at: Date
    role: string
    pm_role: string
    pm_group_id: string
    project_id: string
    currenct_sign_in_at: Date
    in_app_purchase_end_at: Date
    email_notifications: string
    sync_schema: string
}

export interface AccountProjectUserEmailSchema {
    email: string
    is_primary: boolean
}