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
exports.FieldwireAWS = void 0;
class FieldwireAWS {
}
exports.FieldwireAWS = FieldwireAWS;
_a = FieldwireAWS;
FieldwireAWS.manifestItems = [
    {
        method: 'get',
        path: '/api/fieldwire/aws_post_tokens',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const result = yield fieldwire.aws_post_tokens();
                    return res.status(200).json(result);
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
