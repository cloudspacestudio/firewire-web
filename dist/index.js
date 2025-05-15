"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const bootstrap_1 = require("./core/bootstrap");
const port = process.env.PORT || 3000;
const bootstrapper = new bootstrap_1.Bootstrap();
bootstrapper.start().then((app) => {
    app.listen(port, () => {
        console.log(`miSSion.webserver: started on port ${port}`);
    });
}).catch((e) => {
    if (!e.handled) {
        console.log(`miSSion.webserver: exit error`);
        console.error(e);
    }
    process.exit(-1);
});
