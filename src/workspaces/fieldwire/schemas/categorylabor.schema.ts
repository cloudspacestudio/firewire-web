export interface CategoryLaborSchema {
    uuid: string
    categoryName: string
    statusName: string
    labor: number
    org?: string
    project?: string
}