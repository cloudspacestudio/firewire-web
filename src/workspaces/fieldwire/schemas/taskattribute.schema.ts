export interface TaskAttributeSchema {
    project_id: string
    task_id: string
    task_type_attribute_id: string
    creator_user_id: number
    last_editor_user_id: number

    id?: string
    created_at?: Date
    updated_at?: Date
    device_created_at?: Date
    device_updated_at?: Date
    deleted_at?: Date

    number_value?: number
    text_value?: string
    uuid_value?: string
}