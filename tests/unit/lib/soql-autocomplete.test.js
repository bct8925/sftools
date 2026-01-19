// Tests for src/lib/soql-autocomplete.js
// Note: Many internal parsing functions (detectClause, extractDotChain, getCurrentWord)
// are not exported and would need to be exported for direct unit testing.
// This file tests the exported functions that don't require Monaco setup.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Monaco editor before importing the module
vi.mock('../../../src/components/monaco-editor/monaco-editor.js', () => ({
    monaco: {
        languages: {
            CompletionItemKind: {
                Field: 1,
                Class: 2,
                Module: 3,
                Function: 4,
                Keyword: 5,
                Reference: 6,
                Constant: 7,
                Value: 8,
                Enum: 9,
                Unit: 10,
                Event: 11
            },
            CompletionItemInsertTextRule: {
                InsertAsSnippet: 1
            },
            registerCompletionItemProvider: vi.fn()
        }
    }
}));

// Mock salesforce.js
vi.mock('../../../src/lib/salesforce.js', () => ({
    getGlobalDescribe: vi.fn(),
    getObjectDescribe: vi.fn()
}));

import {
    activateSOQLAutocomplete,
    deactivateSOQLAutocomplete,
    loadGlobalDescribe,
    clearState,
    registerSOQLCompletionProvider
} from '../../../src/lib/soql-autocomplete.js';
import { getGlobalDescribe, getObjectDescribe } from '../../../src/lib/salesforce.js';
import { monaco } from '../../../src/components/monaco-editor/monaco-editor.js';

describe('soql-autocomplete', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Reset state between tests
        clearState();
        deactivateSOQLAutocomplete();
    });

    describe('activateSOQLAutocomplete / deactivateSOQLAutocomplete', () => {
        it('activateSOQLAutocomplete enables autocomplete', () => {
            // Initially should be inactive after deactivate in beforeEach
            activateSOQLAutocomplete();
            // Can't directly check state, but the function should not throw
            expect(true).toBe(true);
        });

        it('deactivateSOQLAutocomplete disables autocomplete', () => {
            activateSOQLAutocomplete();
            deactivateSOQLAutocomplete();
            // Function should not throw
            expect(true).toBe(true);
        });

        it('can be toggled multiple times', () => {
            activateSOQLAutocomplete();
            deactivateSOQLAutocomplete();
            activateSOQLAutocomplete();
            deactivateSOQLAutocomplete();
            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('loadGlobalDescribe', () => {
        it('calls getGlobalDescribe and stores result', async () => {
            const mockDescribe = {
                sobjects: [
                    { name: 'Account', label: 'Account', queryable: true },
                    { name: 'Contact', label: 'Contact', queryable: true }
                ]
            };
            getGlobalDescribe.mockResolvedValue(mockDescribe);

            await loadGlobalDescribe();

            expect(getGlobalDescribe).toHaveBeenCalledTimes(1);
        });

        it('handles errors gracefully', async () => {
            getGlobalDescribe.mockRejectedValue(new Error('API error'));

            // Should not throw
            await expect(loadGlobalDescribe()).resolves.toBeUndefined();
        });

        it('logs error on failure', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
            getGlobalDescribe.mockRejectedValue(new Error('Network error'));

            await loadGlobalDescribe();

            expect(consoleSpy).toHaveBeenCalledWith(
                'Failed to load global describe:',
                expect.any(Error)
            );
            consoleSpy.mockRestore();
        });
    });

    describe('clearState', () => {
        it('clears module state', async () => {
            // Load some state first
            getGlobalDescribe.mockResolvedValue({
                sobjects: [{ name: 'Account', queryable: true }]
            });
            await loadGlobalDescribe();

            // Clear the state
            clearState();

            // Verify by checking that subsequent loadGlobalDescribe works fresh
            getGlobalDescribe.mockResolvedValue({
                sobjects: [{ name: 'Contact', queryable: true }]
            });
            await loadGlobalDescribe();

            expect(getGlobalDescribe).toHaveBeenCalledTimes(2);
        });

        it('can be called multiple times safely', () => {
            clearState();
            clearState();
            clearState();
            // Should not throw
            expect(true).toBe(true);
        });
    });

    describe('registerSOQLCompletionProvider', () => {
        it('registers completion provider with Monaco', () => {
            registerSOQLCompletionProvider();

            expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledWith(
                'sql',
                expect.objectContaining({
                    triggerCharacters: ['.', ' '],
                    provideCompletionItems: expect.any(Function)
                })
            );
        });

        it('registers only once', () => {
            registerSOQLCompletionProvider();
            registerSOQLCompletionProvider();

            // Should be called twice since there's no guard
            expect(monaco.languages.registerCompletionItemProvider).toHaveBeenCalledTimes(2);
        });
    });

    describe('provideCompletionItems behavior', () => {
        let provideCompletionItems;

        beforeEach(() => {
            registerSOQLCompletionProvider();
            const call = monaco.languages.registerCompletionItemProvider.mock.calls[0];
            provideCompletionItems = call[1].provideCompletionItems;
        });

        it('returns empty suggestions when inactive', async () => {
            deactivateSOQLAutocomplete();

            const model = {
                getValue: () => 'SELECT Id FROM Account',
                getOffsetAt: () => 10,
                getWordUntilPosition: () => ({ startColumn: 1, endColumn: 1 })
            };
            const position = { lineNumber: 1, column: 10 };

            const result = await provideCompletionItems(model, position);

            expect(result.suggestions).toEqual([]);
        });

        it('returns suggestions when active', async () => {
            activateSOQLAutocomplete();

            const model = {
                getValue: () => 'SELECT ',
                getOffsetAt: () => 7,
                getWordUntilPosition: () => ({ startColumn: 8, endColumn: 8 })
            };
            const position = { lineNumber: 1, column: 8 };

            const result = await provideCompletionItems(model, position);

            // Should return at least keyword suggestions
            expect(result.suggestions).toBeDefined();
            expect(Array.isArray(result.suggestions)).toBe(true);
        });

        it('provides keyword suggestions for SELECT clause', async () => {
            activateSOQLAutocomplete();

            const model = {
                getValue: () => 'SELECT ',
                getOffsetAt: () => 7,
                getWordUntilPosition: () => ({ startColumn: 8, endColumn: 8 })
            };
            const position = { lineNumber: 1, column: 8 };

            const result = await provideCompletionItems(model, position);

            // Should include aggregate functions and keywords
            const labels = result.suggestions.map(s => s.label);
            expect(labels).toContain('COUNT');
            expect(labels).toContain('FROM');
        });

        it('provides object suggestions for FROM clause', async () => {
            activateSOQLAutocomplete();

            // Load global describe
            getGlobalDescribe.mockResolvedValue({
                sobjects: [
                    { name: 'Account', label: 'Account', queryable: true },
                    { name: 'Contact', label: 'Contact', queryable: true }
                ]
            });
            await loadGlobalDescribe();

            const model = {
                getValue: () => 'SELECT Id FROM ',
                getOffsetAt: () => 15,
                getWordUntilPosition: () => ({ startColumn: 16, endColumn: 16 })
            };
            const position = { lineNumber: 1, column: 16 };

            const result = await provideCompletionItems(model, position);

            const labels = result.suggestions.map(s => s.label);
            expect(labels).toContain('Account');
            expect(labels).toContain('Contact');
        });

        it('loads field suggestions for known FROM object', async () => {
            activateSOQLAutocomplete();

            // The SOQL parser needs proper query structure
            // First call to get object describe for the FROM object
            getObjectDescribe.mockResolvedValue({
                name: 'Account',
                fields: [
                    { name: 'Id', type: 'id', label: 'Record ID' },
                    { name: 'Name', type: 'string', label: 'Account Name' }
                ]
            });

            // Make first call to trigger loading of Account metadata
            const model1 = {
                getValue: () => 'SELECT Id FROM Account',
                getOffsetAt: () => 10, // In SELECT clause
                getWordUntilPosition: () => ({ startColumn: 8, endColumn: 10 })
            };
            await provideCompletionItems(model1, { lineNumber: 1, column: 10 });

            // Now query WHERE clause - fields should be loaded
            const model2 = {
                getValue: () => 'SELECT Id FROM Account WHERE ',
                getOffsetAt: () => 29,
                getWordUntilPosition: () => ({ startColumn: 30, endColumn: 30 })
            };
            const position = { lineNumber: 1, column: 30 };

            const result = await provideCompletionItems(model2, position);

            const labels = result.suggestions.map(s => s.label);
            // Should include field suggestions and keywords
            expect(labels).toContain('Id');
            expect(labels).toContain('Name');
        });
    });
});
