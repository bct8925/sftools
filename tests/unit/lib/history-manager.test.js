// Tests for src/lib/history-manager.js

import { describe, it, expect, beforeEach } from 'vitest';
import { HistoryManager } from '../../../src/lib/history-manager.js';

describe('HistoryManager', () => {
    let manager;
    const storageKeys = { history: 'testHistory', favorites: 'testFavorites' };

    beforeEach(() => {
        manager = new HistoryManager(storageKeys, { maxSize: 5 });
    });

    describe('constructor', () => {
        it('sets default max size to 30', () => {
            const defaultManager = new HistoryManager(storageKeys);
            expect(defaultManager.maxSize).toBe(30);
        });

        it('respects custom max size', () => {
            expect(manager.maxSize).toBe(5);
        });

        it('sets default content property', () => {
            expect(manager.contentProperty).toBe('content');
        });

        it('respects custom content property', () => {
            const customManager = new HistoryManager(storageKeys, { contentProperty: 'query' });
            expect(customManager.contentProperty).toBe('query');
        });
    });

    describe('load', () => {
        it('loads history from storage', async () => {
            chrome._setStorageData({
                testHistory: [{ id: '1', content: 'test' }],
                testFavorites: []
            });

            await manager.load();

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].content).toBe('test');
        });

        it('loads favorites from storage', async () => {
            chrome._setStorageData({
                testHistory: [],
                testFavorites: [{ id: '1', content: 'fav', label: 'My Fav' }]
            });

            await manager.load();

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].label).toBe('My Fav');
        });

        it('initializes empty arrays when storage is empty', async () => {
            await manager.load();

            expect(manager.history).toEqual([]);
            expect(manager.favorites).toEqual([]);
        });
    });

    describe('saveToHistory', () => {
        it('adds item to beginning of history', async () => {
            await manager.saveToHistory('first query');
            await manager.saveToHistory('second query');

            expect(manager.history[0].content).toBe('second query');
            expect(manager.history[1].content).toBe('first query');
        });

        it('trims whitespace from content', async () => {
            await manager.saveToHistory('  trimmed  ');

            expect(manager.history[0].content).toBe('trimmed');
        });

        it('ignores empty content', async () => {
            await manager.saveToHistory('');
            await manager.saveToHistory('   ');

            expect(manager.history).toHaveLength(0);
        });

        it('removes duplicates and moves to top', async () => {
            await manager.saveToHistory('first');
            await manager.saveToHistory('second');
            await manager.saveToHistory('first');

            expect(manager.history).toHaveLength(2);
            expect(manager.history[0].content).toBe('first');
            expect(manager.history[1].content).toBe('second');
        });

        it('enforces max size limit', async () => {
            for (let i = 1; i <= 7; i++) {
                await manager.saveToHistory(`query ${i}`);
            }

            expect(manager.history).toHaveLength(5);
            expect(manager.history[0].content).toBe('query 7');
        });

        it('updates favorite timestamp instead of adding to history', async () => {
            manager.favorites = [{ id: '1', content: 'fav query', label: 'Fav', timestamp: 1000 }];

            await manager.saveToHistory('fav query');

            expect(manager.history).toHaveLength(0);
            expect(manager.favorites[0].timestamp).toBeGreaterThan(1000);
        });

        it('persists to storage', async () => {
            await manager.saveToHistory('persisted');

            const storage = chrome._getStorageData();
            expect(storage.testHistory[0].content).toBe('persisted');
        });
    });

    describe('addToFavorites', () => {
        it('adds item with label to favorites', async () => {
            await manager.addToFavorites('SELECT Id FROM Account', 'All Accounts');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].content).toBe('SELECT Id FROM Account');
            expect(manager.favorites[0].label).toBe('All Accounts');
        });

        it('trims content and label', async () => {
            await manager.addToFavorites('  content  ', '  label  ');

            expect(manager.favorites[0].content).toBe('content');
            expect(manager.favorites[0].label).toBe('label');
        });

        it('ignores empty content or label', async () => {
            await manager.addToFavorites('', 'label');
            await manager.addToFavorites('content', '');
            await manager.addToFavorites('', '');

            expect(manager.favorites).toHaveLength(0);
        });

        it('persists to storage', async () => {
            await manager.addToFavorites('content', 'label');

            const storage = chrome._getStorageData();
            expect(storage.testFavorites[0].label).toBe('label');
        });
    });

    describe('removeFromHistory', () => {
        it('removes item by ID', async () => {
            manager.history = [
                { id: '1', content: 'first' },
                { id: '2', content: 'second' }
            ];

            await manager.removeFromHistory('1');

            expect(manager.history).toHaveLength(1);
            expect(manager.history[0].id).toBe('2');
        });

        it('does nothing if ID not found', async () => {
            manager.history = [{ id: '1', content: 'first' }];

            await manager.removeFromHistory('999');

            expect(manager.history).toHaveLength(1);
        });
    });

    describe('removeFromFavorites', () => {
        it('removes item by ID', async () => {
            manager.favorites = [
                { id: '1', content: 'first', label: 'Fav 1' },
                { id: '2', content: 'second', label: 'Fav 2' }
            ];

            await manager.removeFromFavorites('1');

            expect(manager.favorites).toHaveLength(1);
            expect(manager.favorites[0].id).toBe('2');
        });
    });

    describe('getPreview', () => {
        it('collapses whitespace', () => {
            const preview = manager.getPreview('SELECT  Id\n  FROM   Account');

            expect(preview).toBe('SELECT Id FROM Account');
        });

        it('truncates long content', () => {
            const longContent = 'a'.repeat(100);

            const preview = manager.getPreview(longContent);

            expect(preview).toHaveLength(63); // 60 + '...'
            expect(preview.endsWith('...')).toBe(true);
        });

        it('respects custom max length', () => {
            const preview = manager.getPreview('hello world', 5);

            expect(preview).toBe('hello...');
        });

        it('does not truncate content at limit', () => {
            const preview = manager.getPreview('hello', 5);

            expect(preview).toBe('hello');
        });
    });

    describe('formatRelativeTime', () => {
        it('returns "Just now" for recent timestamps', () => {
            const now = Date.now();

            expect(manager.formatRelativeTime(now)).toBe('Just now');
            expect(manager.formatRelativeTime(now - 30000)).toBe('Just now');
        });

        it('returns minutes ago', () => {
            const fiveMinutesAgo = Date.now() - 5 * 60000;

            expect(manager.formatRelativeTime(fiveMinutesAgo)).toBe('5m ago');
        });

        it('returns hours ago', () => {
            const threeHoursAgo = Date.now() - 3 * 3600000;

            expect(manager.formatRelativeTime(threeHoursAgo)).toBe('3h ago');
        });

        it('returns days ago', () => {
            const twoDaysAgo = Date.now() - 2 * 86400000;

            expect(manager.formatRelativeTime(twoDaysAgo)).toBe('2d ago');
        });

        it('returns formatted date for old timestamps', () => {
            const twoWeeksAgo = Date.now() - 14 * 86400000;

            const result = manager.formatRelativeTime(twoWeeksAgo);

            expect(result).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/);
        });
    });
});
