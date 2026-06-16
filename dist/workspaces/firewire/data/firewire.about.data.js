"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
exports.FirewireAboutData = void 0;
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
class FirewireAboutData {
}
exports.FirewireAboutData = FirewireAboutData;
_a = FirewireAboutData;
FirewireAboutData.manifestItems = [
    {
        method: 'get',
        path: '/api/firewire/about',
        fx: (req, res) => {
            return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
                try {
                    const metadata = buildAboutResponse(req);
                    return res.status(200).json({
                        data: metadata
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
FirewireAboutData.legacyFieldwireAliasItems = _a.manifestItems.map((item) => (Object.assign(Object.assign({}, item), { path: item.path.replace('/api/firewire/', '/api/fieldwire/') })));
function buildAboutResponse(req) {
    const repoRoot = process.cwd();
    const packageJsonPath = path.join(repoRoot, 'package.json');
    const packageLockPath = path.join(repoRoot, 'package-lock.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'));
    return {
        generatedAt: new Date().toISOString(),
        name: packageJson.name || 'Unavailable',
        version: packageJson.version || 'Unavailable',
        connection: {
            runtimeBaseUrl: `${req.protocol}://${req.get('host') || ''}`,
            apiBasePath: '/api',
            runtimeApiRoot: `${req.protocol}://${req.get('host') || ''}/api`,
            defaultServerPort: String(process.env.PORT || 3000),
            authAuthority: process.env.ENTRA_AUTHORITY || '',
            tenantId: process.env.ENTRA_TENANT_ID || process.env.FIREWIRETENANTID || '',
            apiAudience: process.env.ENTRA_API_AUDIENCE || process.env.FIREWIRECLIENTID || '',
            requiredScopes: [
                process.env.REQUIRED_SCOPE,
                process.env.FIREWIRE_REQUIRED_SCOPE
            ].filter((value) => typeof value === 'string' && value.trim().length > 0)
        },
        libraries: getInstalledProductionLibraries(packageJson, packageLock)
    };
}
function getInstalledProductionLibraries(packageJson, packageLock) {
    const dependencyNames = Object.keys(packageJson.dependencies || {}).sort((left, right) => left.localeCompare(right));
    const packages = (packageLock === null || packageLock === void 0 ? void 0 : packageLock.packages) || {};
    return dependencyNames.map((name) => {
        const packageEntry = packages[`node_modules/${name}`] || {};
        return {
            name,
            version: packageEntry.version || packageJson.dependencies[name] || 'Unknown',
            license: packageEntry.license || 'Unknown'
        };
    });
}
