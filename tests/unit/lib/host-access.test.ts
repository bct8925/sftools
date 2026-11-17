import { describe, it, expect, beforeEach } from 'vitest';
import { chromeMock } from '../mocks/chrome';
import {
    SALESFORCE_HOST_PATTERNS,
    ensureSalesforceHostAccess,
    hasHostAccess,
    isSalesforceHost,
} from '../../../src/lib/host-access';
import manifest from '../../../manifest.json';

Object.assign(globalThis, { chrome: chromeMock });

describe('lib/host-access', () => {
    beforeEach(() => {
        chromeMock._reset();
    });

    it('matches the optional host permissions in the manifest', () => {
        expect(manifest.optional_host_permissions).toEqual(SALESFORCE_HOST_PATTERNS);
    });

    describe('isSalesforceHost', () => {
        it.each([
            'https://login.salesforce.com/services/oauth2/token',
            'https://test.salesforce.com',
            'https://acme.my.salesforce.com',
            'https://acme--dev.sandbox.my.salesforce.com',
            'https://acme.lightning.force.com/x',
        ])('accepts %s', url => {
            expect(isSalesforceHost(url)).toBe(true);
        });

        it.each([
            'http://login.salesforce.com',
            'https://salesforce.com.evil.com',
            'https://evilsalesforce.com',
            'https://example.com',
            'not a url',
        ])('rejects %s', url => {
            expect(isSalesforceHost(url)).toBe(false);
        });
    });

    describe('hasHostAccess', () => {
        it('checks the URL origin', async () => {
            chromeMock.permissions.contains.mockResolvedValue(true);

            expect(await hasHostAccess('https://login.salesforce.com/services/oauth2/token')).toBe(
                true
            );
            expect(chromeMock.permissions.contains).toHaveBeenCalledWith({
                origins: ['https://login.salesforce.com/*'],
            });
        });

        it('is false for other hosts without asking Chrome', async () => {
            expect(await hasHostAccess('https://example.com/x')).toBe(false);
            expect(chromeMock.permissions.contains).not.toHaveBeenCalled();
        });

        it('is false when Chrome throws', async () => {
            chromeMock.permissions.contains.mockRejectedValue(new Error('nope'));
            expect(await hasHostAccess('https://login.salesforce.com')).toBe(false);
        });
    });

    describe('ensureSalesforceHostAccess', () => {
        it('does not ask again when access is already granted', async () => {
            chromeMock.permissions.contains.mockResolvedValue(true);

            expect(await ensureSalesforceHostAccess('https://login.salesforce.com')).toBe(true);
            expect(chromeMock.permissions.request).not.toHaveBeenCalled();
        });

        it('asks for the Salesforce patterns and returns the answer', async () => {
            chromeMock.permissions.request.mockResolvedValue(true);

            expect(await ensureSalesforceHostAccess('https://acme.my.salesforce.com')).toBe(true);
            expect(chromeMock.permissions.request).toHaveBeenCalledWith({
                origins: SALESFORCE_HOST_PATTERNS,
            });
        });

        it('is false when the user declines', async () => {
            expect(await ensureSalesforceHostAccess('https://login.salesforce.com')).toBe(false);
        });

        it('is false when Chrome refuses the request', async () => {
            chromeMock.permissions.request.mockRejectedValue(new Error('needs a user gesture'));
            expect(await ensureSalesforceHostAccess('https://login.salesforce.com')).toBe(false);
        });

        it('does not ask for a login domain outside the patterns', async () => {
            expect(await ensureSalesforceHostAccess('https://login.example.com')).toBe(false);
            expect(chromeMock.permissions.request).not.toHaveBeenCalled();
        });
    });
});
