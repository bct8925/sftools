// Operation metadata shared across data-import sections
import type { BulkIngestOperation } from '../../types/salesforce';

// Record enforces a label for every operation at compile time
export const OPERATION_LABELS: Record<BulkIngestOperation, string> = {
    insert: 'Insert',
    update: 'Update',
    upsert: 'Upsert',
    delete: 'Delete',
};

// Display order for the operation selector
export const OPERATIONS: BulkIngestOperation[] = ['insert', 'update', 'upsert', 'delete'];
