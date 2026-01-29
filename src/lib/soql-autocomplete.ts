// SOQL Autocomplete for Query Tab
import { parseQuery } from '@jetstreamapp/soql-parser-js';
import { monaco } from '../components/monaco-editor/MonacoEditor';
import type { FieldDescribe, DescribeGlobalResult } from '../types/salesforce';
import { getGlobalDescribe, getObjectDescribe } from '../api/salesforce';

// Module state
interface AutocompleteState {
    active: boolean;
    providerRegistered: boolean;
    globalDescribe: DescribeGlobalResult | null;
    globalDescribePromise: Promise<DescribeGlobalResult | null> | null;
    fromObject: string | null;
    fromObjectLoadId: number;
    fields: FieldDescribe[];
    relationships: Map<string, RelationshipMetadata>;
}

interface RelationshipMetadata {
    targetObject: string;
    fields: FieldDescribe[];
    relationshipName: string;
}

const state: AutocompleteState = {
    active: false,
    providerRegistered: false,
    globalDescribe: null,
    globalDescribePromise: null,
    fromObject: null,
    fromObjectLoadId: 0,
    fields: [],
    relationships: new Map(),
};

// SOQL Keywords
interface KeywordDefinition {
    name: string;
    description: string;
}

interface FunctionDefinition {
    name: string;
    signature: string;
    description: string;
}

const SOQL_KEYWORDS: KeywordDefinition[] = [
    { name: 'SELECT', description: 'Select fields to return' },
    { name: 'FROM', description: 'Specify the object to query' },
    { name: 'WHERE', description: 'Filter results' },
    { name: 'AND', description: 'Combine conditions (all must be true)' },
    { name: 'OR', description: 'Combine conditions (any can be true)' },
    { name: 'NOT', description: 'Negate a condition' },
    { name: 'IN', description: 'Match any value in a list' },
    { name: 'NOT IN', description: 'Exclude values in a list' },
    { name: 'LIKE', description: 'Pattern matching with wildcards' },
    { name: 'ORDER BY', description: 'Sort results' },
    { name: 'GROUP BY', description: 'Group results for aggregation' },
    { name: 'HAVING', description: 'Filter grouped results' },
    { name: 'LIMIT', description: 'Maximum number of records' },
    { name: 'OFFSET', description: 'Skip records for pagination' },
    { name: 'ASC', description: 'Sort ascending' },
    { name: 'DESC', description: 'Sort descending' },
    { name: 'NULLS FIRST', description: 'Put null values first' },
    { name: 'NULLS LAST', description: 'Put null values last' },
    { name: 'TRUE', description: 'Boolean true' },
    { name: 'FALSE', description: 'Boolean false' },
    { name: 'null', description: 'Null value' },
    { name: 'INCLUDES', description: 'Multi-select picklist contains value' },
    { name: 'EXCLUDES', description: 'Multi-select picklist excludes value' },
];

// Aggregate functions
const AGGREGATE_FUNCTIONS: FunctionDefinition[] = [
    { name: 'COUNT', signature: 'COUNT()', description: 'Count of records' },
    { name: 'COUNT', signature: 'COUNT(field)', description: 'Count of non-null values' },
    {
        name: 'COUNT_DISTINCT',
        signature: 'COUNT_DISTINCT(field)',
        description: 'Count of unique values',
    },
    { name: 'SUM', signature: 'SUM(field)', description: 'Sum of numeric values' },
    { name: 'AVG', signature: 'AVG(field)', description: 'Average of numeric values' },
    { name: 'MIN', signature: 'MIN(field)', description: 'Minimum value' },
    { name: 'MAX', signature: 'MAX(field)', description: 'Maximum value' },
];

// Universal fields that exist on all SObjects
const UNIVERSAL_FIELDS: FieldDescribe[] = [
    {
        name: 'Id',
        label: 'Record ID',
        type: 'id',
        calculated: false,
        nillable: false,
        updateable: false,
        createable: false,
    } as FieldDescribe,
    {
        name: 'Name',
        label: 'Name',
        type: 'string',
        calculated: false,
        nillable: false,
        updateable: true,
        createable: true,
    } as FieldDescribe,
];

// Date literals
const DATE_LITERALS: KeywordDefinition[] = [
    { name: 'TODAY', description: 'Current date' },
    { name: 'YESTERDAY', description: 'Previous day' },
    { name: 'TOMORROW', description: 'Next day' },
    { name: 'LAST_WEEK', description: 'Previous week' },
    { name: 'THIS_WEEK', description: 'Current week' },
    { name: 'NEXT_WEEK', description: 'Next week' },
    { name: 'LAST_MONTH', description: 'Previous month' },
    { name: 'THIS_MONTH', description: 'Current month' },
    { name: 'NEXT_MONTH', description: 'Next month' },
    { name: 'LAST_QUARTER', description: 'Previous quarter' },
    { name: 'THIS_QUARTER', description: 'Current quarter' },
    { name: 'NEXT_QUARTER', description: 'Next quarter' },
    { name: 'LAST_YEAR', description: 'Previous year' },
    { name: 'THIS_YEAR', description: 'Current year' },
    { name: 'NEXT_YEAR', description: 'Next year' },
    { name: 'LAST_N_DAYS:n', description: 'Last n days (replace n with number)' },
    { name: 'NEXT_N_DAYS:n', description: 'Next n days (replace n with number)' },
    { name: 'LAST_N_WEEKS:n', description: 'Last n weeks' },
    { name: 'NEXT_N_WEEKS:n', description: 'Next n weeks' },
    { name: 'LAST_N_MONTHS:n', description: 'Last n months' },
    { name: 'NEXT_N_MONTHS:n', description: 'Next n months' },
];

// Parse SOQL query with error handling
function parseSOQL(text: string): { sObject?: string } | null {
    try {
        return parseQuery(text, { allowPartialQuery: true });
    } catch {
        return null;
    }
}

// Extract FROM object
function extractFromObject(text: string): string | null {
    const parsed = parseSOQL(text);
    if (parsed?.sObject) {
        return parsed.sObject;
    }
    return null;
}

// Detect which clause the cursor is in
function detectClause(text: string, offset: number): string {
    const textBeforeCursor = text.substring(0, offset).toUpperCase();

    // Use regex to find clause keywords with word boundaries (handles newlines and varied whitespace)
    const clausePatterns: { name: string; pattern: RegExp }[] = [
        { name: 'SELECT', pattern: /\bSELECT\b/g },
        { name: 'FROM', pattern: /\bFROM\b/g },
        { name: 'WHERE', pattern: /\bWHERE\b/g },
        { name: 'ORDER BY', pattern: /\bORDER\s+BY\b/g },
        { name: 'GROUP BY', pattern: /\bGROUP\s+BY\b/g },
        { name: 'HAVING', pattern: /\bHAVING\b/g },
        { name: 'LIMIT', pattern: /\bLIMIT\b/g },
        { name: 'OFFSET', pattern: /\bOFFSET\b/g },
    ];

    // Find the last occurrence of each clause keyword
    let currentClause = 'SELECT';
    let maxIndex = -1;

    for (const { name, pattern } of clausePatterns) {
        let match;
        let lastIndex = -1;
        // Reset regex lastIndex to ensure fresh search
        pattern.lastIndex = 0;
        while ((match = pattern.exec(textBeforeCursor)) !== null) {
            lastIndex = match.index;
        }
        if (lastIndex > maxIndex) {
            maxIndex = lastIndex;
            currentClause = name;
        }
    }

    return currentClause;
}

// Extract dot chain from current position (e.g., "Account.Owner." -> ["Account", "Owner"])
function extractDotChain(text: string, offset: number): string[] | null {
    // Get text before cursor on current line
    const textBeforeCursor = text.substring(0, offset);
    const lastNewline = textBeforeCursor.lastIndexOf('\n');
    const lineText = textBeforeCursor.substring(lastNewline + 1);

    // Match a dot chain at the end (e.g., "Account.Owner." or "Account.")
    const match = lineText.match(/(\w+(?:\.\w+)*)\.\s*$/);
    if (match) {
        return match[1].split('.');
    }

    return null;
}

// Map field types to Monaco completion item kinds
function getCompletionKind(field: FieldDescribe): monaco.languages.CompletionItemKind {
    if (field.calculated) {
        return monaco.languages.CompletionItemKind.Constant;
    }
    if (field.type === 'reference') {
        return monaco.languages.CompletionItemKind.Reference;
    }
    if (field.type === 'boolean') {
        return monaco.languages.CompletionItemKind.Value;
    }
    if (field.type === 'picklist' || field.type === 'multipicklist') {
        return monaco.languages.CompletionItemKind.Enum;
    }
    if (field.type === 'id') {
        return monaco.languages.CompletionItemKind.Keyword;
    }
    if (['int', 'double', 'currency', 'percent'].includes(field.type)) {
        return monaco.languages.CompletionItemKind.Unit;
    }
    if (['date', 'datetime', 'time'].includes(field.type)) {
        return monaco.languages.CompletionItemKind.Event;
    }
    return monaco.languages.CompletionItemKind.Field;
}

// Resolve a relationship chain to get the target object
async function resolveRelationshipChain(
    baseObject: string,
    chain: string[]
): Promise<string | null> {
    let currentObject = baseObject;

    for (const relationshipName of chain) {
        // Check if we already have this relationship cached
        const cached = state.relationships.get(relationshipName.toLowerCase());
        if (cached) {
            currentObject = cached.targetObject;
            continue;
        }

        // Load the describe for current object
        const describe = await getObjectDescribe(currentObject);
        if (!describe?.fields) return null;

        // Find the field with this relationship name
        const field = describe.fields.find(
            f => f.relationshipName?.toLowerCase() === relationshipName.toLowerCase()
        );

        if (!field?.referenceTo?.length) return null;

        currentObject = field.referenceTo[0];
    }

    return currentObject;
}

// Load metadata for a FROM object
async function loadFromObject(objectName: string): Promise<void> {
    if (!objectName) return;

    // Increment load ID and capture for stale request detection
    const thisLoadId = ++state.fromObjectLoadId;

    // Update state immediately
    state.fromObject = objectName;
    state.fields = [];
    state.relationships.clear();

    try {
        const describe = await getObjectDescribe(objectName);

        // Discard if a newer request started while we were loading
        if (thisLoadId !== state.fromObjectLoadId) return;

        if (!describe?.fields) return;

        state.fields = describe.fields;

        // Extract relationships and load target objects in parallel
        const referenceFields = state.fields.filter(
            f => f.type === 'reference' && f.relationshipName && f.referenceTo?.length
        );

        const targetObjects = [...new Set(referenceFields.flatMap(f => f.referenceTo))];
        const describes = await Promise.all(
            targetObjects.map(obj => getObjectDescribe(obj).catch(() => null))
        );

        // Discard if a newer request started while loading relationships
        if (thisLoadId !== state.fromObjectLoadId) return;

        // Build relationship map
        for (const refField of referenceFields) {
            const targetObj = refField.referenceTo[0];
            const targetDescribe = describes.find(d => d?.name === targetObj);

            if (refField.relationshipName) {
                state.relationships.set(refField.relationshipName.toLowerCase(), {
                    targetObject: targetObj,
                    fields: targetDescribe?.fields || [],
                    relationshipName: refField.relationshipName,
                });
            }
        }
    } catch (error) {
        console.error('Failed to load object describe:', error);
    }
}

// Build field suggestions
function buildFieldSuggestions(
    fields: FieldDescribe[],
    range: monaco.IRange,
    sortPrefix: string = '1'
): monaco.languages.CompletionItem[] {
    return fields.map(field => ({
        label: field.name,
        kind: getCompletionKind(field),
        detail: field.type + (field.calculated ? ' (formula)' : ''),
        documentation: field.label,
        insertText: field.name,
        range,
        sortText: `${sortPrefix}_${field.name}`,
    }));
}

// Build relationship name suggestions
function buildRelationshipSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
    const suggestions: monaco.languages.CompletionItem[] = [];

    for (const [_key, rel] of state.relationships) {
        suggestions.push({
            label: rel.relationshipName,
            kind: monaco.languages.CompletionItemKind.Module,
            detail: `→ ${rel.targetObject}`,
            documentation: `Access fields from related ${rel.targetObject} record`,
            insertText: rel.relationshipName,
            range,
            sortText: `2_${rel.relationshipName}`,
        });
    }

    return suggestions;
}

// Build object name suggestions (for FROM clause) - lazy loads global describe
async function buildObjectSuggestions(
    range: monaco.IRange
): Promise<monaco.languages.CompletionItem[]> {
    // Lazy load global describe on first need (cached in storage per-connection)
    if (!state.globalDescribe) {
        // If already loading, wait for existing promise
        if (state.globalDescribePromise) {
            await state.globalDescribePromise;
        } else {
            // Start new load
            state.globalDescribePromise = getGlobalDescribe()
                .then(result => {
                    state.globalDescribe = result;
                    return result;
                })
                .catch(error => {
                    console.error('Failed to load global describe:', error);
                    return null;
                })
                .finally(() => {
                    state.globalDescribePromise = null;
                });
            await state.globalDescribePromise;
        }
    }

    if (!state.globalDescribe?.sobjects) return [];

    return state.globalDescribe.sobjects
        .filter(obj => obj.queryable)
        .map(obj => ({
            label: obj.name,
            kind: monaco.languages.CompletionItemKind.Class,
            detail: obj.label,
            insertText: obj.name,
            range,
            sortText: obj.name,
        }));
}

// Build keyword suggestions
function buildKeywordSuggestions(
    range: monaco.IRange,
    clause: string
): monaco.languages.CompletionItem[] {
    const suggestions: monaco.languages.CompletionItem[] = [];

    // Context-aware keyword filtering
    let keywords = SOQL_KEYWORDS;
    if (clause === 'ORDER BY') {
        keywords = SOQL_KEYWORDS.filter(k =>
            ['ASC', 'DESC', 'NULLS FIRST', 'NULLS LAST'].includes(k.name)
        );
    }

    for (const kw of keywords) {
        suggestions.push({
            label: kw.name,
            kind: monaco.languages.CompletionItemKind.Keyword,
            detail: 'Keyword',
            documentation: kw.description,
            insertText: kw.name,
            range,
            sortText: `5_${kw.name}`,
        });
    }

    return suggestions;
}

// Build aggregate function suggestions
function buildAggregateSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
    return AGGREGATE_FUNCTIONS.map(fn => ({
        label: fn.name,
        kind: monaco.languages.CompletionItemKind.Function,
        detail: fn.signature,
        documentation: fn.description,
        insertText: `${fn.name}($0)`,
        insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
        range,
        sortText: `3_${fn.name}`,
    }));
}

// Build date literal suggestions
function buildDateLiteralSuggestions(range: monaco.IRange): monaco.languages.CompletionItem[] {
    return DATE_LITERALS.map(dl => ({
        label: dl.name,
        kind: monaco.languages.CompletionItemKind.Constant,
        detail: 'Date Literal',
        documentation: dl.description,
        insertText: dl.name,
        range,
        sortText: `4_${dl.name}`,
    }));
}

// Register the completion provider (only once)
export function registerSOQLCompletionProvider(): void {
    if (state.providerRegistered) return;
    state.providerRegistered = true;

    monaco.languages.registerCompletionItemProvider('sql', {
        triggerCharacters: ['.', ' '],
        provideCompletionItems: async (model, position) => {
            if (!state.active) {
                return { suggestions: [] };
            }

            const text = model.getValue();
            const offset = model.getOffsetAt(position);

            // Extract FROM object (with regex fallback for partial queries)
            const fromObject = extractFromObject(text);

            // Load object metadata if FROM object changed
            if (fromObject && fromObject !== state.fromObject) {
                await loadFromObject(fromObject);
            }

            // Detect context
            const clause = detectClause(text, offset);
            const dotChain = extractDotChain(text, offset);

            // Get range for suggestions
            const word = model.getWordUntilPosition(position);
            const range: monaco.IRange = {
                startLineNumber: position.lineNumber,
                endLineNumber: position.lineNumber,
                startColumn: word.startColumn,
                endColumn: word.endColumn,
            };

            let suggestions: monaco.languages.CompletionItem[] = [];

            // Handle dot chain (relationship traversal)
            if (dotChain) {
                if (!state.fromObject) {
                    return { suggestions: [] };
                }

                // Resolve the chain to get target object
                const targetObject = await resolveRelationshipChain(state.fromObject, dotChain);
                if (targetObject) {
                    const describe = await getObjectDescribe(targetObject);
                    if (describe?.fields) {
                        suggestions = buildFieldSuggestions(describe.fields, range);

                        // Also add relationships from the target object
                        const targetRefs = describe.fields.filter(
                            f => f.type === 'reference' && f.relationshipName
                        );
                        for (const ref of targetRefs) {
                            if (ref.relationshipName) {
                                suggestions.push({
                                    label: ref.relationshipName,
                                    kind: monaco.languages.CompletionItemKind.Module,
                                    detail: `→ ${ref.referenceTo?.[0] || 'Object'}`,
                                    documentation: `Access fields from related ${ref.referenceTo?.[0]} record`,
                                    insertText: ref.relationshipName,
                                    range,
                                    sortText: `2_${ref.relationshipName}`,
                                });
                            }
                        }
                    }
                }
                return { suggestions };
            }

            // Build context-specific suggestions
            switch (clause) {
                case 'FROM':
                    suggestions = await buildObjectSuggestions(range);
                    break;

                case 'SELECT':
                    if (state.fields.length > 0) {
                        suggestions = [
                            ...buildFieldSuggestions(state.fields, range),
                            ...buildRelationshipSuggestions(range),
                            ...buildAggregateSuggestions(range),
                        ];
                    } else {
                        // No FROM object yet, show universal fields (Id) and aggregates
                        suggestions = [
                            ...buildFieldSuggestions(UNIVERSAL_FIELDS, range, '0'),
                            ...buildAggregateSuggestions(range),
                        ];
                    }
                    break;

                case 'WHERE':
                case 'HAVING':
                    if (state.fields.length > 0) {
                        suggestions = [
                            ...buildFieldSuggestions(state.fields, range),
                            ...buildRelationshipSuggestions(range),
                            ...buildDateLiteralSuggestions(range),
                        ];
                    }
                    break;

                case 'ORDER BY':
                case 'GROUP BY':
                    if (state.fields.length > 0) {
                        suggestions = [
                            ...buildFieldSuggestions(state.fields, range),
                            ...buildRelationshipSuggestions(range),
                        ];
                    }
                    break;
            }

            // Always include keywords in all contexts
            suggestions.push(...buildKeywordSuggestions(range, clause));

            return { suggestions };
        },
    });
}

// Activate autocomplete
export function activateSOQLAutocomplete(): void {
    state.active = true;
}

// Deactivate autocomplete (not currently used - query-tab is persistent)
export function deactivateSOQLAutocomplete(): void {
    state.active = false;
}

// Clear state (on connection change)
export function clearState(): void {
    state.fromObject = null;
    state.fields = [];
    state.relationships.clear();
    state.globalDescribe = null;
    state.globalDescribePromise = null;
}
