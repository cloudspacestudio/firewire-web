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
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = void 0;
const fs_1 = require("fs");
const path = __importStar(require("path"));
const fs_2 = __importDefault(require("fs"));
const csv_parse_1 = require("csv-parse");
const uuid_1 = require("uuid");
class Utils {
    /**
     * Checks if a directory exists at the given path.
     * @param dirPath - The path of the directory to check.
     * @returns A promise that resolves to true if the directory exists, otherwise false.
     */
    static directoryExists(dirPath) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const stats = yield fs_1.promises.stat(dirPath);
                return resolve(stats.isDirectory());
            }
            catch (error) {
                // If the error is due to the path not existing, return false
                if (error.code === 'ENOENT') {
                    return reject(false);
                }
                // Re-throw any other error
                throw error;
            }
        }));
    }
    static replaceAllInstances(inputString, char, replacement) {
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
    static getFilesWithPhrase(dirPath, phrase) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            let result = [];
            try {
                // Read all items (files and subdirectories) in the directory
                const items = yield fs_1.promises.readdir(dirPath, { withFileTypes: true });
                for (const item of items) {
                    const itemPath = path.join(dirPath, item.name);
                    if (item.isDirectory()) {
                        // Recursively search in subdirectories
                        const subDirFiles = yield Utils.getFilesWithPhrase(itemPath, phrase);
                        result = result.concat(subDirFiles);
                    }
                    else if (item.isFile() && item.name.includes(phrase)) {
                        // Add file path if it contains ".route." in the name
                        result.push(itemPath);
                    }
                }
                return resolve(result);
            }
            catch (error) {
                console.error(`Error reading directory ${dirPath}:`, error);
                return reject(error);
            }
        }));
    }
    /**
     * Dynamically loads a class from a given file path and creates a new instance.
     * @param filePath - The path to the module containing the class.
     * @param className - The name of the class to instantiate.
     * @param constructorArgs - Arguments to pass to the class constructor.
     * @returns A promise resolving to an instance of the loaded class.
     */
    static loadManifest(filePath, ...constructorArgs) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                // Dynamically import the module
                const module = yield (_a = filePath, Promise.resolve().then(() => __importStar(require(_a))));
                if (!module.default) {
                    throw new Error(`Default module not found in '${filePath}'.`);
                }
                // Create a new instance of the class with the given arguments
                const ClassReference = module.default;
                return resolve(new ClassReference(...constructorArgs));
            }
            catch (error) {
                console.error(`Error loading class default from file '${filePath}':`, error);
                return reject(error);
            }
        }));
    }
    /**
     * Dynamically loads csv into an array of any from a filepath.
     * @param filePath - The path to the module containing the class.
     * @returns A promise resolving to an instance of any array of rows from the csv file.
     */
    static loadCSV(filePath) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            const parser = fs_2.default.createReadStream(filePath)
                .pipe((0, csv_parse_1.parse)({
                delimiter: ',',
                columns: true,
                skip_empty_lines: true
            }));
            parser.on('data', (data) => {
                results.push(data);
            });
            parser.on('error', (err) => {
                console.error('Error reading CSV:', err);
            });
            yield new Promise((resolve) => {
                parser.on('end', () => {
                    resolve();
                });
            });
            return results;
        });
    }
    /*
        Asynchronously write data to a file on node fs and await closure before resolving
    */
    static writeFile(targetFilePath, data) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const writeStream = yield fs_1.promises.open(targetFilePath, 'w');
                const result = JSON.stringify(data);
                try {
                    yield writeStream.write(result);
                }
                catch (innerErr) {
                    console.error(innerErr);
                }
                finally {
                    yield writeStream.close();
                    setTimeout(() => {
                        return resolve(true);
                    }, 1);
                }
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    // simple funtion to return all files including sub directories in a given path
    static getAllFilePaths(directory) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                const filePaths = [];
                function traverse(dir) {
                    return __awaiter(this, void 0, void 0, function* () {
                        const entries = yield fs_1.promises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const fullPath = path.join(dir, entry.name);
                            if (entry.isDirectory()) {
                                // Recursively traverse subdirectories
                                yield traverse(fullPath);
                            }
                            else if (entry.isFile()) {
                                // Add file paths to the result array
                                filePaths.push(fullPath);
                            }
                        }
                    });
                }
                yield traverse(directory);
                return resolve(filePaths);
            }
            catch (err) {
                return reject(err);
            }
        }));
    }
    /*
        SYNCHRONOUS
        Ensures that a subdirectory exists within a root directory.
        If the subdirectory does not exist, it creates it.
    
        @param rootDirectory - The root directory path.
        @param subDirectoryName - The name of the subdirectory to check or create.
    */
    static ensureSubdirectoryExists(rootDirectory, subDirectoryName) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            // Resolve the full path to the subdirectory
            const subDirectoryPath = path.join(rootDirectory, subDirectoryName);
            try {
                // Check if the path exists and is a directory
                if (!fs_2.default.existsSync(subDirectoryPath)) {
                    fs_2.default.mkdirSync(subDirectoryPath, { recursive: true }); // Create the directory if it doesn't exist
                    console.log(`Directory created: ${subDirectoryPath}`);
                    setTimeout(() => {
                        return resolve(true);
                    }, 10);
                }
                else if (!fs_2.default.lstatSync(subDirectoryPath).isDirectory()) {
                    throw new Error(`The path ${subDirectoryPath} exists but is not a directory.`);
                }
                else {
                    console.log(`Directory already exists: ${subDirectoryPath}`);
                    setTimeout(() => {
                        return resolve(true);
                    }, 10);
                }
            }
            catch (error) {
                console.error(`Failed to ensure directory exists: ${error.message}`);
                return reject(false);
            }
        }));
    }
    // Given the input string, remove all instances of target array with empty string
    static emptyAllInstances(input, targets) {
        let output = input;
        targets.forEach((item) => {
            output = output.split(item).join('');
        });
        return output;
    }
    static sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(() => {
                return resolve(true);
            }, ms);
        });
    }
    static convertToInches(input) {
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
        if (feetMatch)
            feet = parseInt(feetMatch[1], 10);
        const inchesMatch = input.match(/-([0-9]+)/);
        if (inchesMatch)
            inches = parseInt(inchesMatch[1], 10);
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
    static getRandomIntBetween(min, max) {
        const lower = Math.ceil(min);
        const upper = Math.floor(max);
        return Math.floor(Math.random() * (upper - lower + 1)) + lower;
    }
    static newGuid() {
        const rand = `${process.pid}-${process.ppid}-${Date.now()}`;
        return (0, uuid_1.v4)();
    }
    static formatDateTimeForSqlServer(date) {
        if (!date) {
            return null;
        }
        const pad = (num, size = 2) => num.toString().padStart(size, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // Months are 0-based
        const day = pad(date.getDate());
        const hours = pad(date.getHours());
        const minutes = pad(date.getMinutes());
        const seconds = pad(date.getSeconds());
        const milliseconds = pad(date.getMilliseconds(), 3);
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
    }
    static formatDateForSqlServer(date) {
        if (!date) {
            return null;
        }
        const pad = (num) => num.toString().padStart(2, '0');
        const year = date.getFullYear();
        const month = pad(date.getMonth() + 1); // Months are 0-based
        const day = pad(date.getDate());
        return `${year}-${month}-${day}`;
    }
    static toBit(input) {
        if (!input) {
            return 0;
        }
        const test = input.toString();
        if (!test || test.length <= 0) {
            return 0;
        }
        if (test.trim().length <= 0) {
            return 0;
        }
        switch (test.trim().toLowerCase()) {
            case 'true':
            case 'yes':
            case '1':
            case 'y':
            case 'on':
                return 1;
            default:
                return 0;
        }
    }
    static safeString(input) {
        if (!input) {
            return null;
        }
        input = Utils.replaceAllInstances(input, "'", '`');
        input = Utils.replaceAllInstances(input, '"', '”');
        return input;
    }
    static toISODate(input) {
        if (!input) {
            return null;
        }
        try {
            const theDate = new Date(input);
            const today = new Date();
            if (theDate.getFullYear() < today.getFullYear()) {
                return null;
            }
            return `${theDate.getFullYear()}-${theDate.getMonth() + 1}-${theDate.getDate()}`;
        }
        catch (_a) {
            return null;
        }
    }
}
exports.Utils = Utils;
