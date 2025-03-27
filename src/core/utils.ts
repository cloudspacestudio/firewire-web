import { promises as fs } from 'fs'
import * as path from 'path'
import fssync from 'fs';
import { parse } from 'csv-parse';
import { v4 as uuidv4 } from 'uuid'

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
    static replaceAllInstances(inputString: string, char: string, replacement: string): string {
        // Escape the character if it's a special regex character
        const escapedChar = char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      
        // Create a regex to match all instances of the character
        const regex = new RegExp(escapedChar, 'g');
      
        // Replace all instances of the character with the replacement string
        const resultString = inputString.replace(regex, replacement);
      
        return resultString;
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
    
    /*
        Asynchronously write data to a file on node fs and await closure before resolving
    */
    static writeFile(targetFilePath: string, data: any): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            try {
                    const writeStream = await fs.open(targetFilePath, 'w');
                    const result = JSON.stringify(data)
                    try {
                        await writeStream.write(result);
                    } catch (innerErr) {
                        console.error(innerErr)
                    } finally {
                        await writeStream.close();
                        setTimeout(() => {
                            return resolve(true)
                        }, 1)
    
                    }
            } catch (err) {
                return reject(err)
            }
        })
    }
    
    // simple funtion to return all files including sub directories in a given path
    static getAllFilePaths(directory: string): Promise<string[]> {
        return new Promise(async(resolve, reject) => {
            try {
                const filePaths: string[] = [];

                async function traverse(dir: string) {
                    const entries = await fs.readdir(dir, { withFileTypes: true });
            
                    for (const entry of entries) {
                        const fullPath = path.join(dir, entry.name);
                        if (entry.isDirectory()) {
                            // Recursively traverse subdirectories
                            await traverse(fullPath);
                        } else if (entry.isFile()) {
                            // Add file paths to the result array
                            filePaths.push(fullPath);
                        }
                    }
                }
            
                await traverse(directory);
                return resolve(filePaths);
            } catch (err) {
                return reject(err)
            }
        })
    }

    /*
        SYNCHRONOUS
        Ensures that a subdirectory exists within a root directory.
        If the subdirectory does not exist, it creates it.
    
        @param rootDirectory - The root directory path.
        @param subDirectoryName - The name of the subdirectory to check or create.
    */
    static ensureSubdirectoryExists(rootDirectory: string, subDirectoryName: string): Promise<boolean> {
        return new Promise(async(resolve, reject) => {
            // Resolve the full path to the subdirectory
            const subDirectoryPath = path.join(rootDirectory, subDirectoryName);

            try {
                // Check if the path exists and is a directory
                if (!fssync.existsSync(subDirectoryPath)) {
                    fssync.mkdirSync(subDirectoryPath, { recursive: true }); // Create the directory if it doesn't exist
                    console.log(`Directory created: ${subDirectoryPath}`);
                    setTimeout(() => {
                        return resolve(true)
                    },10)
                } else if (!fssync.lstatSync(subDirectoryPath).isDirectory()) {
                    throw new Error(`The path ${subDirectoryPath} exists but is not a directory.`);
                } else {
                    console.log(`Directory already exists: ${subDirectoryPath}`);
                    setTimeout(() => {
                        return resolve(true)
                    },10)
                }
            } catch (error: any) {
                console.error(`Failed to ensure directory exists: ${error.message}`);
                return reject(false)
            }
        })
    }
    
    // Given the input string, remove all instances of target array with empty string
    static emptyAllInstances(input: string, targets: string[]): string {
        let output = input
        targets.forEach((item) => {
            output = output.split(item).join('');
        })
        return output
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

    static getRandomIntBetween(min: number, max: number): number {
        const lower = Math.ceil(min);
        const upper = Math.floor(max);
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
    }

    static newGuid() {
        const rand = `${process.pid}-${process.ppid}-${Date.now()}`
        return uuidv4()
    }

    static formatDateTimeForSqlServer(date: Date): string | null {
        if (!date) {
            return null
        }
        const pad = (num: number, size: number = 2) => num.toString().padStart(size, '0');
      
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // Months are 0-based
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        const milliseconds = pad(date.getMilliseconds(), 3);
      
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    static formatDateForSqlServer(date: Date): string | null{
        if (!date) {
            return null
        }
        const pad = (num: number) => num.toString().padStart(2, '0');
      
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // Months are 0-based
        const day = pad(date.getDate());
      
        return `${year}-${month}-${day}`;
    }

    static toBit(input: any) {
        if (!input) {
            return 0
        }
        const test = input.toString()
        if (!test || test.length <= 0) {
            return 0
        }
        if (test.trim().length <= 0) {
            return 0
        }
        switch(test.trim().toLowerCase()) {
            case 'true':
            case 'yes':
            case '1':
            case 'y':
            case 'on':
                return 1
            default:
                return 0
        }
    }

    static safeString(input: any): string|null {
        if (!input) {
            return null
        }
        input = Utils.replaceAllInstances(input, "'", '`')
        input = Utils.replaceAllInstances(input, '"', '”')
        return input
    }

    static toISODate(input: string) {
        if (!input) {
            return null
        }
        try {
            const theDate = new Date(input)
            const today = new Date()
            if (theDate.getFullYear() < today.getFullYear()) {
                return null
            }
            return `${theDate.getFullYear()}-${theDate.getMonth()+1}-${theDate.getDate()}`
        } catch {
            return null
        }
    }
}