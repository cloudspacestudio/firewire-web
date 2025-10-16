export interface ProjectStatusSchema {
    color: string
    created_at: Date
    creator_user_id: number
    deleted_at?: Date
    device_created_at: Date
    device_updated_at: Date
    id: string
    is_default: boolean
    kind: string
    last_editor_user_id: number
    name: string
    ordinal: number
    project_id: string
    required_roles: string
    resolved_conflict: boolean
    updated_at: Date
}