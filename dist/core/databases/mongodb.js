"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContentMongoDb = exports.ObjectId = void 0;
const mongodb_1 = require("mongodb");
var mongodb_2 = require("mongodb");
Object.defineProperty(exports, "ObjectId", { enumerable: true, get: function () { return mongodb_2.ObjectId; } });
class ContentMongoDb {
    constructor(opts) {
        this.opts = opts;
        this.connected = false;
        this.client = new mongodb_1.MongoClient(this.opts.remoteuri, {
            appName: this.opts.appname,
            connectTimeoutMS: this.opts.timeout
        });
    }
    init() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.client.connect();
                const db = this.client.db(this.opts.dbname);
                this.connected = true;
                return resolve(true);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    attach(app) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                app.get('/api/mongodb/collections', (req, res) => {
                    return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
                        try {
                            if (!app.locals.mongodb) {
                                return res.status(400).json({
                                    message: `No Mongo Database in application`
                                });
                            }
                            const result = yield app.locals.mongodb.collectionsDetailed();
                            if (!result) {
                                return res.status(400).send({
                                    message: `Unable to retrieve list of collections from mongodb`
                                });
                            }
                            return res.status(200).json(result);
                        }
                        catch (err) {
                            console.error(err);
                            return res.status(500).json(err);
                        }
                    }));
                });
                return resolve(true);
            }
            catch (err) {
                console.error(err);
                return reject(err);
            }
        }));
    }
    collections() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const result = yield db.collections({ nameOnly: true });
                const mapped = result.map(s => {
                    return s.namespace;
                });
                return resolve(mapped);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    collectionsDetailed() {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const result = yield db.listCollections().toArray();
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    find(collectionName, filter, options) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.find(filter, options).toArray();
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    findOne(collectionName, filter, options) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.findOne(filter, options);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    replaceOne(collectionName, filter, replacementDocument, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.replaceOne(filter, replacementDocument, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    updateOne(collectionName, filter, patchedDocument, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.updateOne(filter, patchedDocument, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    findOneAndReplace(collectionName, filter, replacementDocument, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.findOneAndReplace(filter, replacementDocument, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    findOneAndUpdate(collectionName, filter, patchedDocument, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.findOneAndUpdate(filter, patchedDocument, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    aggregate(collectionName, pipeline, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.aggregate(pipeline, opts).toArray();
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    countDocuments(collectionName, filter, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.countDocuments(filter, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    estimatedDocumentCount(collectionName, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.estimatedDocumentCount(opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    insertMany(collectionName, docs, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.insertMany(docs, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    insertOne(collectionName, doc, opts) {
        return new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            try {
                if (!this.connected)
                    yield this.init();
                const db = this.client.db(this.opts.dbname);
                const collection = db.collection(collectionName);
                const result = yield collection.insertOne(doc, opts);
                return resolve(result);
            }
            catch (e) {
                return reject(e);
            }
        }));
    }
    destroy() {
        if (this.client) {
            this.client.close();
        }
    }
}
exports.ContentMongoDb = ContentMongoDb;
