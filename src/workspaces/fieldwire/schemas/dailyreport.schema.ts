export interface DailyReportSchema {
    form_id: string
    worklog: WorkLogEntry[]
}

export interface WorkLogEntry {
    Trade: string
    Quantity: number
    Hours: number
}