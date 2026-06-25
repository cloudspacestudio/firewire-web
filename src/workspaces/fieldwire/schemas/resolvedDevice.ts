import { Vendor } from "../repository/vendor"
import { VwDeviceMaterial } from "../repository/vwdevicematerial"

export interface ResolvedDevice {
    id: string
    name: string
    shortName?: string
    partNumber: string
    link: string
    cost: number
    defaultLabor: number
    category: {
        name: string
        shortName?: string
        handle?: string
    }
    vendor: Vendor
    materials: VwDeviceMaterial[]
    slcAddress: string
    serialNumber: string
    strobeAddress: string
    speakerAddress: string

    fwTeamId?: string
    fwTaskId?: string
}
