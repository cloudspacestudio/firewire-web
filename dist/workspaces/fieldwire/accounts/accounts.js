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
exports.FieldwireAccounts = void 0;
class FieldwireAccounts {
}
exports.FieldwireAccounts = FieldwireAccounts;
_a = FieldwireAccounts;
FieldwireAccounts.manifestItems = [
    {
        method: 'get',
        path: '/api/fieldwire/account/projects',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const result = yield fieldwire.accountProjects();
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
    },
    {
        method: 'get',
        path: '/api/fieldwire/account/projectstats',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const result = yield fieldwire.accountProjectStats();
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
    },
    {
        method: 'get',
        path: '/api/fieldwire/account/projects/:projectId/users',
        fx: (req, res) => {
            const fieldwire = req.app.locals.fieldwire;
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const projectId = req.params.projectId;
                    if (!projectId) {
                        res.status(400).json({
                            message: 'Invalid Payload: Missing projectId parameter'
                        });
                    }
                    const result = yield fieldwire.accountProjectUsers(projectId);
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
    },
];
