import { promises as fs } from 'fs';
import * as path from 'path';

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

}