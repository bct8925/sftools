// Salesforce Connection
export interface SalesforceConnection {
    id: string;
    label: string;
    instanceUrl: string;
    loginDomain: string;
    accessToken: string;
    refreshToken: string | null;
    clientId: string | null;
    createdAt: number;
    lastUsedAt: number;
}

// Query Results
export interface QueryResult<T = SObject> {
    totalSize: number;
    done: boolean;
    records: T[];
    nextRecordsUrl?: string;
}

export interface ColumnMetadata {
    columnName: string;
    displayName: string;
    aggregate: boolean;
    joinColumns?: ColumnMetadata[];
}

// Generic SObject
export interface SObject {
    Id: string;
    attributes?: {
        type: string;
        url: string;
    };
    [key: string]: unknown;
}

// Describe Global Results
export interface DescribeGlobalResult {
    encoding: string;
    maxBatchSize: number;
    sobjects: SObjectDescribe[];
}

export interface SObjectDescribe {
    name: string;
    label: string;
    labelPlural: string;
    keyPrefix: string | null;
    custom: boolean;
    customSetting: boolean;
    queryable: boolean;
    createable: boolean;
    updateable: boolean;
    deletable: boolean;
    searchable: boolean;
}

// Object Describe Results
export interface ObjectDescribeResult {
    name: string;
    label: string;
    fields: FieldDescribe[];
    childRelationships: ChildRelationship[];
    recordTypeInfos: RecordTypeInfo[];
}

export interface FieldDescribe {
    name: string;
    label: string;
    type: FieldType;
    length: number;
    precision: number;
    scale: number;
    nillable: boolean;
    updateable: boolean;
    createable: boolean;
    calculated: boolean;
    nameField: boolean;
    referenceTo: string[];
    relationshipName: string | null;
    picklistValues?: PicklistValue[];
    defaultValue?: unknown;
}

export type FieldType =
    | 'string'
    | 'boolean'
    | 'int'
    | 'double'
    | 'date'
    | 'datetime'
    | 'time'
    | 'currency'
    | 'percent'
    | 'phone'
    | 'email'
    | 'url'
    | 'textarea'
    | 'picklist'
    | 'multipicklist'
    | 'combobox'
    | 'reference'
    | 'id'
    | 'base64'
    | 'address'
    | 'location'
    | 'encryptedstring'
    | 'html';

export interface PicklistValue {
    value: string;
    label: string;
    active: boolean;
    defaultValue: boolean;
}

export interface ChildRelationship {
    relationshipName: string | null;
    childSObject: string;
    field: string;
}

export interface RecordTypeInfo {
    recordTypeId: string;
    name: string;
    available: boolean;
    master: boolean;
}

// Apex Execution
export interface ApexExecutionResult {
    success: boolean;
    compiled: boolean;
    compileProblem: string | null;
    exceptionMessage: string | null;
    exceptionStackTrace: string | null;
    line: number;
    column: number;
}

// Request/Response
export interface SalesforceRequestOptions {
    method?: string;
    params?: Record<string, string>;
    body?: string;
    headers?: Record<string, string>;
}

export interface SalesforceRequestResult<T = unknown> {
    json: T;
    status: number;
}

// REST API Response
export interface RestApiResponse<T = unknown> {
    success: boolean;
    status: number;
    statusText: string;
    error?: string;
    data: T;
    raw: string;
}

// Tooling API
export interface ToolingQueryResult<T = unknown> {
    size: number;
    totalSize: number;
    done: boolean;
    records: T[];
    nextRecordsUrl?: string;
}

// Debug Logs
export interface DebugLog {
    Id: string;
    LogUser: { Name: string };
    Operation: string;
    Application: string;
    Status: string;
    LogLength: number;
    StartTime: string;
}

// Flow Definition
export interface FlowDefinition {
    Id: string;
    DeveloperName: string;
    ActiveVersionId: string | null;
    LatestVersionId: string;
    VersionNumber: number;
}

export interface FlowVersion {
    Id: string;
    VersionNumber: number;
    Status: string;
}
