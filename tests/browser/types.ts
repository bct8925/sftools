/**
 * Test configuration types for browser tests
 */

/**
 * Configuration for test timing and delays
 */
export interface TestConfig {
    delays: {
        beforeClick: number;
        afterClick: number;
        beforeType: number;
        afterNavigation: number;
        afterPageLoad: number;
    };
}

/**
 * Default config with no delays (fast execution)
 */
export const DEFAULT_CONFIG: TestConfig = {
    delays: {
        beforeClick: 0,
        afterClick: 0,
        beforeType: 0,
        afterNavigation: 0,
        afterPageLoad: 0,
    },
};

