/**
 * Shared Mocks - Main export point
 *
 * This module provides shared mock infrastructure for both unit tests and frontend tests.
 */

// Core mock data factories (used by both unit and frontend tests)
export {
    createMockResponse,
    createErrorResponse,
    createSalesforceMocks,
    createMockConnection
} from './mock-data.js';

// Playwright-specific adapter (used by frontend tests only)
export {
    MockRouter,
    createTestConnection
} from './playwright-adapter.js';

// Pre-built scenarios (used by frontend tests)
export {
    QuerySuccessScenario,
    QueryEmptyScenario,
    QueryErrorScenario,
    QueryEditableResultsScenario,
    QuerySubqueryScenario,
    ApexSuccessScenario,
    ApexCompileErrorScenario,
    ApexCompileErrorDetailedScenario,
    ApexRuntimeErrorScenario,
    AccountDescribeScenario,
    RecordViewerScenario,
    RecordDescribeVariousFieldsScenario,
    GlobalDescribeScenario,
    RestApiGetScenario,
    RestApiPostScenario,
    RestApiEmptyScenario
} from './mock-scenarios.js';
