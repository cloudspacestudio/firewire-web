import * as express from 'express'
const fs = require('fs')
const { parse } = require('csv-parse');
import { Bootstrap } from './core/bootstrap'

const port = process.env.PORT || 3000
const bootstrapper: Bootstrap = new Bootstrap()

async function loadCSV(filePath: string) {
    const results: any[] = [];
    const parser = fs.createReadStream(filePath)
        .pipe(parse({
            delimiter: ',', // Adjust if your CSV uses a different delimiter
            columns: true, // If your CSV has headers, this will use them as keys
            skip_empty_lines: true
        }));

    parser.on('data', (data: any) => {
        results.push(data);
    });
    parser.on('error', (err: any) => {
        console.error('Error reading CSV:', err);
    });
    await new Promise((resolve: any) => {
        parser.on('end', () => {
            resolve();
        });
    });

    return results;
}

bootstrapper.start().then(async(app: express.Application) => {
    // Load device data
    const data = await loadCSV('devices.csv')
    const deviceData: any[] = []
    data.forEach((item: any) => {
        const newDevice = Object.assign({}, item)
        newDevice.ID = item['﻿ID']
        delete newDevice['﻿ID']
        deviceData.push(newDevice)
    })
    app.locals.devices = deviceData
    app.listen(port, () => {
        console.log(`Express server started on port ${port}`)
    })
})
