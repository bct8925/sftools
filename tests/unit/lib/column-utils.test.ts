import { describe, it, expect } from 'vitest';
import { flattenColumnMetadata } from '../../../src/lib/column-utils.js';
import type { ColumnMetadata } from '../../../src/types/salesforce';

describe('column-utils', () => {
    describe('flattenColumnMetadata', () => {
        it('flattens simple scalar columns', () => {
            const input: ColumnMetadata[] = [
                { columnName: 'Id', displayName: 'Record ID', aggregate: false },
                { columnName: 'Name', displayName: 'Account Name', aggregate: false },
            ];

            const result = flattenColumnMetadata(input);

            expect(result).toEqual([
                { title: 'Record ID', path: 'Id', aggregate: false, isSubquery: false },
                { title: 'Account Name', path: 'Name', aggregate: false, isSubquery: false },
            ]);
        });

        it('flattens relationship columns', () => {
            const input: ColumnMetadata[] = [
                {
                    columnName: 'Account',
                    displayName: 'Account',
                    aggregate: false,
                    joinColumns: [
                        { columnName: 'Name', displayName: 'Account Name', aggregate: false },
                    ],
                },
            ];

            const result = flattenColumnMetadata(input);

            expect(result).toEqual([
                {
                    title: 'Account.Name',
                    path: 'Account.Name',
                    aggregate: false,
                    isSubquery: false,
                },
            ]);
        });

        it('identifies subquery columns (aggregate + joinColumns)', () => {
            const joinCols: ColumnMetadata[] = [
                { columnName: 'Id', displayName: 'Contact ID', aggregate: false },
            ];
            const input: ColumnMetadata[] = [
                {
                    columnName: 'Contacts',
                    displayName: 'Contacts',
                    aggregate: true,
                    joinColumns: joinCols,
                },
            ];

            const result = flattenColumnMetadata(input);

            expect(result).toEqual([
                {
                    title: 'Contacts',
                    path: 'Contacts',
                    aggregate: false,
                    isSubquery: true,
                    subqueryColumns: joinCols,
                },
            ]);
        });

        it('flattens nested relationships (Account.Owner.Name)', () => {
            const input: ColumnMetadata[] = [
                {
                    columnName: 'Account',
                    displayName: 'Account',
                    aggregate: false,
                    joinColumns: [
                        {
                            columnName: 'Owner',
                            displayName: 'Owner',
                            aggregate: false,
                            joinColumns: [
                                { columnName: 'Name', displayName: 'Owner Name', aggregate: false },
                            ],
                        },
                    ],
                },
            ];

            const result = flattenColumnMetadata(input);

            expect(result).toEqual([
                {
                    title: 'Account.Owner.Name',
                    path: 'Account.Owner.Name',
                    aggregate: false,
                    isSubquery: false,
                },
            ]);
        });

        it('returns empty array for empty input', () => {
            expect(flattenColumnMetadata([])).toEqual([]);
        });

        it('handles mixed columns', () => {
            const input: ColumnMetadata[] = [
                { columnName: 'Id', displayName: 'Record ID', aggregate: false },
                {
                    columnName: 'Account',
                    displayName: 'Account',
                    aggregate: false,
                    joinColumns: [
                        { columnName: 'Name', displayName: 'Account Name', aggregate: false },
                    ],
                },
                {
                    columnName: 'Contacts',
                    displayName: 'Contacts',
                    aggregate: true,
                    joinColumns: [
                        { columnName: 'FirstName', displayName: 'First Name', aggregate: false },
                    ],
                },
            ];

            const result = flattenColumnMetadata(input);

            expect(result).toHaveLength(3);
            expect(result[0].isSubquery).toBe(false);
            expect(result[1].path).toBe('Account.Name');
            expect(result[2].isSubquery).toBe(true);
        });

        it('uses displayName for top-level and path for nested', () => {
            const input: ColumnMetadata[] = [
                { columnName: 'Id', displayName: 'Record ID', aggregate: false },
                {
                    columnName: 'CreatedBy',
                    displayName: 'Created By',
                    aggregate: false,
                    joinColumns: [
                        { columnName: 'Name', displayName: 'User Name', aggregate: false },
                    ],
                },
            ];

            const result = flattenColumnMetadata(input);

            expect(result[0].title).toBe('Record ID');
            expect(result[1].title).toBe('CreatedBy.Name');
        });
    });
});
