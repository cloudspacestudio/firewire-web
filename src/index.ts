import * as express from 'express'
import { Bootstrap } from './core/bootstrap'

const port = process.env.PORT || 3000
const bootstrapper: Bootstrap = new Bootstrap()

bootstrapper.start().then((app: express.Application) => {
    app.listen(port, () => {
        console.log(`miSSion.webserver: started on port ${port}`)
    })
}).catch((e: any) => {
    if (!e.handled) {
        console.log(`miSSion.webserver: exit error`)
        console.error(e)
    }
    process.exit(-1)
})
