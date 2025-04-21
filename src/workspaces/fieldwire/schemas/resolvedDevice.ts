import { Category } from "../repository/category"
import { Vendor } from "../repository/vendor"
import { Material } from "../repository/material"

export interface ResolvedDevice {
    id: string
    name: string
    shortName?: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    category: Category
    vendor: Vendor
    materials: Material[]
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string

    fwTeamId?: string
    fwTaskId?: string
}
