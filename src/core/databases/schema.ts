export class Schema implements ISchema {

    name: string = ''
    type: DataType = DataType.string

    nullable: boolean = true
    primary: boolean = false

    enum?: any[] = undefined
    default?: any = undefined
    maxLength?: number | undefined = undefined
    minLength?: number | undefined = undefined
    pattern?: string | undefined = undefined
    format?: string | undefined = undefined // format: email, phone, uri, hostname, ipv4, ipv6, uuid, cidr, date, datetime
    maximum?: number | undefined = undefined
    minimum?: number | undefined = undefined
    multipleOf?: number | undefined = undefined
    properties: string[] = []

    constructor() {}

    static parse(text: string): ISchema | null {
        // name:any nullable enum=[]
        // name:string default="hello" maxLength=100 minLength=0 pattern="" format=""
        // name:number default=0 maximum=100 minimum=0 multipleOf=1
        // name:boolean default=true
        // name:date default="" min="" max=""
        // name:datetime default="" min="" max=""
        if (!text) return null
        const field = new Schema()

        const firstSpaceLocation = text.indexOf(' ')
        const firstColonLocation = text.indexOf(':')
        if (!firstSpaceLocation || firstSpaceLocation <= 0) {
            // assume least likely form of name:type or even just a name
            if (!firstColonLocation || firstColonLocation <= 0) {
                // just a name
                field.name = text
                return field
            }
            // name and data type only
            const splits = text.split(':')
            field.name = splits[0]
            field.type = Schema.getDataTypeFromString(splits[1])
            return field
        }
        // We have a name with data type with other optional fields filled
        const wholeParts = Schema.splitStringPreservingQuotes(text)
        for(let i = 0; i < wholeParts.length; i++) {
            let part = wholeParts[i]
            if (part) {
                part = part.trim()
                if (i === 0) {
                    // this must be name and data type, period
                    const splits = part.split(':')
                    field.name=splits[0]
                    field.type=Schema.getDataTypeFromString(splits[1])
                } else {
                    // this is an optional property
                    // Lets find the delimiter used
                    const delimiter = part.indexOf('=') > 0 ? '=' : ':'
                    const delimitedPos = part.indexOf(delimiter)
                    if (delimitedPos > 0) { // position of 0 would mean key is null so it would be invalid
                        const splits = part.split(delimiter)
                        // Look for the property
                        if (field.hasOwnProperty(splits[0])) {
                            const fieldAny: any = field
                            if (splits[0].toLowerCase()==='enum') {
                                fieldAny[splits[0]]=Schema.getEnumArray(splits[1])
                            } else {
                                fieldAny[splits[0]]=splits[1]
                            }
                        } else if (splits[0].toLowerCase()==='min') {
                            const fieldAny: any = field
                            const fieldName = field.type===DataType.string ? 'minLength':'minimum'
                            fieldAny[fieldName]=splits[1]
                        } else if (splits[0].toLowerCase()==='max') {
                            const fieldAny: any = field
                            const fieldName = field.type===DataType.string ? 'maxLength':'maximum'
                            fieldAny[fieldName]=splits[1]
                        }
                    } else {
                        // could be just a keyname that should become true like
                        // primary or nullable
                        if (part.toLowerCase()==='primary') {
                            field.primary = true
                            field.nullable = false
                        } else if (part.toLowerCase()==='nullable' || part.toLowerCase()==='null') {
                            field.nullable = true
                        } else if (part.toLowerCase()==='notnull') {
                            field.nullable = false
                        } else {
                            console.warn(`Could not parse string part ${part}`)
                        }
                    }
                }
            }
        }
        if (field.primary) field.nullable = false
        if (field.maximum && field.minimum !== undefined) {
            if (field.maximum < field.minimum) {
                field.maximum = field.minimum
            }
        }
        field.properties = Schema.properties(field)

        return field
    }

    static getEnumArray(input: string): any[] {
        // [1,2,3]
        if (!input) {
            return []
        }
        input = input.trim()
        input = input.replace('[', '')
        input = input.replace(']', '')
        const output: any[] = []
        const parts = input.split(',')
        parts.forEach((part: any) => {
            part = part.trim()
            if (part==='true') {
                output.push(true)
            } else if (part==='false') {
                output.push(false)
            } else {
                output.push(part)
            }
        })
        return output
    }

    static getDataTypeFromString(input: string): DataType {
        if (!input) return DataType.string
        // Handle nullable fields

        switch(input.toLowerCase()) {
            case 'string':
            case 'str':
            case 's':
                return DataType.string
            case 'number':
            case 'n':
            case 'num':
            case 'decimal':
            case 'dec':
            case 'float':
                return DataType.number
            case 'integer':
            case 'int':
            case 'i':
                return DataType.integer
            case 'currency':
            case 'money':
            case 'c':
                return DataType.currency
            case 'boolean':
            case 'bool':
            case 'b':
                return DataType.boolean
            case 'date':
            case 'd':
                return DataType.date
            case 'datetime':
            case 'dt':
                return DataType.datetime
            case 'uuid':
            case 'id':
            case 'unique':
            case 'u':
                return DataType.uuid
            default:
                return DataType.string
        }
    }

    static splitStringPreservingQuotes(input: string): string[] {
        const result: string[] = [];
        let currentSegment = '';
        let inQuotes = false;
      
        for (let i = 0; i < input.length; i++) {
          const char = input[i];
      
          if (char === '"') {
            inQuotes = !inQuotes; // Toggle inQuotes when encountering a double quote
          } else if (char === ' ' && !inQuotes) {
            // If it's a space and we're not inside quotes, split here
            if (currentSegment) {
              result.push(currentSegment);
              currentSegment = '';
            }
          } else {
            // Add the character to the current segment
            currentSegment += char;
          }
        }
      
        // Add the last segment if there's any left
        if (currentSegment) {
          result.push(currentSegment);
        }
      
        return result.map(segment => segment.replace(/"/g, '')); // Remove remaining double quotes
    }
    
    static properties(item: ISchema): string[] {
        const clone: any = Object.assign({}, item)
        delete clone.name
        delete clone.primary
        delete clone.type
        delete clone.nullable
        delete clone.props
        delete clone.properties

        const values: string[] = []
        const keys: string[] = Object.keys(clone)
        
        keys.forEach((key: string) => {
            if (clone[key]!==undefined) {
                if (key==='enum') {
                    values.push(`${key}: ${clone[key].join(', ')}`)
                } else {
                    values.push(`${key}: ${clone[key]}`)
                }
            }
        })
        return values
    }
    

    // #region Parsers
    // All Parse Operations return ISchema[]

    // JSON with field values of data types like "string" "GUID" "decimal" etc.
    // Assumes simple key value pair of keyname and data type
    // Example: {"id": "string", "name": "string", "desc": "string"}
    static parseEntityJson(entityName: string, text: string): ISchema[] {
        // let's figure out what the textarea contains
        let name = entityName
        const fields: ISchema[] = []

        // Start with hardcoded type as JSON
        try {
            const jsonified = JSON.parse(text)
            Object.keys(jsonified).forEach((key: string) => {
                const value = jsonified[key]
                if (typeof value==='string') {
                    // build the string
                    const result = Schema.parse(`${key}:${value}`)
                    if (!result) return
                    fields.push(result)
                }
            })    
            if (fields.length <= 0 || !name) return []
            //const entity = Schema.toJsonSchema(name, fields)
            //return entity
            return [...fields]
        } catch (err) {
            console.error(err)
            return []
        }        
    }

    // JSON Object with actual values and potential composite types like arrays or objects
    // No support outbound to sql etc for composite or iterable types
    // Example: {"id": "123", "name": "Steven", "desc": "Here we go"}
    static parseJsonDocument(entityName: string, input: any): ISchema[] {
        const output: ISchema[] = []
        if (!input) return output
        try {
            const countFields = input.match(new RegExp(':"', 'g'))
            if (!countFields || countFields.length <= 0) {
                input = input.replace(
                    /([a-zA-Z0-9_]+)\s*: /g,
                    (match: any, key: any) => `"${key}":`
                )
            }
            let inputParsed: any = null
            if (typeof input === 'object') {
                inputParsed = Object.assign({}, input)
            } else {
                console.log(`parseJsonDocument`)
                inputParsed = JSON.parse(input)
                console.log(`Successfully parsed JSON into Object`)    
            }
            const keys = Object.keys(inputParsed)
            if (!keys) return output
            
            console.dir(keys)
            keys.forEach((key: string) => {
                const value = inputParsed[key]
                const inferredType = this._inferType(value)
                const schema = this.parse(`${key}:${inferredType}`)
                if (!schema) return
                output.push(schema)
            })
            console.dir(output)
            return output
        } catch(err) {
            console.error(`Could not parse document: ${input}`)
            return output
        }
    }

    // From Sql CREATE DDL
    // Take CREATE TABLE statement from sql ide and convert into schema array of fields
    // Example: CREATE TABLE [dbo].[shoes] ([id] [varchar](8000) PRIMARY, [number] [varchar](8000) NULL); GO
    static parseSqlDDL(input: string): ISchema[] {
        const output: ISchema[] = []
        if (!input) return output
        input = input.trim()

        const firstParens = input.indexOf('(')
        const lastParens = input.lastIndexOf(')')
        const internalText = input.substring(firstParens + 1, lastParens)
        const lines = internalText.split(',')
        const formattedLines: string[] = []
        lines.forEach((line: string) => {
            let formatted = this._replaceAllInstances(line, '\\n', '')
            formatted = this._replaceAllInstances(formatted, '\\t', '')
            formatted = this._replaceAllInstances(formatted, '  ', ' ')
            formattedLines.push(formatted)
        })
        
        // At this point sample would be "[id] [varchar](8000) NULL" "[hasChildren] [bit] NULL"
        formattedLines.forEach((line: string) => {
            const parts = line.split(' ')
            if (!parts || parts.length < 2) return
            let name = parts[0]
            name = this._replaceAllInstances(name, '\\[', '')
            name = this._replaceAllInstances(name, '\\]', '')
            const datatype = this._fromSqlServerDataType(parts[1])
            const schema = this.parse(`${name}:${datatype.toString()}`)

            if (schema) {
                // TODO: default value, maxLength, other precision, constraints
                if (parts.indexOf('PRIMARY') > 0) {
                    schema.primary = true
                }
                if (parts.indexOf('NOT') > 0) {
                    const notLocation = parts.indexOf('NOT')
                    if (parts.length > notLocation - 1 && parts[notLocation+1].toUpperCase()==='NULL') {
                        schema.nullable = false
                    }
                }
                output.push(schema)
            }
        })
        return output
    }

    // Parse JSONSchema Object into ISchema[]
    static parseJSONSchema(entityName: string, input: any): ISchema[] {
        const output: ISchema[] = []
        if (!input || !entityName) return output
        try {
            const countFields = input.match(new RegExp(':"', 'g'))
            if (!countFields || countFields.length <= 0) {
                input = input.replace(
                    /([a-zA-Z0-9_]+)\s*: /g,
                    (match: any, key: any) => `"${key}":`
                )
            }
            let inputParsed: any = null
            if (typeof input === 'object') {
                inputParsed = Object.assign({}, input)
            } else {
                console.log(`parseJsonDocument`)
                inputParsed = JSON.parse(input)
                console.log(`Successfully parsed JSON into Object`)    
            }
            //properties
            const propsNode = inputParsed.properties
            if (!propsNode) {
                return output
            }
            const keys = Object.keys(propsNode)
            // keys holds the name of each properties
            keys.forEach((key: string) => {
                const schema: Schema | any = new Schema()
                schema.name = key
                const schemaNode = propsNode[key]
                const schemaKeys = Object.keys(schemaNode)
                schemaKeys.forEach((schemaKey: string) => {
                    // These are the individual JSONSchema property names that match schema
                    schema[schemaKey] = schemaNode[schemaKey]
                })
                output.push(schema)
            })
            return output
        } catch (err) {
            console.error(`Could not parse document: ${input}`)
            return output
        }
    }
    // #endregion

    // #region Composition
    // All Compose Operations take in an entity name and ISchema[]
    static toJsonSchema(entityName: string, items: ISchema[]): any {
        if (!items || !Array.isArray(items) || items.length <= 0) return undefined
        const output: any = {
            '$id': `urn:data:${entityName}`,
            '$schema': `https://json-schema.org/draft/2020-12/schema`,
            'type': 'object',
            title: entityName,
            description: `${entityName} schema`,
            properties: {}
        }
        const required: string[] = []
        items.forEach((item: ISchema) => {
            output.properties[item.name] = {}
            const keys = Object.keys(item)
            keys.forEach((key: string) => {
                let wasNull = false
                if (['name','primary','props', 'properties'].indexOf(key) < 0) {
                    const result = Schema.getFieldValueForKey(item, key)
                    if (result == null) {
                        wasNull = true
                    } else {
                        output.properties[item.name][key]=result
                    }
                } else if (key==='primary' && item[key]) {
                    output.properties[item.name]['$comment']=`primary`
                }
            })
            if (!item.nullable) {
                required.push(item.name)
            }
        })
        output.required = required
        const result = JSON.parse(JSON.stringify(output))
        return result
    }

    static toTypeScriptInterface(entityName: string, items: ISchema[]): any {
        if (!items || !Array.isArray(items) || items.length <= 0) return undefined
        const itemStrings = items.map((item: ISchema) => {
            return `\n\t${item.name}${item.nullable?'?':''}: ${Schema._toTypeScriptDataType(item.type)}`
        })
        const output = `export interface ${entityName} {${itemStrings.join(';')};\n}`
        return output
    }

    // TODO: Add validator method in class definition
    static toTypeScriptClass(entityName: string, items: ISchema[]): any {
        if (!items || !Array.isArray(items) || items.length <= 0) return undefined
        const itemStrings = items.map((item: ISchema) => {
            const itemDataType = Schema._toTypeScriptDataType(item.type)
            let itemString = `\n\t${item.name}${item.nullable?'?':''}: ${itemDataType}`
            if (item.default !== undefined && item.default !== null) {
                if (itemDataType==='string') {
                    itemString += ` = "${item.default}"`
                } else {
                    itemString += ` = ${item.default}`
                }
            } else {
                // No default set, let's set a default if not nullable
                if (!item.nullable) {
                    if (itemDataType==='string') {
                        itemString += ` = "${this._getTypeScriptDataTypeDefault(item.type)}"`
                    } else {
                        itemString += ` = ${this._getTypeScriptDataTypeDefault(item.type)}`
                    }
                }
            }
            return itemString
        })
        const output = `export class ${entityName} {${itemStrings.join(';')};\n}`
        return output
    }

    static toSqlServerDDL(entityName: string, items: ISchema[]): any {
        if (!items || !Array.isArray(items) || items.length <= 0) return undefined
        const itemStrings = items.map((item: ISchema) => {
            const itemDataType = Schema._toTypeScriptDataType(item.type)
            let itemString = `\n\t${this._toSqlServerColumnString(item)}`
            return itemString
        })
        const output = `CREATE TABLE ${entityName} (${itemStrings.join(',')}\n);`
        return output
    }
    // #endregion

    // #region Helper Methods and Privates
    // Helper Methods and Privates
    static getFieldValueForKey(item: any, key: string): any {
        if (!item || !key) return undefined
        //itemAny[key]
        switch(key) {
            case 'maxLength':
            case 'minLength':
            case 'maximum':
            case 'minimum':
                const numTextValue = item[key]
                if (isNaN(numTextValue)) {
                    return undefined
                }
                return +numTextValue
            case 'nullable':
                const nullableValue = item[key]
                if (typeof(nullableValue)==='boolean') return item[key]
                console.log(typeof(nullableValue))
                return nullableValue && nullableValue.toLowerCase()==='true'?true:false
            case 'type':
                const datatypeValue = item[key]
                switch(datatypeValue) {
                    case 'uuid':
                    case 'date':
                    case 'datetime':
                        return item.nullable?['string','null']:'string'
                    case 'integer':
                    case 'currency':
                        return item.nullable?['number','null']:'number'
                    case 'string':
                        return item.nullable?['string','null']:'string'
                    case 'boolean':
                        return item.nullable?['boolean','null']:'boolean'
                    default:
                        return datatypeValue
                }
            case 'default':
                const type = item.type as DataType
                switch(type) {
                    case DataType.boolean:
                        const boolTextValue = item[key]
                        return boolTextValue && boolTextValue.toLowerCase()==='true'?true:false
                    case DataType.number:
                    case DataType.integer:
                    case DataType.currency:
                        const numTextValue = item[key]
                        if (isNaN(numTextValue)) {
                            return undefined
                        }
                        return +numTextValue
                    default:
                        return item[key]
                }
            default:
                return item[key]
        }
    }

    static _toTypeScriptDataType(fieldType: DataType): string {
        switch (fieldType) {
            case DataType.boolean:
                return 'bool'
            case DataType.date:
                return 'Date'
            case DataType.datetime:
                return 'Date'
            case DataType.number:
            case DataType.integer:
            case DataType.currency:
                return 'number'
            case DataType.string:
            case DataType.uuid:
            default:
                return 'string'
        }
    }

    static _getTypeScriptDataTypeDefault(fieldType: DataType): any {
        switch (fieldType) {
            case DataType.boolean:
                return false
            case DataType.date:
                return "new Date()"
            case DataType.datetime:
                return "new Date()"
            case DataType.number:
            case DataType.integer:
            case DataType.currency:
                return 0
            case DataType.string:
            case DataType.uuid:
            default:
                return ''
        }
    }

    static _toSqlServerColumnString(item: ISchema): string {
        const fieldType = Array.isArray(item.type) ? item.type[0]:item.type
        let output = `[${item.name}]`
        switch (fieldType) {
            case DataType.boolean:
                output += ' BIT'
                break
            case DataType.date:
                output += ' DATE'
                break
            case DataType.datetime:
                output += ' DATETIME2(6)' // More precise milliseconds and smaller storage
                break
            case DataType.number:
                output += ' FLOAT'
                break
            case DataType.integer:
                output += ' INT'
                break
            case DataType.currency:
                output += ' DECIMAL(10, 2)'
                break
            case DataType.string:
                output += ' VARCHAR'
                break
            case DataType.uuid:
            default:
                console.log(`Unknown fieldType: ${fieldType}`)
                output += ' VARCHAR(50)'
                break
        }
        // Finish Datatype portion of string by setting max on NVARCHAR if it exists
        if (fieldType === DataType.string) {
            if (item.maxLength) {
                output += `(${item.maxLength})`
            } else {
                output += `(8000)`
            }
        }
        // Set Primary OR null not null
        if (item.primary) {
            output += ` PRIMARY`
        } else {
            if (item.nullable) {
                output += ' NULL'
            } else {
                output += ' NOT NULL'
            }
        }
        // Set Default if it exists
        if (item.default !== undefined && item.default !== null) {
            if (fieldType===DataType.string) {
                output += ` DEFAULT ('${item.default}')`
            } else {
                output += ` DEFAULT (${item.default})`
            }
        }
        // enum, format, maximum, minLength, minimum, multipleOf, pattern
        return output
    }

    static _fromSqlServerDataType(input: string): DataType {
        if (!input) return DataType.string
        input = this._replaceAllInstances(input, '\\[', '')
        input = this._replaceAllInstances(input, '\\]', '')
        if (input.indexOf('(')>0) {
            input = input.substring(0, input.indexOf('('))
        }
        switch (input.toLowerCase()) {
            case 'bit':
            case 'bool':
            case 'boolean':
                return DataType.boolean
            case 'smallmoney':
            case 'money':
                return DataType.currency
            case 'date':
                return DataType.date
            case 'datetime2':
            case 'datetime':
            case 'smalldatetime':
            case 'datetimeoffset':
                return DataType.datetime
            case 'real':
            case 'float':
            case 'double':
            case 'decimal':
            case 'dec':
            case 'timestamp':
            case 'numeric':
                return DataType.number
            case 'tinyint':
            case 'smallint':
            case 'mediumint':
            case 'int':
            case 'integer':
            case 'bigint':
            case 'year':
                return DataType.integer
            case 'uniqueidentifier':
                return DataType.uuid
            case 'char':
            case 'nchar':
            case 'binary':
            case 'varbinary':
            case 'varchar':
            case 'nvarchar':
            case 'tinyblob':
            case 'tinytext':
            case 'text':
            case 'ntext':
            case 'blob':
            case 'mediumtext':
            case 'mediumblob':
            case 'longtext':
            case 'longblob':
            case 'image':
            case 'time':
            case 'xml':
            default:
                return DataType.string
        }
    }

    static _inferType(value: any): string {
        if (Array.isArray(value)) return 'array'
        if (value === null) return 'null'
        return typeof value
    }

    static _replaceAllInstances(target: string, search: string, replacement: string): string {
        const regex = new RegExp(search, 'g')
        return target.replace(regex, replacement)
    }
    // #endregion

}

export interface ISchema {
    name: string
    type: DataType
    
    nullable?: boolean // true
    primary?: boolean  // false
    enum?: any[] // undefined
    default?: any // undefined
    maxLength?: number // undefined
    minLength?: number // undefined
    pattern?: string // undefined
    format?: string // undefined
    maximum?: number // undefined
    minimum?: number // undefined
    multipleOf?: number // undefined

    properties: string[] // initialize to empty array
}

export enum DataType {
    'uuid'='uuid', // string
    'string'='string',
    'number'='number',
    'integer'='integer', // number
    'currency'='currency', // number
    'boolean'='boolean',
    'date'='date', // string
    'datetime'='datetime' // string "2024-11-17T01:34:27Z"
}