const API_VERSION = '62.0';

interface CreatedRecord {
    type: string;
    id: string;
}

interface SalesforceError {
    message: string;
    errorCode: string;
    fields?: string[];
}

export class SalesforceClient {
    private accessToken: string = '';
    private instanceUrl: string = '';
    private connectionId: string = '';
    private createdRecords: CreatedRecord[] = [];

    setCredentials(accessToken: string, instanceUrl: string): void {
        this.accessToken = accessToken;
        // Remove trailing slash if present
        this.instanceUrl = instanceUrl.replace(/\/$/, '');
        // Generate a connection ID for the test session
        this.connectionId = `test-${Date.now()}`;
    }

    getConnectionId(): string {
        return this.connectionId;
    }

    getAccessToken(): string {
        return this.accessToken;
    }

    getInstanceUrl(): string {
        return this.instanceUrl;
    }

    // Record creation (tracks for cleanup)
    async createAccount(name: string, extraFields?: Record<string, unknown>): Promise<string> {
        return this.createRecord('Account', { Name: name, ...extraFields });
    }

    async createContact(data: {
        LastName: string;
        AccountId?: string;
        [key: string]: unknown;
    }): Promise<string> {
        return this.createRecord('Contact', data);
    }

    async createRecord(objectType: string, fields: Record<string, unknown>): Promise<string> {
        const response = await this.request('POST', `/sobjects/${objectType}`, fields);
        const id = response.id;
        this.createdRecords.push({ type: objectType, id });
        return id;
    }

    // Record deletion
    async deleteRecord(objectType: string, id: string): Promise<void> {
        await this.request('DELETE', `/sobjects/${objectType}/${id}`);
        // Remove from tracking
        this.createdRecords = this.createdRecords.filter(
            r => !(r.type === objectType && r.id === id)
        );
    }

    // Cleanup all tracked records (call in teardown)
    async cleanupAll(): Promise<void> {
        // Delete in reverse order (children before parents)
        for (const record of this.createdRecords.reverse()) {
            try {
                await this.request('DELETE', `/sobjects/${record.type}/${record.id}`);
            } catch (e) {
                console.warn(
                    `  ⚠️ Failed to delete ${record.type}/${record.id}: ${(e as Error).message}`
                );
            }
        }
        this.createdRecords = [];
    }

    // Query helper
    async query<T = Record<string, unknown>>(soql: string): Promise<T[]> {
        const response = await this.request('GET', `/query?q=${encodeURIComponent(soql)}`);
        return response.records;
    }

    // Get a single record
    async getRecord<T = Record<string, unknown>>(
        objectType: string,
        id: string,
        fields?: string[]
    ): Promise<T> {
        let path = `/sobjects/${objectType}/${id}`;
        if (fields && fields.length > 0) {
            path += `?fields=${fields.join(',')}`;
        }
        return this.request('GET', path);
    }

    // Update a record
    async updateRecord(
        objectType: string,
        id: string,
        fields: Record<string, unknown>
    ): Promise<void> {
        await this.request('PATCH', `/sobjects/${objectType}/${id}`, fields);
    }

    // Delete all trace flags (for test cleanup)
    async deleteAllTraceFlags(): Promise<{ deletedCount: number }> {
        const query = 'SELECT Id FROM TraceFlag';
        const response = await this.toolingRequest('GET', `/query?q=${encodeURIComponent(query)}`);
        const flagIds = (response.records || []).map((f: any) => f.Id);

        if (flagIds.length === 0) {
            return { deletedCount: 0 };
        }

        // Delete in batches of 25 (Tooling API composite limit)
        let deletedCount = 0;
        const batchSize = 25;

        for (let i = 0; i < flagIds.length; i += batchSize) {
            const batch = flagIds.slice(i, i + batchSize);
            const compositeRequest = {
                allOrNone: false,
                compositeRequest: batch.map((id: string, idx: number) => ({
                    method: 'DELETE',
                    url: `/services/data/v${API_VERSION}/tooling/sobjects/TraceFlag/${id}`,
                    referenceId: `delete_${idx}`,
                })),
            };

            await this.toolingRequest('POST', '/composite', compositeRequest);
            deletedCount += batch.length;
        }

        return { deletedCount };
    }

    // Raw API request
    private async request(method: string, path: string, body?: unknown): Promise<any> {
        const url = `${this.instanceUrl}/services/data/v${API_VERSION}${path}`;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            let errorMessage: string;
            try {
                const errors: SalesforceError[] = await response.json();
                errorMessage = errors.map(e => e.message).join(', ');
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(`Salesforce API error: ${errorMessage}`);
        }

        // 204 No Content (for DELETE, PATCH)
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }

    // Tooling API request
    private async toolingRequest(method: string, path: string, body?: unknown): Promise<any> {
        const url = `${this.instanceUrl}/services/data/v${API_VERSION}/tooling${path}`;

        const headers: Record<string, string> = {
            Authorization: `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json',
        };

        const options: RequestInit = {
            method,
            headers,
        };

        if (body) {
            options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (!response.ok) {
            let errorMessage: string;
            try {
                const errors: SalesforceError[] = await response.json();
                errorMessage = errors.map(e => e.message).join(', ');
            } catch {
                errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            }
            throw new Error(`Salesforce Tooling API error: ${errorMessage}`);
        }

        // 204 No Content
        if (response.status === 204) {
            return null;
        }

        return response.json();
    }
}
