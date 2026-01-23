// Salesforce API Response Mocks for testing
// Provides factory functions for common Salesforce API responses
// Shared between unit tests and frontend tests

/**
 * Create a mock fetch response
 */
export function createMockResponse(data, options = {}) {
    const { status = 200, ok = true } = options;
    return {
        ok,
        status,
        data,
        json: () => Promise.resolve(data),
        text: () => Promise.resolve(typeof data === 'string' ? data : JSON.stringify(data)),
    };
}

/**
 * Create a mock error response
 */
export function createErrorResponse(message, status = 400) {
    return {
        ok: false,
        status,
        data: [{ message, errorCode: 'ERROR' }],
        json: () => Promise.resolve([{ message, errorCode: 'ERROR' }]),
        text: () => Promise.resolve(JSON.stringify([{ message, errorCode: 'ERROR' }])),
    };
}

/**
 * Create standard Salesforce mock responses
 */
export function createSalesforceMocks() {
    return {
        /**
         * Mock SOQL query response
         */
        queryResponse(records, columnMetadata = null, entityName = null) {
            const response = {
                done: true,
                totalSize: records.length,
                records,
            };
            if (columnMetadata) {
                response.columnMetadata = columnMetadata;
            }
            if (entityName) {
                response.entityName = entityName;
            }
            return createMockResponse(response);
        },

        /**
         * Mock object describe response
         */
        objectDescribe(name, fields = []) {
            return createMockResponse({
                name,
                label: name,
                keyPrefix: '001',
                queryable: true,
                updateable: true,
                fields: fields.map(f => ({
                    name: f.name || f,
                    label: f.label || f.name || f,
                    type: f.type || 'string',
                    updateable: f.updateable !== false,
                    nillable: f.nillable !== false,
                    ...f,
                })),
            });
        },

        /**
         * Mock global describe response
         */
        globalDescribe(sobjects = []) {
            return createMockResponse({
                sobjects: sobjects.map(s => ({
                    name: s.name || s,
                    label: s.label || s.name || s,
                    keyPrefix: s.keyPrefix || '001',
                    queryable: s.queryable !== false,
                    ...(typeof s === 'object' ? s : {}),
                })),
            });
        },

        /**
         * Mock record response
         */
        recordResponse(record) {
            return createMockResponse({
                ...record,
                attributes: {
                    type: record.attributes?.type || 'SObject',
                    url:
                        record.attributes?.url ||
                        `/services/data/v59.0/sobjects/SObject/${record.Id}`,
                },
            });
        },

        /**
         * Mock record create response
         */
        createResponse(id, success = true) {
            return createMockResponse(
                {
                    id,
                    success,
                    errors: [],
                },
                { status: 201 }
            );
        },

        /**
         * Mock Apex execution response
         */
        apexExecutionResponse(compiled, success, log = '') {
            return createMockResponse({
                compiled,
                success,
                compileProblem: compiled ? null : 'Compilation error',
                exceptionMessage: success ? null : 'Exception occurred',
                exceptionStackTrace: success ? null : 'at line 1',
                line: compiled ? -1 : 1,
                column: compiled ? -1 : 1,
                log,
            });
        },

        /**
         * Mock composite response
         */
        compositeResponse(results) {
            return createMockResponse({
                compositeResponse: results.map((r, i) => ({
                    body: r.body || r,
                    httpStatusCode: r.status || 200,
                    referenceId: r.referenceId || `ref${i}`,
                })),
            });
        },

        /**
         * Mock tooling query response
         */
        toolingQueryResponse(records) {
            return createMockResponse({
                done: true,
                totalSize: records.length,
                records,
            });
        },
    };
}

/**
 * Helper to create a mock connection object
 */
export function createMockConnection(overrides = {}) {
    return {
        id: overrides.id || 'conn-123',
        label: overrides.label || 'Test Org',
        instanceUrl: overrides.instanceUrl || 'https://test.salesforce.com',
        loginDomain: overrides.loginDomain || 'https://login.salesforce.com',
        accessToken: overrides.accessToken || 'test-access-token',
        refreshToken: overrides.refreshToken || null,
        clientId: overrides.clientId || null,
        createdAt: overrides.createdAt || Date.now(),
        lastUsedAt: overrides.lastUsedAt || Date.now(),
        ...overrides,
    };
}
