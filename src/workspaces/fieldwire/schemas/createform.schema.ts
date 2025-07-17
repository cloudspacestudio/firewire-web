export interface CreateFormSchema {
    checksum: string
    form_template_form_status_id: string
    form_template_id: string
    is_generated?: boolean
    kind?: string
    name: string
    owner_user_id?: number
    creator_user_id?: number
    last_editor_user_id?: number
    start_at: Date
    end_at: Date
}