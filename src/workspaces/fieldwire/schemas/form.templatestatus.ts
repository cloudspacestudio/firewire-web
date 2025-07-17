export interface FormTemplateStatus {
    created_at: Date
    creator_user_id: string
    deleted_at?: Date
    device_created_at: Date
    device_updated_at: Date
    form_template_id: string
    id: string
    is_editable: boolean
    last_editor_user_id: number
    name: string
    ordinal: number
    owner_user_id?: number
    project_id: string
    recipient_emails?: string
    required_role_in: string
    required_role_out: string
    resolved_conflict: boolean
    updated_at: Date
}
