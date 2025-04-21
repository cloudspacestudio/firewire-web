export interface AccountProjectStatSchema {
    created_at: Date
    updated_at: Date
    id: number
    project_id: string
    user_count: number
    sheet_count: number
    priority_1_task_count: number
    priority_2_task_count: number
    priority_3_task_count: number
    task_count: number
}