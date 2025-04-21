export interface AwsPostTokenSchema {
    post_address: string
    post_parameters: AwsPostTokenParamSchema
}

export interface AwsPostTokenParamSchema {
    key: string
    "x-amz-meta-original-filename": string
    "policy": string
    "x-amz-credential": string
    "x-amz-algorithm": string
    "x-amz-date": string
    "x-amz-signature": string
}
