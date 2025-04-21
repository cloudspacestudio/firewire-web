import { ProjectFloorplanSchema } from "../../schemas/project.floorplan.schema";
import { ProjectSheetSchema } from "../../schemas/project.sheet";
import { ResolvedDevice } from "../../schemas/resolvedDevice";
import { DeviceResolver } from "./device.resolver";
import { ResolverParams } from "./resolver.params";

export class PositionResolver {

    constructor(private resolvedDevice: ResolvedDevice, private deviceResolver: DeviceResolver) {}

    resolvePosition(params: ResolverParams, row: any, floorplan: ProjectFloorplanSchema): ResolvedPosition {
        if (!row) {
            return {
                posX: 0.00, posY: 0.00
            }
        }

        const possibleXNames = ['POSX', 'POS_X', 'posx', 'pos_x', 
            'Position X1', 'Position X', 'X pos (%)', 'PosX']
        let valueX: string | null = null
        possibleXNames.forEach((possibleXName) => {
            if (!valueX && row.hasOwnProperty(possibleXName)) {
                valueX = row[possibleXName]
            }
        })

        const possibleYNames = ['POSY', 'POS_Y', 'posy', 'pos_y', 
            'Position Y1', 'Position Y', 'Y pos (%)', 'PosY']
        let valueY: string | null = null
        possibleYNames.forEach((possibleYName) => {
            if (!valueY && row.hasOwnProperty(possibleYName)) {
                valueY = row[possibleYName]
            }
        })

        let valueXInt = 0.00
        if (valueX && !isNaN(valueX)) {
            valueXInt = +valueX
        }

        let valueYInt = 0.00
        if (valueY && !isNaN(valueY)) {
            valueYInt = +valueY
        }

        const xAsPct = valueXInt/100
        const yAsPct = valueYInt/100
        const currentSheet: ProjectSheetSchema = floorplan.sheets[0]

        return {
            posX: currentSheet.file_width * xAsPct,
            posY: currentSheet.file_height * yAsPct
        }
    }

}

export interface ResolvedPosition {
    posX: number
    posY: number
}