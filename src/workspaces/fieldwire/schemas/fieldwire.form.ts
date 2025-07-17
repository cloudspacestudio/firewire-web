export interface FieldwireForm {
    checksum: string
    created_at: Date
    creator_user_id: number
    deleted_at?: Date
    device_created_at: Date
    device_updated_at: Date
    due_date?: Date
    end_at: Date
    form_template_form_status_id: string
    form_template_id: string
    form_type: string
    id: string
    is_generated: boolean
    kind: string 
    last_editor_user_id: number
    name: string
    owner_user_id: number
    project_id: string 
    resolved_conflict: boolean 
    sequence_number: number 
    start_at: Date 
    updated_at: Date
    version: number 
    view_edit_permissions: string 
}