export interface ProjectFloorplanSchema {
    id: string
    creator_user_id: number
    last_editor_user_id: number
    project_id: string
    resolved_conflict: boolean
    created_at: Date
    updated_at: Date
    device_created_at: Date
    device_updated_at: Date
    deleted_at?: Date
    name: string
    is_name_confirmed: boolean
    folder_id?: number
    is_user_confirmed: boolean
    description?: string
    is_ocr_processing: boolean
    active_sheets_count: number
    process_state?: string
    cascade_deleted_by_id?: string
    deleted_by_two_way_sync: boolean
    latest_component_device_updated_at: Date
    sheets: any[]
}
