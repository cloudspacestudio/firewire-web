"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FieldwireDevices = void 0;
const sqldb_1 = require("../repository/sqldb");
class FieldwireDevices {
}
exports.FieldwireDevices = FieldwireDevices;
_a = FieldwireDevices;
FieldwireDevices.manifestItems = [
    {
        method: 'get',
        path: '/api/fieldwire/devices',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const sqldb = new sqldb_1.SqlDb(req.app);
                    const result = yield sqldb.getDevices();
                    return res.status(200).json({
                        rows: result
                    });
                }
                catch (err) {
                    return res.status(500).json({
                        message: err && err.message ? err.message : err
                    });
                }
            }));
        }
    }
];
