// Jobs API - Apex Jobs (SOQL) and Bulk Jobs (REST) fetching

import type {
    QueryResult,
    AsyncApexJob,
    BulkJobListItem,
    BulkJobListResponse,
} from '../types/salesforce';
import { API_VERSION } from './constants';
import { salesforceRequest } from './salesforce-request';

// ============================================================
// Interfaces
// ============================================================

export interface ApexJobFilters {
    apexClass: string;
    status: string;
}

export interface BulkJobWithType extends BulkJobListItem {
    sourceType: 'ingest' | 'query';
    createdByName?: string;
}

// ============================================================
// Apex Jobs
// ============================================================

/**
 * Fetch AsyncApexJob records with optional filters.
 * Uses standard SOQL on the AsyncApexJob object.
 */
export async function fetchApexJobs(filters: ApexJobFilters): Promise<AsyncApexJob[]> {
    const conditions: string[] = [];

    if (filters.apexClass) {
        const escaped = filters.apexClass.replace(/'/g, "\\'");
        conditions.push(`ApexClass.Name LIKE '%${escaped}%'`);
    }

    if (filters.status) {
        const escaped = filters.status.replace(/'/g, "\\'");
        conditions.push(`Status = '${escaped}'`);
    }

    const where = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

    const soql = encodeURIComponent(
        `SELECT Id, JobType, Status, NumberOfErrors, TotalJobItems, JobItemsProcessed, CreatedDate, CompletedDate, CreatedBy.Name, ApexClass.Name, MethodName FROM AsyncApexJob${where} ORDER BY CreatedDate DESC LIMIT 200`
    );

    const response = await salesforceRequest<QueryResult<AsyncApexJob>>(
        `/services/data/v${API_VERSION}/query/?q=${soql}`
    );

    return response.json?.records ?? [];
}

// ============================================================
// Bulk Jobs
// ============================================================

/**
 * Fetch all pages from a Bulk API list endpoint.
 * Handles pagination via nextRecordsUrl (queryLocator parameter).
 */
async function fetchAllBulkJobPages(endpoint: string): Promise<BulkJobListItem[]> {
    const allRecords: BulkJobListItem[] = [];
    let url: string | null = `/services/data/v${API_VERSION}/${endpoint}`;

    while (url) {
        const response: { json: BulkJobListResponse | null } =
            await salesforceRequest<BulkJobListResponse>(url);
        const page: BulkJobListResponse | null = response.json;
        if (!page) break;

        allRecords.push(...page.records);
        url = page.done ? null : (page.nextRecordsUrl ?? null);
    }

    return allRecords;
}

/**
 * Fetch bulk jobs from both ingest and query endpoints.
 * Paginates through all results and tags each with the source endpoint type.
 */
export async function fetchBulkJobs(): Promise<BulkJobWithType[]> {
    const [ingestRecords, queryRecords] = await Promise.all([
        fetchAllBulkJobPages('jobs/ingest'),
        fetchAllBulkJobPages('jobs/query'),
    ]);

    const ingestJobs: BulkJobWithType[] = ingestRecords.map(job => ({
        ...job,
        sourceType: 'ingest' as const,
    }));

    const queryJobs: BulkJobWithType[] = queryRecords.map(job => ({
        ...job,
        sourceType: 'query' as const,
    }));

    const merged = [...ingestJobs, ...queryJobs];
    merged.sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime());

    return merged;
}

// ============================================================
// User Name Resolution
// ============================================================

/**
 * Resolve user IDs to display names via SOQL.
 * Deduplicates input IDs and returns a Map of userId → name.
 */
export async function resolveUserNames(userIds: string[]): Promise<Map<string, string>> {
    const unique = [...new Set(userIds)].filter(Boolean);
    if (unique.length === 0) return new Map();

    const idList = unique.map(id => `'${id}'`).join(',');
    const soql = encodeURIComponent(`SELECT Id, Name FROM User WHERE Id IN (${idList})`);

    const response = await salesforceRequest<QueryResult<{ Id: string; Name: string }>>(
        `/services/data/v${API_VERSION}/query/?q=${soql}`
    );

    const map = new Map<string, string>();
    for (const record of response.json?.records ?? []) {
        map.set(record.Id, record.Name);
    }
    return map;
}
