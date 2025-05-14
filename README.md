# MEAN(S) Web
Express JS implementation on Node JS supporting patterns for the serving of Angular SPA with REST apis communicating with both Mongo and any form of SQL server (MS Sql, Azure Sql, Postgres etc.)

## Convention over Configuration
Creating entities in the apis folder that implement the IRoutable interface will be automatically bootstrapped into the application at the time of startup. In this way consumers can extend this library and add content without collision with core framework components.

## CONFIG

### Simple Config Values
The following .env (environment variables) are optional. If you do not provide an APPNAME a new GUID will be used instead. Lack of PORT will use the hosting environment default value.

| name | note |
|------|------|
| APPNAME | An application name to use when connecting to mongo or postgres for use in the remote systems logs and analytics |
| PORT | The port to run the web service on. Usually only relevant in development scenarios |

### JWT Generation Required
The following keys are required if using JWT authentication like basic authentication where a JWT token must be composed and verified inside a contained environment.
| name | note |
|------|------|
| JWTSECRET | When using JWT token generation techniques, use this value as the secret key used for JWT composition and verification |

### Mongo Database
If using Mongo DB as a backend persistent datastore, these keys are required to connect and use that database.
| name | note |
|------|------|
| MONGOURL | Remote URI from mongo database confirmation that typically includes usernames and passwords embedded with mongo port etc. This is the equivalent of the Mongo database connection string |
| MONGODBNAME | The database name residing at the above connection string endpoint |

### Postgres Database
If using Postgres DB as a backend persistent datastore, these keys are required to connect and use that database.
| name | note |
|------|------|
| PGUSER | Postgres database username |
| PGPWD | Postgres database user password. It should go without saying this value along with other sensitive values should be stored securely in whatever hosting service is being used (such as KeyVault in Azure) |
| PGHOST | Host name is the URL (or localhost) of the postgres database |
| PGPORT | The port postgres is listening for requests on |
| PGDATABASE | The database name for the postgres database |

### SQL Server Database
If using SQL Server DB as a backend persistent datastore, these keys are required to connect and use that database.
| name | note |
|------|------|
| SQLUSER | User to connect to sql server database |
| SQLPWD | Above user's password |
| SQLDB | Default database to connect to in sql server |
| SQLSRV | Remote URI including protocol and port for sql server database |

## DATABASE SUPPORT FOR DEVELOPMENT
You can install local databases for free to use with development

### SQL Server
https://www.microsoft.com/en-us/sql-server/sql-server-downloads
firewire-dev.database.windows.net

## Manifest Pattern
Create files in the workspaces directory that include in their name "manifest" and inherit (extend) BaseManifest class. They must export a default class that extends BaseManifest as demonstrated below
````
import * as express from 'express'

import { AuthStrategy } from "../core/auth/authstrategy";
import { BaseManifest } from "../core/routing/base.manifest";
import { IManifestItem } from "../core/routing/imanifestitem";

export default class TestManifest extends BaseManifest {

    appname: string = 'test'
    authStrategy: AuthStrategy = AuthStrategy.none
    dependencies: string[] = []
    items: IManifestItem[] = [
        {
            method: 'get',
            path: '/api/test',
            fx: (req: express.Request, res: express.Response) => {
                return new Promise(async(resolve, reject) => {
                    try {
                        return res.status(200).json({
                            message: 'Hello World'
                        })
                    } catch (err: Error|any) {
                        return res.status(500).json({
                            message: err && err.message ? err.message : err
                        })
                    }
                })
            }
        }
    ]
}
````
