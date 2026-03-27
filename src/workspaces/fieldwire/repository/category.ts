export interface Category {
    categoryId: string
    name: string
    shortName: string
    handle: string
    defaultLabor?: number | null
    includeOnFloorplan?: boolean | null
    slcAddress?: string | null
    speakerAddress?: string | null
    strobeAddress?: string | null
    createat?: Date
    createby?: string
    updateat?: Date
    updateby?: string
}
