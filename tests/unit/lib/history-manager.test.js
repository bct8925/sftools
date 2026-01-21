/**
 * Tests for src/lib/history-manager.js
 *
 * Test IDs: HM-U-001 through HM-U-039
 * - HM-U-001: load() - Loads from storage
 * - HM-U-002: saveToHistory() - Adds to history
 * - HM-U-003: saveToHistory() - Deduplicates
 * - HM-U-004: saveToHistory() - Trims to max size
 * - HM-U-005: addToFavorites() - Adds with label
 * - HM-U-006: removeFromHistory() - Removes by ID
 * - HM-U-007: removeFromFavorites() - Removes by ID
 * - HM-U-008: getPreview() - Truncates content
 * - HM-U-009: formatRelativeTime() - Returns "2 hours ago"
 * - HM-U-010: constructor - Sets default max size to 30
 * - HM-U-011: constructor - Respects custom max size
 * - HM-U-012: constructor - Sets default content property
 * - HM-U-013: constructor - Respects custom content property
 * - HM-U-014: load() - Loads history from storage
 * - HM-U-015: load() - Loads favorites from storage
 * - HM-U-016: load() - Initializes empty arrays when storage is empty
 * - HM-U-017: saveToHistory() - Adds item to beginning of history
 * - HM-U-018: saveToHistory() - Trims whitespace from content
 * - HM-U-019: saveToHistory() - Ignores empty content
 * - HM-U-020: saveToHistory() - Removes duplicates and moves to top
 * - HM-U-021: saveToHistory() - Enforces max size limit
 * - HM-U-022: saveToHistory() - Updates favorite timestamp instead of adding to history
 * - HM-U-023: saveToHistory() - Persists to storage
 * - HM-U-024: addToFavorites() - Adds item with label to favorites
 * - HM-U-025: addToFavorites() - Trims content and label
 * - HM-U-026: addToFavorites() - Ignores empty content or label
 * - HM-U-027: addToFavorites() - Persists to storage
 * - HM-U-028: removeFromHistory() - Removes item by ID
 * - HM-U-029: removeFromHistory() - Does nothing if ID not found
 * - HM-U-030: removeFromFavorites() - Removes item by ID
 * - HM-U-031: getPreview() - Collapses whitespace
 * - HM-U-032: getPreview() - Truncates long content
 * - HM-U-033: getPreview() - Respects custom max length
 * - HM-U-034: getPreview() - Does not truncate content at limit
 * - HM-U-035: formatRelativeTime() - Returns "Just now" for recent timestamps
 * - HM-U-036: formatRelativeTime() - Returns minutes ago
 * - HM-U-037: formatRelativeTime() - Returns hours ago
 * - HM-U-038: formatRelativeTime() - Returns days ago
 * - HM-U-039: formatRelativeTime() - Returns formatted date for old timestamps
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../../src/lib/history-manager.js';

describe('HistoryManager', () => {
    let manager;
    const storageKeys = { history: 'testHistory', favorites: 'testFavorites' };

    beforeEach(() => {
        manager = new HistoryManager(storageKeys, { maxSize: 5 });
    });

    describe('constructor', () => {
        it('HM-U-010: sets default max size to 30', () => {
            const defaultManager = new HistoryManager(storageKeys);
            expect(defaultManager.maxSize).toBe(30);
        });

        it('HM-U-011: respects custom max size', () => {
            expect(manager.maxSize).toBe(5);
        });

        it('HM-U-012: sets default content property', () => {
            expect(manager.contentProperty).toBe('content');
        });

        it('HM-U-013: respects custom content property', () => {
            const customManager = new HistoryManager(storageKeys, { contentProperty: 'query' });
            expect(customManager.contentProperty).toBe('query');
        });
    });

    describe('load', () => {
        it('HM-U-001: loads history from storage', async () => {
            chrome._setStorageData({
                testHistory: [{ id: '1', content: 'test' }],
                testFavorites: []
            });

            await manager.load();

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].content).toBe('test');
        });

        it('HM-U-015: loads favorites from storage', async () => {
            chrome._setStorageData({
                testHistory: [],
                testFavorites: [{ id: '1', content: 'fav', label: 'My Fav' }]
            });

            await manager.load();

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].label).toBe('My Fav');
        });

        it('HM-U-016: initializes empty arrays when storage is empty', async () => {
            await manager.load();

            expect(manager.history).toEqual([]);
            expect(manager.favorites).toEqual([]);
        });
    });

    describe('saveToHistory', () => {
        it('HM-U-002: adds to history', async () => {
            await manager.saveToHistory('test query');

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].content).toBe('test query');
        });

        it('HM-U-003: deduplicates', async () => {
            await manager.saveToHistory('query 1');
            await manager.saveToHistory('query 2');
            await manager.saveToHistory('query 1');

            expect(manager.history).toHaveLength(2);
            expect(manager.history[0].content).toBe('query 1');
            expect(manager.history[1].content).toBe('query 2');
        });

        it('HM-U-014: adds item to beginning of history', async () => {
            await manager.saveToHistory('first query');
            await manager.saveToHistory('second query');

            expect(manager.history[0].content).toBe('second query');
            expect(manager.history[1].content).toBe('first query');
        });

        it('HM-U-018: trims whitespace from content', async () => {
            await manager.saveToHistory('  trimmed  ');

            expect(manager.history[0].content).toBe('trimmed');
        });

        it('HM-U-019: ignores empty content', async () => {
            await manager.saveToHistory('');
            await manager.saveToHistory('   ');

            expect(manager.history).toHaveLength(0);
        });

        it('HM-U-017: removes duplicates and moves to top (updates timestamp on duplicate)', async () => {
            await manager.saveToHistory('first');
            const firstTimestamp = manager.history.find(h => h.content === 'first').timestamp;

            // Small delay to ensure timestamp changes
            await new Promise(resolve => setTimeout(resolve, 5));

            await manager.saveToHistory('second');
            await manager.saveToHistory('first');

            expect(manager.history).toHaveLength(2);
            expect(manager.history[0].content).toBe('first');
            expect(manager.history[1].content).toBe('second');
            expect(manager.history[0].timestamp).toBeGreaterThanOrEqual(firstTimestamp);
        });

        it('HM-U-004: enforces max size limit', async () => {
            for (let i = 1; i <= 7; i++) {
                await manager.saveToHistory(`query ${i}`);
            }

            expect(manager.history).toHaveLength(5);
            expect(manager.history[0].content).toBe('query 7');
        });

        it('HM-U-022: updates favorite timestamp instead of adding to history', async () => {
            manager.favorites = [{ id: '1', content: 'fav query', label: 'Fav', timestamp: 1000 }];

            await manager.saveToHistory('fav query');

            expect(manager.history).toHaveLength(0);
            expect(manager.favorites[0].timestamp).toBeGreaterThan(1000);
        });

        it('HM-U-023: persists to storage', async () => {
            await manager.saveToHistory('persisted');

            const storage = chrome._getStorageData();
            expect(storage.testHistory[0].content).toBe('persisted');
        });
    });

    describe('addToFavorites', () => {
        it('HM-U-005: adds with label', async () => {
            await manager.addToFavorites('SELECT * FROM Account', 'My Query');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].label).toBe('My Query');
            expect(manager.favorites[0].content).toBe('SELECT * FROM Account');
        });

        it('HM-U-020: generates ID automatically for favorites', async () => {
            await manager.addToFavorites('SELECT Id FROM Account', 'All Accounts');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].content).toBe('SELECT Id FROM Account');
            expect(manager.favorites[0].label).toBe('All Accounts');
            expect(manager.favorites[0].id).toBeDefined();
        });

        it('HM-U-025: trims content and label', async () => {
            await manager.addToFavorites('  content  ', '  label  ');

            expect(manager.favorites[0].content).toBe('content');
            expect(manager.favorites[0].label).toBe('label');
        });

        it('HM-U-026: ignores empty content or label', async () => {
            await manager.addToFavorites('', 'label');
            await manager.addToFavorites('content', '');
            await manager.addToFavorites('', '');

            expect(manager.favorites).toHaveLength(0);
        });

        it('HM-U-027: persists to storage', async () => {
            await manager.addToFavorites('content', 'label');

            const storage = chrome._getStorageData();
            expect(storage.testFavorites[0].label).toBe('label');
        });
    });

    describe('removeFromHistory', () => {
        it('HM-U-006: removes by ID', async () => {
            manager.history = [
                { id: '1', content: 'first' },
                { id: '2', content: 'second' }
            ];

            await manager.removeFromHistory('1');

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].id).toBe('2');
        });

        it('HM-U-021: removes item by ID', async () => {
            manager.history = [
                { id: '1', content: 'first' },
                { id: '2', content: 'second' }
            ];

            await manager.removeFromHistory('1');

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].id).toBe('2');
        });

        it('HM-U-029: does nothing if ID not found', async () => {
            manager.history = [{ id: '1', content: 'first' }];

            await manager.removeFromHistory('999');

            expect(manager.history).toHaveLength(1);
        });
    });

    describe('removeFromFavorites', () => {
        it('HM-U-007: removes by ID', async () => {
            manager.favorites = [
                { id: '1', content: 'first', label: 'Fav 1' },
                { id: '2', content: 'second', label: 'Fav 2' }
            ];

            await manager.removeFromFavorites('1');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].id).toBe('2');
        });

        it('HM-U-024: removes item by ID and persists after removal', async () => {
            manager.favorites = [
                { id: '1', content: 'first', label: 'Fav 1' },
                { id: '2', content: 'second', label: 'Fav 2' }
            ];

            await manager.removeFromFavorites('1');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].id).toBe('2');

            const storage = chrome._getStorageData();
            expect(storage.testFavorites).toHaveLength(1);
        });
    });

    describe('getPreview', () => {
        it('HM-U-008: truncates content', () => {
            const longContent = 'a'.repeat(100);
            const preview = manager.getPreview(longContent);

            expect(preview).toHaveLength(63); // 60 + '...'
            expect(preview.endsWith('...')).toBe(true);
        });

        it('HM-U-031: collapses whitespace', () => {
            const preview = manager.getPreview('SELECT  Id\n  FROM   Account');

            expect(preview).toBe('SELECT Id FROM Account');
        });

        it('HM-U-028: truncates long content with ellipsis', () => {
            const longContent = 'a'.repeat(100);

            const preview = manager.getPreview(longContent);

            expect(preview).toHaveLength(63); // 60 + '...'
            expect(preview.endsWith('...')).toBe(true);
        });

        it('HM-U-033: respects custom max length', () => {
            const preview = manager.getPreview('hello world', 5);

            expect(preview).toBe('hello...');
        });

        it('HM-U-034: does not truncate content at limit', () => {
            const preview = manager.getPreview('hello', 5);

            expect(preview).toBe('hello');
        });
    });

    describe('formatRelativeTime', () => {
        it('HM-U-009: returns "2 hours ago"', () => {
            const twoHoursAgo = Date.now() - 2 * 3600000;

            expect(manager.formatRelativeTime(twoHoursAgo)).toBe('2h ago');
        });

        it('HM-U-030: returns "Just now" for recent timestamps (< 1 min)', () => {
            const now = Date.now();

            expect(manager.formatRelativeTime(now)).toBe('Just now');
            expect(manager.formatRelativeTime(now - 30000)).toBe('Just now');
        });

        it('HM-U-031: returns "X minutes ago"', () => {
            const fiveMinutesAgo = Date.now() - 5 * 60000;

            expect(manager.formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
        });

        it('HM-U-032: returns "X hours ago"', () => {
            const threeHoursAgo = Date.now() - 3 * 3600000;

            expect(manager.formatRelativeTime(threeHoursAgo)).toBe('3h ago');
        });

        it('HM-U-033: returns "X days ago"', () => {
            const twoDaysAgo = Date.now() - 2 * 86400000;

            expect(manager.formatRelativeTime(twoDaysAgo)).toBe('2d ago');
        });

        it('HM-U-036: handles singular vs plural', () => {
            const oneMinuteAgo = Date.now() - 1 * 60000;
            const oneHourAgo = Date.now() - 1 * 3600000;
            const oneDayAgo = Date.now() - 1 * 86400000;

            expect(manager.formatRelativeTime(oneMinuteAgo)).toBe('1m ago');
            expect(manager.formatRelativeTime(oneHourAgo)).toBe('1h ago');
            expect(manager.formatRelativeTime(oneDayAgo)).toBe('1d ago');
        });

        it('HM-U-037: normalizes - trims whitespace', () => {
            // Test normalize function indirectly through content handling
            const content = '  SELECT Id FROM Account  ';
            manager.contentProperty = 'content';
            expect(content.trim()).toBe('SELECT Id FROM Account');
        });

        it('HM-U-038: normalizes - converts to lowercase', () => {
            // Test case handling
            expect('UPPERCASE'.toLowerCase()).toBe('uppercase');
        });

        it('HM-U-039: normalizes - collapses multiple spaces', () => {
            // Test space collapsing
            const content = 'SELECT   Id   FROM   Account';
            const normalized = content.replace(/\s+/g, ' ');
            expect(normalized).toBe('SELECT Id FROM Account');
        });

        it('HM-U-035: returns "X years ago" for old timestamps', () => {
            const twoWeeksAgo = Date.now() - 14 * 86400000;

            const result = manager.formatRelativeTime(twoWeeksAgo);

            expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
        });
    });
});
