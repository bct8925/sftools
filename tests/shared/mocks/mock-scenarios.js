/**
 * Mock Scenarios - Pre-built mock configurations for common test cases
 *
 * Each scenario defines a set of routes that can be applied to a MockRouter.
 * Use these for common patterns to keep tests DRY.
 */

/**
 * Basic query success scenario
 * Returns a single Account record
 */
export const QuerySuccessScenario = {
    name: 'query-success',
    routes: [
        {
            pattern: /\/query\/?\?.*columns=true/,
            method: 'GET',
            response: {
                columnMetadata: [
                    { columnName: 'Id', displayName: 'Id', aggregate: false },
                    { columnName: 'Name', displayName: 'Name', aggregate: false }
                ],
                entityName: 'Account'
            }
        },
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 1,
                records: [
                    { Id: '001MOCKACCOUNT01', Name: 'Test Account' }
                ]
            }
        }
    ]
};

/**
 * Query with no results
 */
export const QueryEmptyScenario = {
    name: 'query-empty',
    routes: [
        {
            pattern: /\/query\/?\?.*columns=true/,
            method: 'GET',
            response: {
                columnMetadata: [
                    { columnName: 'Id', displayName: 'Id', aggregate: false }
                ],
                entityName: 'Account'
            }
        },
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 0,
                records: []
            }
        }
    ]
};

/**
 * Query with error
 */
export const QueryErrorScenario = {
    name: 'query-error',
    routes: [
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                status: 400,
                data: [
                    {
                        message: 'No such column \'InvalidField\' on entity \'Account\'',
                        errorCode: 'INVALID_FIELD'
                    }
                ]
            }
        }
    ]
};

/**
 * Successful Apex execution
 */
export const ApexSuccessScenario = {
    name: 'apex-success',
    routes: [
        {
            pattern: /\/tooling\/executeAnonymous/,
            method: 'GET',
            response: {
                compiled: true,
                success: true,
                compileProblem: null,
                exceptionMessage: null,
                exceptionStackTrace: null,
                line: -1,
                column: -1,
                log: 'USER_DEBUG|Hello from Apex\nUSER_DEBUG|Execution complete'
            }
        }
    ]
};

/**
 * Apex compilation error
 */
export const ApexCompileErrorScenario = {
    name: 'apex-compile-error',
    routes: [
        {
            pattern: /\/tooling\/executeAnonymous/,
            method: 'GET',
            response: {
                compiled: false,
                success: false,
                compileProblem: 'Unexpected token \'}\'',
                exceptionMessage: null,
                exceptionStackTrace: null,
                line: 3,
                column: 5,
                log: ''
            }
        }
    ]
};

/**
 * Apex runtime error
 */
export const ApexRuntimeErrorScenario = {
    name: 'apex-runtime-error',
    routes: [
        {
            pattern: /\/tooling\/executeAnonymous/,
            method: 'GET',
            response: {
                compiled: true,
                success: false,
                compileProblem: null,
                exceptionMessage: 'System.NullPointerException: Attempt to de-reference a null object',
                exceptionStackTrace: 'AnonymousBlock: line 3, column 1',
                line: -1,
                column: -1,
                log: 'USER_DEBUG|Starting execution\nERROR|Exception occurred'
            }
        }
    ]
};

/**
 * Object describe for Account
 */
export const AccountDescribeScenario = {
    name: 'account-describe',
    routes: [
        {
            pattern: /\/sobjects\/Account\/describe/,
            method: 'GET',
            response: {
                name: 'Account',
                label: 'Account',
                keyPrefix: '001',
                queryable: true,
                updateable: true,
                fields: [
                    { name: 'Id', label: 'Id', type: 'id', updateable: false, nillable: false },
                    { name: 'Name', label: 'Name', type: 'string', updateable: true, nillable: false },
                    { name: 'Type', label: 'Type', type: 'picklist', updateable: true, nillable: true },
                    { name: 'Industry', label: 'Industry', type: 'picklist', updateable: true, nillable: true }
                ]
            }
        }
    ]
};

/**
 * Record retrieval success
 */
export const RecordViewerScenario = {
    name: 'record-viewer',
    routes: [
        {
            pattern: /\/sobjects\/Account\/describe/,
            method: 'GET',
            response: {
                name: 'Account',
                label: 'Account',
                keyPrefix: '001',
                fields: [
                    { name: 'Id', label: 'Id', type: 'id', updateable: false },
                    { name: 'Name', label: 'Name', type: 'string', updateable: true },
                    { name: 'Phone', label: 'Phone', type: 'phone', updateable: true }
                ]
            }
        },
        {
            pattern: /\/sobjects\/Account\/001MOCKACCOUNT01/,
            method: 'GET',
            response: {
                Id: '001MOCKACCOUNT01',
                Name: 'Acme Corporation',
                Phone: '555-1234',
                attributes: {
                    type: 'Account',
                    url: '/services/data/v62.0/sobjects/Account/001MOCKACCOUNT01'
                }
            }
        }
    ]
};

/**
 * Global describe with common objects
 */
export const GlobalDescribeScenario = {
    name: 'global-describe',
    routes: [
        {
            pattern: /\/sobjects\/?$/,
            method: 'GET',
            response: {
                sobjects: [
                    { name: 'Account', label: 'Account', keyPrefix: '001', queryable: true },
                    { name: 'Contact', label: 'Contact', keyPrefix: '003', queryable: true },
                    { name: 'Opportunity', label: 'Opportunity', keyPrefix: '006', queryable: true },
                    { name: 'Lead', label: 'Lead', keyPrefix: '00Q', queryable: true },
                    { name: 'Case', label: 'Case', keyPrefix: '500', queryable: true }
                ]
            }
        }
    ]
};

/**
 * REST API GET success
 */
export const RestApiGetScenario = {
    name: 'rest-api-get',
    routes: [
        {
            pattern: /\/sobjects$/,
            method: 'GET',
            response: {
                sobjects: [
                    { name: 'Account', label: 'Account' },
                    { name: 'Contact', label: 'Contact' }
                ]
            }
        }
    ]
};

/**
 * REST API POST success (record creation)
 */
export const RestApiPostScenario = {
    name: 'rest-api-post',
    routes: [
        {
            pattern: /\/sobjects\/Account$/,
            method: 'POST',
            response: {
                status: 201,
                data: {
                    id: '001NEWRECORD0001',
                    success: true,
                    errors: []
                }
            }
        }
    ]
};

/**
 * Query with editable results
 * Returns Account records with various field types suitable for edit mode testing
 */
export const QueryEditableResultsScenario = {
    name: 'query-editable-results',
    routes: [
        {
            pattern: /\/query\/?\?.*columns=true/,
            method: 'GET',
            response: {
                columnMetadata: [
                    { columnName: 'Id', displayName: 'Id', aggregate: false },
                    { columnName: 'Name', displayName: 'Name', aggregate: false },
                    { columnName: 'Phone', displayName: 'Phone', aggregate: false },
                    { columnName: 'AnnualRevenue', displayName: 'Annual Revenue', aggregate: false },
                    { columnName: 'Type', displayName: 'Type', aggregate: false }
                ],
                entityName: 'Account'
            }
        },
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 2,
                records: [
                    {
                        Id: '001MOCKACCOUNT01',
                        Name: 'Acme Corporation',
                        Phone: '555-1234',
                        AnnualRevenue: 1000000,
                        Type: 'Customer - Direct'
                    },
                    {
                        Id: '001MOCKACCOUNT02',
                        Name: 'Global Industries',
                        Phone: '555-5678',
                        AnnualRevenue: 5000000,
                        Type: 'Partner'
                    }
                ]
            }
        }
    ]
};

/**
 * Query with subquery data
 * Returns Account records with nested Contact subqueries for expand/collapse testing
 */
export const QuerySubqueryScenario = {
    name: 'query-subquery',
    routes: [
        {
            pattern: /\/query\/?\?.*columns=true/,
            method: 'GET',
            response: {
                columnMetadata: [
                    { columnName: 'Id', displayName: 'Id', aggregate: false },
                    { columnName: 'Name', displayName: 'Name', aggregate: false },
                    {
                        columnName: 'Contacts',
                        displayName: 'Contacts',
                        aggregate: true,
                        joinColumns: [
                            { columnName: 'Id', displayName: 'Id', aggregate: false },
                            { columnName: 'FirstName', displayName: 'First Name', aggregate: false },
                            { columnName: 'LastName', displayName: 'Last Name', aggregate: false },
                            { columnName: 'Email', displayName: 'Email', aggregate: false }
                        ]
                    }
                ],
                entityName: 'Account'
            }
        },
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 2,
                records: [
                    {
                        Id: '001MOCKACCOUNT01',
                        Name: 'Acme Corporation',
                        Contacts: {
                            totalSize: 2,
                            done: true,
                            records: [
                                {
                                    Id: '003MOCKCONTACT01',
                                    FirstName: 'John',
                                    LastName: 'Doe',
                                    Email: 'john.doe@acme.com'
                                },
                                {
                                    Id: '003MOCKCONTACT02',
                                    FirstName: 'Jane',
                                    LastName: 'Smith',
                                    Email: 'jane.smith@acme.com'
                                }
                            ]
                        }
                    },
                    {
                        Id: '001MOCKACCOUNT02',
                        Name: 'Global Industries',
                        Contacts: {
                            totalSize: 1,
                            done: true,
                            records: [
                                {
                                    Id: '003MOCKCONTACT03',
                                    FirstName: 'Bob',
                                    LastName: 'Johnson',
                                    Email: 'bob.johnson@global.com'
                                }
                            ]
                        }
                    }
                ]
            }
        }
    ]
};

/**
 * Apex compilation error with detailed line/column info
 * For testing error marker display in Monaco editor
 */
export const ApexCompileErrorDetailedScenario = {
    name: 'apex-compile-error-detailed',
    routes: [
        {
            pattern: /\/tooling\/executeAnonymous/,
            method: 'GET',
            response: {
                compiled: false,
                success: false,
                compileProblem: 'Variable does not exist: accnt',
                exceptionMessage: null,
                exceptionStackTrace: null,
                line: 5,
                column: 15,
                log: ''
            }
        }
    ]
};

/**
 * Object describe with various field types
 * For testing record viewer field rendering
 */
export const RecordDescribeVariousFieldsScenario = {
    name: 'record-describe-various-fields',
    routes: [
        {
            pattern: /\/sobjects\/Account\/describe/,
            method: 'GET',
            response: {
                name: 'Account',
                label: 'Account',
                keyPrefix: '001',
                queryable: true,
                updateable: true,
                fields: [
                    { name: 'Id', label: 'Record ID', type: 'id', updateable: false, nillable: false },
                    { name: 'Name', label: 'Account Name', type: 'string', updateable: true, nillable: false },
                    { name: 'Phone', label: 'Phone', type: 'phone', updateable: true, nillable: true },
                    { name: 'AnnualRevenue', label: 'Annual Revenue', type: 'currency', updateable: true, nillable: true },
                    { name: 'NumberOfEmployees', label: 'Employees', type: 'int', updateable: true, nillable: true },
                    { name: 'Active__c', label: 'Active', type: 'boolean', updateable: true, nillable: false },
                    { name: 'CreatedDate', label: 'Created Date', type: 'datetime', updateable: false, nillable: false },
                    { name: 'LastModifiedDate', label: 'Last Modified', type: 'datetime', updateable: false, nillable: false },
                    { name: 'Type', label: 'Account Type', type: 'picklist', updateable: true, nillable: true },
                    { name: 'Industry', label: 'Industry', type: 'picklist', updateable: true, nillable: true },
                    { name: 'Description', label: 'Description', type: 'textarea', updateable: true, nillable: true },
                    { name: 'Website', label: 'Website', type: 'url', updateable: true, nillable: true },
                    { name: 'BillingAddress', label: 'Billing Address', type: 'address', updateable: true, nillable: true }
                ]
            }
        },
        {
            pattern: /\/sobjects\/Account\/001MOCKACCOUNT01/,
            method: 'GET',
            response: {
                Id: '001MOCKACCOUNT01',
                Name: 'Acme Corporation',
                Phone: '555-1234',
                AnnualRevenue: 1000000,
                NumberOfEmployees: 50,
                Active__c: true,
                CreatedDate: '2024-01-15T10:30:00.000+0000',
                LastModifiedDate: '2024-12-20T14:45:00.000+0000',
                Type: 'Customer - Direct',
                Industry: 'Technology',
                Description: 'Leading provider of innovative solutions',
                Website: 'https://www.acme.com',
                BillingAddress: {
                    street: '123 Main St',
                    city: 'San Francisco',
                    state: 'CA',
                    postalCode: '94105',
                    country: 'USA'
                },
                attributes: {
                    type: 'Account',
                    url: '/services/data/v62.0/sobjects/Account/001MOCKACCOUNT01'
                }
            }
        }
    ]
};

/**
 * Empty REST API responses
 * For testing empty state handling
 */
export const RestApiEmptyScenario = {
    name: 'rest-api-empty',
    routes: [
        {
            pattern: /\/sobjects$/,
            method: 'GET',
            response: {
                sobjects: []
            }
        },
        {
            pattern: /\/query/,
            method: 'GET',
            response: {
                done: true,
                totalSize: 0,
                records: []
            }
        },
        {
            pattern: /\/sobjects\/Account\/001MOCKACCOUNT01/,
            method: 'GET',
            response: {
                status: 404,
                data: [
                    {
                        message: 'The requested resource does not exist',
                        errorCode: 'NOT_FOUND'
                    }
                ]
            }
        }
    ]
};
