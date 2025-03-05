export interface CreateTaskParams {
    project_id: string
    creator_user_id: string
    owner_user_id: string
    floorplan_id: string
    team_id: string
    is_local: boolean
    name: string
    pos_x: number
    pos_y: number
    priority: number

    status_id: string

    task_type_id?: string
    location_id?: string
    due_date?: Date
    cost_value?: number
    man_power_value?: number
    due_at?: Date
    end_at?: Date
    start_at?: Date
    fixed_at?: Date
    verified_at?: Date
}