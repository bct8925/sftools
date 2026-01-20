/**
 * Tests for src/lib/background-utils.js
 *
 * Test IDs: BG-U-001 through BG-U-037
 * - BG-U-001: parseLightningUrl() - Extracts objectType and recordId from valid Lightning record URLs
 * - BG-U-002: parseLightningUrl() - Returns null for invalid URLs
 * - BG-U-003: extractOrgIdentifier() - Extracts sandbox identifier
 * - BG-U-004: extractOrgIdentifier() - Extracts scratch org identifier
 * - BG-U-005: extractOrgIdentifier() - Extracts trailhead org identifier
 * - BG-U-006: findConnectionByDomain() - Matches connection by hostname or org identifier
 * - BG-U-007: findConnectionByDomain() - Returns null when no match found
 * - BG-U-008: extractOrgIdentifier() - Extracts production org identifier from lightning.force.com
 * - BG-U-009: extractOrgIdentifier() - Extracts production org identifier from my.salesforce.com
 * - BG-U-010: extractOrgIdentifier() - Extracts developer edition org identifier
 * - BG-U-011: extractOrgIdentifier() - Extracts demo org identifier
 * - BG-U-012: extractOrgIdentifier() - Returns lowercase identifier
 * - BG-U-013: extractOrgIdentifier() - Returns null for non-Salesforce domain
 * - BG-U-014: extractOrgIdentifier() - Returns null for partial Salesforce domain
 * - BG-U-015: extractOrgIdentifier() - Returns null for empty string
 * - BG-U-016: findConnectionByDomain() - Handles connections with malformed instanceUrl gracefully
 * - BG-U-017: findConnectionByDomain() - Matches first connection when multiple match
 */

import { describe, it, expect } from 'vitest';
import {
    parseLightningUrl,
    extractOrgIdentifier,
    findConnectionByDomain
} from '../../../src/lib/background-utils.js';

describe('parseLightningUrl', () => {
    it('BG-U-001: extracts objectType and recordId from Lightning record URL', () => {
        const url = 'https://example.my.salesforce.com/lightning/r/Account/001abc000012345678/view';
        const result = parseLightningUrl(url);

        expect(result).toEqual({
            objectType: 'Account',
            recordId: '001abc000012345678'
        });
    });

    it('BG-U-001: handles 15-character record IDs', () => {
        const url = '/lightning/r/Contact/003abc000012345/view';
        const result = parseLightningUrl(url);

        expect(result).toEqual({
            objectType: 'Contact',
            recordId: '003abc000012345'
        });
    });

    it('BG-U-001: handles custom object URLs', () => {
        const url = '/lightning/r/Custom_Object__c/a00abc000012345678/view';
        const result = parseLightningUrl(url);

        expect(result).toEqual({
            objectType: 'Custom_Object__c',
            recordId: 'a00abc000012345678'
        });
    });

    it('BG-U-001: handles namespace prefixed objects', () => {
        const url = '/lightning/r/ns__Custom_Object__c/a00abc000012345678/view';
        const result = parseLightningUrl(url);

        expect(result).toEqual({
            objectType: 'ns__Custom_Object__c',
            recordId: 'a00abc000012345678'
        });
    });

    it('BG-U-002: returns null for non-Lightning URL', () => {
        const url = 'https://example.my.salesforce.com/apex/CustomPage';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });

    it('BG-U-002: returns null for Lightning home URL', () => {
        const url = '/lightning/page/home';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });

    it('BG-U-002: returns null for Lightning edit URL', () => {
        const url = '/lightning/r/Account/001abc000012345678/edit';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });

    it('BG-U-002: returns null for invalid record ID length', () => {
        const url = '/lightning/r/Account/001abc/view';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });

    it('BG-U-002: returns null for empty string', () => {
        const url = '';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });

    it('BG-U-002: returns null for list view URL', () => {
        const url = '/lightning/o/Account/list';
        const result = parseLightningUrl(url);

        expect(result).toBeNull();
    });
});

describe('extractOrgIdentifier', () => {
    it('BG-U-003: extracts sandbox identifier from lightning.force.com', () => {
        const hostname = 'mysandbox.sandbox.lightning.force.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('mysandbox');
    });

    it('BG-U-003: extracts sandbox identifier from my.salesforce.com', () => {
        const hostname = 'mysandbox.sandbox.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('mysandbox');
    });

    it('BG-U-004: extracts scratch org identifier from lightning.force.com', () => {
        const hostname = 'scratch123.scratch.lightning.force.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('scratch123');
    });

    it('BG-U-004: extracts scratch org identifier from my.salesforce.com', () => {
        const hostname = 'scratch456.scratch.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('scratch456');
    });

    it('BG-U-005: extracts trailhead org identifier from lightning.force.com', () => {
        const hostname = 'trailhead123.trailblaze.lightning.force.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('trailhead123');
    });

    it('BG-U-005: extracts trailhead org identifier from my.salesforce.com', () => {
        const hostname = 'trailhead456.trailblaze.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('trailhead456');
    });

    it('BG-U-008: extracts production org identifier from lightning.force.com', () => {
        const hostname = 'myorg.lightning.force.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('myorg');
    });

    it('BG-U-009: extracts production org identifier from my.salesforce.com', () => {
        const hostname = 'myorg.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('myorg');
    });

    it('BG-U-010: extracts developer edition org identifier', () => {
        const hostname = 'devorg.develop.lightning.force.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('devorg');
    });

    it('BG-U-011: extracts demo org identifier', () => {
        const hostname = 'demoorg.demo.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('demoorg');
    });

    it('BG-U-012: returns lowercase identifier', () => {
        const hostname = 'MyOrg.my.salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBe('myorg');
    });

    it('BG-U-013: returns null for non-Salesforce domain', () => {
        const hostname = 'example.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBeNull();
    });

    it('BG-U-014: returns null for partial Salesforce domain', () => {
        const hostname = 'salesforce.com';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBeNull();
    });

    it('BG-U-015: returns null for empty string', () => {
        const hostname = '';
        const result = extractOrgIdentifier(hostname);

        expect(result).toBeNull();
    });
});

describe('findConnectionByDomain', () => {
    const mockConnections = [
        {
            id: 'conn-1',
            label: 'Production',
            instanceUrl: 'https://myorg.my.salesforce.com'
        },
        {
            id: 'conn-2',
            label: 'Sandbox',
            instanceUrl: 'https://mysandbox.sandbox.lightning.force.com'
        },
        {
            id: 'conn-3',
            label: 'Scratch',
            instanceUrl: 'https://scratch123.scratch.my.salesforce.com'
        }
    ];

    it('BG-U-006: matches by exact hostname', () => {
        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toEqual(mockConnections[0]);
    });

    it('BG-U-006: matches by exact hostname from full URL', () => {
        const domain = 'https://myorg.my.salesforce.com/lightning/r/Account/001abc/view';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toEqual(mockConnections[0]);
    });

    it('BG-U-006: matches by org identifier across different domain formats', () => {
        // Connection uses lightning.force.com, search uses my.salesforce.com
        const domain = 'mysandbox.sandbox.my.salesforce.com';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toEqual(mockConnections[1]);
    });

    it('BG-U-006: matches sandbox by org identifier', () => {
        const domain = 'https://mysandbox.sandbox.my.salesforce.com/some/path';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toEqual(mockConnections[1]);
    });

    it('BG-U-006: matches scratch org by org identifier', () => {
        const domain = 'scratch123.scratch.lightning.force.com';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toEqual(mockConnections[2]);
    });

    it('BG-U-007: returns null if no match found', () => {
        const domain = 'unknown.my.salesforce.com';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toBeNull();
    });

    it('BG-U-007: returns null for empty connections array', () => {
        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain([], domain);

        expect(result).toBeNull();
    });

    it('BG-U-007: returns null for null connections', () => {
        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain(null, domain);

        expect(result).toBeNull();
    });

    it('BG-U-007: returns null for undefined connections', () => {
        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain(undefined, domain);

        expect(result).toBeNull();
    });

    it('BG-U-007: returns null for invalid domain', () => {
        const domain = 'not-a-url';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toBeNull();
    });

    it('BG-U-007: returns null for non-Salesforce domain', () => {
        const domain = 'https://example.com';
        const result = findConnectionByDomain(mockConnections, domain);

        expect(result).toBeNull();
    });

    it('BG-U-016: handles connections with malformed instanceUrl gracefully', () => {
        const connectionsWithBadUrl = [
            {
                id: 'conn-bad',
                label: 'Bad Connection',
                instanceUrl: 'not-a-valid-url'
            },
            ...mockConnections
        ];

        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain(connectionsWithBadUrl, domain);

        expect(result).toEqual(mockConnections[0]);
    });

    it('BG-U-017: matches first connection when multiple match', () => {
        const duplicateConnections = [
            {
                id: 'conn-first',
                label: 'First Match',
                instanceUrl: 'https://myorg.my.salesforce.com'
            },
            {
                id: 'conn-second',
                label: 'Second Match',
                instanceUrl: 'https://myorg.lightning.force.com'
            }
        ];

        const domain = 'myorg.my.salesforce.com';
        const result = findConnectionByDomain(duplicateConnections, domain);

        expect(result.id).toBe('conn-first');
    });
});
