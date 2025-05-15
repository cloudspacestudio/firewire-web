export interface MaterialSubTask {
    materialSubTaskId: string
    materialId: string
    statusName: string
    taskNameFormat: string
    laborHours: number
    ordinal: number
    projectId: string
    org?: string
}