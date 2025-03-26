import { promises as fs } from 'fs'
import * as path from 'path'
import fssync from 'fs';
import { parse } from 'csv-parse';

export class Utils {

    /**
     * Checks if a directory exists at the given path.
     * @param dirPath - The path of the directory to check.
     * @returns A promise that resolves to true if the directory exists, otherwise false.
     */
    static directoryExists(dirPath: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                const stats = await fs.stat(dirPath);
                return resolve(stats.isDirectory());
            } catch (error: Error|any) {
                // If the error is due to the path not existing, return false
                if (error.code === 'ENOENT') {
                    return reject(false);
                }
                // Re-throw any other error
                throw error;
            }
        })
    }

    /**
     * Recursively retrieves file paths from a given directory that contain "phrase" in their names.
     * @param dirPath - The directory path to search in.
     * @returns A promise that resolves to an array of matching file paths.
     */
    static getFilesWithPhrase(dirPath: string, phrase: string): Promise<string[]> {
        return new Promise(async(resolve, reject) => {
            let result: string[] = [];

            try {
                // Read all items (files and subdirectories) in the directory
                const items = await fs.readdir(dirPath, { withFileTypes: true });
    
                for (const item of items) {
                    const itemPath = path.join(dirPath, item.name);
    
                    if (item.isDirectory()) {
                        // Recursively search in subdirectories
                        const subDirFiles = await Utils.getFilesWithPhrase(itemPath, phrase);
                        result = result.concat(subDirFiles);
                    } else if (item.isFile() && item.name.includes(phrase)) {
                        // Add file path if it contains ".route." in the name
                        result.push(itemPath);
                    }
                }
                return resolve(result);
            } catch (error) {
                console.error(`Error reading directory ${dirPath}:`, error);
                return reject(error)
            }
        })
    }

    /**
     * Dynamically loads a class from a given file path and creates a new instance.
     * @param filePath - The path to the module containing the class.
     * @param className - The name of the class to instantiate.
     * @param constructorArgs - Arguments to pass to the class constructor.
     * @returns A promise resolving to an instance of the loaded class.
     */
    static loadManifest(
        filePath: string,
        ...constructorArgs: any[]
    ): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                // Dynamically import the module
                const module = await import(filePath)
    
                if (!module.default) {
                    throw new Error(`Default module not found in '${filePath}'.`)
                }
    
                // Create a new instance of the class with the given arguments
                const ClassReference = module.default
                return resolve(new ClassReference(...constructorArgs))
            } catch (error) {
                console.error(`Error loading class default from file '${filePath}':`, error)
                return reject(error)
            }
        })
    }

    /**
     * Dynamically loads csv into an array of any from a filepath.
     * @param filePath - The path to the module containing the class.
     * @returns A promise resolving to an instance of any array of rows from the csv file.
     */
    static async loadCSV(filePath: string): Promise<any> {
        const results: any[] = [];
        const parser = fssync.createReadStream(filePath)
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
    
    static getTeamIdFromName(projectId: string, name: string): string {
        if (projectId==='4b9a65d3-4ce4-4308-b93e-4513ff98fc72') {
            // speaker strobe 9219b7f1-85a3-42be-8df0-f460334c04e1
            // pull station 970973b7-dca7-4302-8d07-38a97f7efe2c
            // VESDA detector 77558dd3-cd37-43f5-8d57-dd10289ce532
            // speaker strobe ceiling 3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a
            const defaultTeam = '970973b7-dca7-4302-8d07-38a97f7efe2c' // pull station 970973b7-dca7-4302-8d07-38a97f7efe2c
            if (!name) {
                return defaultTeam
            }
            if (name.toLowerCase().indexOf('cd')) {
                return '9219b7f1-85a3-42be-8df0-f460334c04e1' // speaker strobe 9219b7f1-85a3-42be-8df0-f460334c04e1
            }
            if (name.toLowerCase().indexOf('heat')) {
                return '77558dd3-cd37-43f5-8d57-dd10289ce532' // VESDA detector 77558dd3-cd37-43f5-8d57-dd10289ce532
            }
            if (name.toLowerCase().indexOf('wp sv')) {
                return '3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a' // speaker strobe ceiling 3bc6a2a6-f14c-40fb-9f53-e95cd4921c8a
            }
            switch(name.toLowerCase()) {
                default:
                    return defaultTeam
            }
        }

        throw new Error(`No maps for project ${projectId}`)
    }

    static sleep(ms: number): Promise<any> {
        return new Promise((resolve) => {
            setTimeout(() => {
                return resolve(true)
            }, ms)
        })
    }

    static convertToInches(input: string): number | null {
        let sign = 1;
        let feet = 0;
        let inches = 0;
        let fraction = "";
        let fractionValue = 0;
    
        // Check for negative sign
        if (input.startsWith("-")) {
            sign = -1;
            input = input.substring(1);
        }
    
        // Extract feet and inches
        const feetMatch = input.match(/^([0-9]+)'/);
        if (feetMatch) feet = parseInt(feetMatch[1], 10);
    
        const inchesMatch = input.match(/-([0-9]+)/);
        if (inchesMatch) inches = parseInt(inchesMatch[1], 10);
    
        // Extract fraction (if exists)
        const fractionMatch = input.match(/ ([0-9]+\/[0-9]+)"/);
        if (fractionMatch && fractionMatch[1]) {
            fraction = fractionMatch[1];
            const [numerator, denominator] = fraction.split("/").map(Number);
            if (!isNaN(numerator) && !isNaN(denominator) && denominator !== 0) {
                fractionValue = numerator / denominator;
            }
        }
    
        // Calculate total inches
        const result = sign * ((feet * 12) + inches + fractionValue);
    
        // Validate result
        return isNaN(result) ? null : result;
    }

}