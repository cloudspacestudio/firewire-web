import * as express from 'express'
import * as fs from 'node:fs'
import * as path from 'node:path'

interface AboutLibraryAttribution {
    name: string
    version: string
    license: string
}

export class FirewireAboutData {
    static manifestItems = [
        {
            method: 'get',
            path: '/api/firewire/about',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        const metadata = buildAboutResponse(req)
                        return res.status(200).json({
                            data: metadata
                        })
                    } catch (err: Error | any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }
    ]

    static legacyFieldwireAliasItems = FirewireAboutData.manifestItems.map((item) => ({
        ...item,
        path: item.path.replace('/api/firewire/', '/api/fieldwire/')
    }))
}

function buildAboutResponse(req: express.Request) {
    const repoRoot = process.cwd()
    const packageJsonPath = path.join(repoRoot, 'package.json')
    const packageLockPath = path.join(repoRoot, 'package-lock.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
    const packageLock = JSON.parse(fs.readFileSync(packageLockPath, 'utf8'))

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
    }
}

function getInstalledProductionLibraries(packageJson: any, packageLock: any): AboutLibraryAttribution[] {
    const dependencyNames = Object.keys(packageJson.dependencies || {}).sort((left, right) => left.localeCompare(right))
    const packages = packageLock?.packages || {}

    return dependencyNames.map((name) => {
        const packageEntry = packages[`node_modules/${name}`] || {}
        return {
            name,
            version: packageEntry.version || packageJson.dependencies[name] || 'Unknown',
            license: packageEntry.license || 'Unknown'
        }
    })
}
