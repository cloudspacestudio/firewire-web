export interface TaskTypeAttributeSchema {
    id: string
    project_id: string
    task_type_id: string
    name: string
    kind: number
    ordinal: number
    visible: boolean
    reference_id?: string
    always_visibile: boolean
    creator_user_id: string
    last_editor_user_id: string
}