export interface TaskEmailParams {
    projectId: string
    taskId: string
    subject: string
    body: string
    cc_sender: boolean
    email: string // to separated with commans, spaces or semicolons
    kind: string // HTML or PDF
}