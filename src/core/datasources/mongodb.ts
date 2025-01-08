import { AggregateOptions, BulkWriteOptions, 
    CountDocumentsOptions, Db, EstimatedDocumentCountOptions, 
    FindOneAndReplaceOptions, FindOneAndUpdateOptions, FindOptions, InsertManyResult, InsertOneOptions, 
    MongoClient, ReplaceOptions, UpdateOptions } from 'mongodb'
import * as express from 'express'

export { ObjectId } from 'mongodb'

export interface IMongoConfig {
    remoteuri: string
    dbname: string
    appname: string
    timeout: number
}

export class ContentMongoDb {

    private connected: boolean = false
    private client: MongoClient = new MongoClient(this.opts.remoteuri, {
        appName: this.opts.appname,
        connectTimeoutMS: this.opts.timeout
    })

    constructor(private opts: IMongoConfig) {}
    
    public init () {
        return new Promise(async(resolve, reject) => {
            try {
                await this.client.connect()

                const db: Db = this.client.db(this.opts.dbname)
                this.connected = true
                return resolve(true)
            } catch (e: any) {
                return reject(e)
            }
        })
    }

    public attach(app: express.Application): Promise<any> {
        return new Promise(async(resolve, reject) => {
            try {
                app.get('/api/mongodb/collections', (req, res) => {
                    return new Promise(async(resolve, reject) => {
                        try {
                            if (!app.locals.mongodb) {
                                return res.status(400).json({
                                    message: `No Mongo Database in application`
                                })
                            }

                            const result = await app.locals.mongodb.collectionsDetailed()
                            if (!result) {
                                return res.status(400).send({
                                    message: `Unable to retrieve list of collections from mongodb`
                                })
                            }
                            return res.status(200).json(result)
                        } catch (err) {
                            console.error(err)
                            return res.status(500).json(err)
                        }
                    })
                })
                return resolve(true)
            } catch (err) {
                console.error(err)
                return reject(err)
            }
        })
    }

    public collections(): Promise<Array<any>|Error> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const result = await db.collections({nameOnly: true})
                const mapped = result.map(s => {
                    return s.namespace
                })
                return resolve(mapped)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public collectionsDetailed(): Promise<Array<any>|Error> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const result = await db.listCollections().toArray()
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }


    public find(collectionName: string, filter: any, options?: FindOptions): Promise<Array<any>|Error> {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.find(filter, options).toArray()
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public findOne(collectionName: string, filter: any, options?: FindOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.findOne(filter, options)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public replaceOne(collectionName: string, filter: any, replacementDocument: any, opts?: ReplaceOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.replaceOne(filter, replacementDocument, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public updateOne(collectionName: string, filter: any, patchedDocument: any, opts?: UpdateOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.updateOne(filter, patchedDocument, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public findOneAndReplace(collectionName: string, filter: any, replacementDocument: any, opts: FindOneAndReplaceOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.findOneAndReplace(filter, replacementDocument, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public findOneAndUpdate(collectionName: string, filter: any, patchedDocument: any, opts: FindOneAndUpdateOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.findOneAndUpdate(filter, patchedDocument, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public aggregate(collectionName: string, pipeline: Array<any>, opts?: AggregateOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.aggregate(pipeline, opts).toArray()
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public countDocuments(collectionName: string, filter: any, opts?: CountDocumentsOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.countDocuments(filter, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public estimatedDocumentCount(collectionName: string, opts?: EstimatedDocumentCountOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.estimatedDocumentCount(opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public insertMany(collectionName: string, docs: Array<any>, opts?: BulkWriteOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.insertMany(docs, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public insertOne(collectionName: string, doc: any, opts: InsertOneOptions) {
        return new Promise(async(resolve, reject) => {
            try {
                if (!this.connected) await this.init()
                const db = this.client.db(this.opts.dbname)
                const collection = db.collection(collectionName)
                const result = await collection.insertOne(doc, opts)
                return resolve(result)
            } catch (e) {
                return reject(e)
            }
        })
    }

    public destroy() {
        if (this.client) {
            this.client.close()
        }
    }

}
