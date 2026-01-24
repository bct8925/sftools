export class AssertionError extends Error {
    constructor(
        message: string,
        public actual: unknown,
        public expected: unknown
    ) {
        super(message);
        this.name = 'AssertionError';
    }
}

export class Assertion<T> {
    private value: T;
    private isPromise: boolean;

    constructor(value: T | Promise<T>) {
        if (value instanceof Promise) {
            this.isPromise = true;
            this.value = value as unknown as T;
        } else {
            this.isPromise = false;
            this.value = value;
        }
    }

    private async resolve(): Promise<T> {
        if (this.isPromise) {
            return await (this.value as unknown as Promise<T>);
        }
        return this.value;
    }

    async toBe(expected: T): Promise<void> {
        const actual = await this.resolve();
        if (actual !== expected) {
            throw new AssertionError(
                `Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`,
                actual,
                expected
            );
        }
    }

    async toEqual(expected: T): Promise<void> {
        const actual = await this.resolve();
        const actualJson = JSON.stringify(actual);
        const expectedJson = JSON.stringify(expected);
        if (actualJson !== expectedJson) {
            throw new AssertionError(
                `Expected ${expectedJson} but got ${actualJson}`,
                actual,
                expected
            );
        }
    }

    async toBeTruthy(): Promise<void> {
        const actual = await this.resolve();
        if (!actual) {
            throw new AssertionError(
                `Expected truthy value but got ${JSON.stringify(actual)}`,
                actual,
                true
            );
        }
    }

    async toBeFalsy(): Promise<void> {
        const actual = await this.resolve();
        if (actual) {
            throw new AssertionError(
                `Expected falsy value but got ${JSON.stringify(actual)}`,
                actual,
                false
            );
        }
    }

    async toContain(expected: string): Promise<void> {
        const actual = await this.resolve();
        if (typeof actual !== 'string' || !actual.includes(expected)) {
            throw new AssertionError(
                `Expected "${actual}" to contain "${expected}"`,
                actual,
                expected
            );
        }
    }

    async toNotContain(expected: string): Promise<void> {
        const actual = await this.resolve();
        if (typeof actual !== 'string' || actual.includes(expected)) {
            throw new AssertionError(
                `Expected "${actual}" to not contain "${expected}"`,
                actual,
                expected
            );
        }
    }

    async toBeGreaterThan(expected: number): Promise<void> {
        const actual = await this.resolve();
        if (typeof actual !== 'number' || actual <= expected) {
            throw new AssertionError(
                `Expected ${actual} to be greater than ${expected}`,
                actual,
                expected
            );
        }
    }

    async toBeGreaterThanOrEqual(expected: number): Promise<void> {
        const actual = await this.resolve();
        if (typeof actual !== 'number' || actual < expected) {
            throw new AssertionError(
                `Expected ${actual} to be greater than or equal to ${expected}`,
                actual,
                expected
            );
        }
    }

    async toBeLessThan(expected: number): Promise<void> {
        const actual = await this.resolve();
        if (typeof actual !== 'number' || actual >= expected) {
            throw new AssertionError(
                `Expected ${actual} to be less than ${expected}`,
                actual,
                expected
            );
        }
    }

    async toHaveLength(expected: number): Promise<void> {
        const actual = await this.resolve();
        const length = (actual as unknown as { length: number }).length;
        if (length !== expected) {
            throw new AssertionError(
                `Expected length ${expected} but got ${length}`,
                length,
                expected
            );
        }
    }

    async toInclude(expected: unknown): Promise<void> {
        const actual = await this.resolve();
        if (!Array.isArray(actual) || !actual.includes(expected)) {
            throw new AssertionError(
                `Expected array to include ${JSON.stringify(expected)}`,
                actual,
                expected
            );
        }
    }
}
