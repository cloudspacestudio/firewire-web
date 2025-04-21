export interface TaskRelationSchema {
    id?: string
    project_id: string
    task_1_id: string
    task_2_id: string
    creator_user_id: number
}