import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../../../src/api/salesforce-request.js', () => ({
	salesforceRequest: vi.fn(),
}));

vi.mock('../../../src/api/fetch.js', () => ({
	smartFetch: vi.fn(),
}));

vi.mock('../../../src/auth/auth.js', () => ({
	getAccessToken: vi.fn().mockReturnValue('test-token'),
	getInstanceUrl: vi.fn().mockReturnValue('https://test.salesforce.com'),
}));

import { getEventChannels, getPushTopics, getAllStreamingChannels, publishPlatformEvent } from '../../../src/api/streaming.js';
import { salesforceRequest } from '../../../src/api/salesforce-request.js';
import { smartFetch } from '../../../src/api/fetch.js';
import type { QueryResult } from '../../../src/types/salesforce.js';

beforeEach(() => {
	vi.clearAllMocks();
});

describe('getEventChannels', () => {
	it('returns custom events from tooling query', async () => {
		const mockCustomEvents = [
			{
				DeveloperName: 'MyCustomEvent',
				QualifiedApiName: 'MyCustomEvent__e',
				Label: 'My Custom Event',
			},
			{
				DeveloperName: 'AnotherEvent',
				QualifiedApiName: 'AnotherEvent__e',
				Label: 'Another Event',
			},
		];

		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: {
				records: mockCustomEvents,
				totalSize: 2,
				done: true,
			} as QueryResult,
		});

		const result = await getEventChannels();

		expect(result).toEqual({ customEvents: mockCustomEvents });
		expect(salesforceRequest).toHaveBeenCalledOnce();
		const callArg = vi.mocked(salesforceRequest).mock.calls[0][0] as string;
		expect(callArg).toContain('/tooling/query?q=');
		expect(callArg).toContain('%25__e'); // URL encoded %
	});

	it('returns empty array when no records', async () => {
		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: {
				records: [],
				totalSize: 0,
				done: true,
			} as QueryResult,
		});

		const result = await getEventChannels();

		expect(result).toEqual({ customEvents: [] });
	});

	it('returns empty array when json is undefined', async () => {
		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: undefined,
		});

		const result = await getEventChannels();

		expect(result).toEqual({ customEvents: [] });
	});
});

describe('getPushTopics', () => {
	it('returns active push topics', async () => {
		const mockPushTopics = [
			{
				Id: '0PT000000000001',
				Name: 'AccountUpdates',
				Query: 'SELECT Id, Name FROM Account',
				ApiVersion: '62.0',
				IsActive: true,
			},
			{
				Id: '0PT000000000002',
				Name: 'ContactUpdates',
				Query: 'SELECT Id, Name FROM Contact',
				ApiVersion: '62.0',
				IsActive: true,
			},
		];

		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: {
				records: mockPushTopics,
				totalSize: 2,
				done: true,
			} as QueryResult,
		});

		const result = await getPushTopics();

		expect(result).toEqual(mockPushTopics);
		expect(salesforceRequest).toHaveBeenCalledOnce();
		const callArg = vi.mocked(salesforceRequest).mock.calls[0][0] as string;
		expect(callArg).toContain('/query?q=');
		expect(callArg).toContain('PushTopic');
		expect(callArg).toContain('IsActive');
	});

	it('returns empty array when no records', async () => {
		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: {
				records: [],
				totalSize: 0,
				done: true,
			} as QueryResult,
		});

		const result = await getPushTopics();

		expect(result).toEqual([]);
	});

	it('returns empty array when json is undefined', async () => {
		vi.mocked(salesforceRequest).mockResolvedValue({
			success: true,
			status: 200,
			json: undefined,
		});

		const result = await getPushTopics();

		expect(result).toEqual([]);
	});
});

describe('getAllStreamingChannels', () => {
	it('combines all channel types', async () => {
		const mockCustomEvents = [
			{
				DeveloperName: 'MyEvent',
				QualifiedApiName: 'MyEvent__e',
				Label: 'My Event',
			},
		];

		const mockPushTopics = [
			{
				Id: '0PT000000000001',
				Name: 'AccountUpdates',
				Query: 'SELECT Id, Name FROM Account',
				ApiVersion: '62.0',
				IsActive: true,
			},
		];

		vi.mocked(salesforceRequest)
			.mockResolvedValueOnce({
				success: true,
				status: 200,
				json: {
					records: mockCustomEvents,
					totalSize: 1,
					done: true,
				} as QueryResult,
			})
			.mockResolvedValueOnce({
				success: true,
				status: 200,
				json: {
					records: mockPushTopics,
					totalSize: 1,
					done: true,
				} as QueryResult,
			});

		const result = await getAllStreamingChannels();

		expect(result.platformEvents).toEqual(mockCustomEvents);
		expect(result.pushTopics).toEqual(mockPushTopics);
		expect(result.standardEvents).toHaveLength(4);
		expect(result.standardEvents[0]).toEqual({
			name: 'BatchApexErrorEvent',
			label: 'Batch Apex Error Event',
		});
		expect(result.systemTopics).toHaveLength(1);
		expect(result.systemTopics[0]).toEqual({
			channel: '/systemTopic/Logging',
			label: 'Debug Logs',
		});
	});

	it('includes standard events and system topics', async () => {
		vi.mocked(salesforceRequest)
			.mockResolvedValueOnce({
				success: true,
				status: 200,
				json: {
					records: [],
					totalSize: 0,
					done: true,
				} as QueryResult,
			})
			.mockResolvedValueOnce({
				success: true,
				status: 200,
				json: {
					records: [],
					totalSize: 0,
					done: true,
				} as QueryResult,
			});

		const result = await getAllStreamingChannels();

		expect(result.standardEvents).toEqual([
			{ name: 'BatchApexErrorEvent', label: 'Batch Apex Error Event' },
			{ name: 'FlowExecutionErrorEvent', label: 'Flow Execution Error Event' },
			{ name: 'PlatformStatusAlertEvent', label: 'Platform Status Alert Event' },
			{ name: 'AsyncOperationEvent', label: 'Async Operation Event' },
		]);
		expect(result.systemTopics).toEqual([
			{ channel: '/systemTopic/Logging', label: 'Debug Logs' },
		]);
	});

	it('handles getPushTopics failure gracefully', async () => {
		const mockCustomEvents = [
			{
				DeveloperName: 'MyEvent',
				QualifiedApiName: 'MyEvent__e',
				Label: 'My Event',
			},
		];

		vi.mocked(salesforceRequest)
			.mockResolvedValueOnce({
				success: true,
				status: 200,
				json: {
					records: mockCustomEvents,
					totalSize: 1,
					done: true,
				} as QueryResult,
			})
			.mockRejectedValueOnce(new Error('PushTopic query failed'));

		const result = await getAllStreamingChannels();

		expect(result.platformEvents).toEqual(mockCustomEvents);
		expect(result.pushTopics).toEqual([]);
		expect(result.standardEvents).toHaveLength(4);
		expect(result.systemTopics).toHaveLength(1);
	});
});

describe('publishPlatformEvent', () => {
	it('successful publish returns id', async () => {
		vi.mocked(smartFetch).mockResolvedValue({
			success: true,
			status: 201,
			data: JSON.stringify({ id: '0e1000000000001' }),
		});

		const result = await publishPlatformEvent('MyEvent__e', {
			Field1__c: 'value1',
			Field2__c: 'value2',
		});

		expect(result).toEqual({
			success: true,
			id: '0e1000000000001',
			error: null,
		});
		expect(smartFetch).toHaveBeenCalledWith(
			'https://test.salesforce.com/services/data/v62.0/sobjects/MyEvent__e',
			{
				method: 'POST',
				headers: {
					Authorization: 'Bearer test-token',
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					Field1__c: 'value1',
					Field2__c: 'value2',
				}),
			}
		);
	});

	it('failed publish returns error message', async () => {
		vi.mocked(smartFetch).mockResolvedValue({
			success: false,
			status: 400,
			data: JSON.stringify([
				{
					message: 'Required field missing: Field1__c',
					errorCode: 'REQUIRED_FIELD_MISSING',
					fields: ['Field1__c'],
				},
			]),
		});

		const result = await publishPlatformEvent('MyEvent__e', {
			Field2__c: 'value2',
		});

		expect(result).toEqual({
			success: false,
			id: null,
			error: 'Required field missing: Field1__c',
		});
	});

	it('handles parse failure gracefully', async () => {
		vi.mocked(smartFetch).mockResolvedValue({
			success: false,
			status: 500,
			data: 'Internal Server Error',
		});

		const result = await publishPlatformEvent('MyEvent__e', {
			Field1__c: 'value1',
		});

		expect(result).toEqual({
			success: false,
			id: null,
			error: 'Publish failed',
		});
	});

	it('handles missing data in success response', async () => {
		vi.mocked(smartFetch).mockResolvedValue({
			success: true,
			status: 201,
			data: undefined,
		});

		const result = await publishPlatformEvent('MyEvent__e', {
			Field1__c: 'value1',
		});

		expect(result).toEqual({
			success: true,
			id: undefined,
			error: null,
		});
	});
});
