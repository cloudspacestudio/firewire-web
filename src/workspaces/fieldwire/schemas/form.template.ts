export interface FormTemplate {
    id: string
    creator_user_id: string
    last_editor_user_id: string
    project_id: string
    resolved_conflict: boolean
    created_at: Date
    updated_at: Date
    device_created_at: Date
    device_updated_at: Date
    deleted_at?: Date
    name: string
    kind: string
    version: number
    checksum: string
    published_at?: Date
    is_generated: boolean
    view_edit_permissions: string
    form_type: string
    status_change_recipient_emails?: string
    docusign_automation?: string
}