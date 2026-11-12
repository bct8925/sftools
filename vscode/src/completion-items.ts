// Maps VS Code completion items to sftools' editor-neutral suggestions.
// Structural types only (no vscode import), so it is unit tested.

import type { CompletionKind, CompletionSuggestion } from '../../src/lib/completion';

interface PositionLike {
    line: number;
    character: number;
}
interface RangeLike {
    start: PositionLike;
    end: PositionLike;
}

/** The parts of vscode.CompletionItem that are used */
export interface CompletionItemLike {
    label: string | { label: string; detail?: string; description?: string };
    kind?: number;
    detail?: string;
    documentation?: string | { value: string };
    insertText?: string | { value: string };
    sortText?: string;
    filterText?: string;
    range?: RangeLike | { inserting: RangeLike; replacing: RangeLike };
}

const KNOWN_KINDS = new Set<CompletionKind>([
    'field',
    'constant',
    'reference',
    'value',
    'enum',
    'keyword',
    'unit',
    'event',
    'module',
    'class',
    'function',
    'method',
    'constructor',
    'variable',
    'property',
    'interface',
    'struct',
    'enumMember',
    'typeParameter',
    'operator',
    'snippet',
    'text',
    'color',
    'file',
    'folder',
]);

/** VS Code's kind name (e.g. "EnumMember") as a CompletionKind */
export function toCompletionKind(kindName: string | undefined): CompletionKind {
    if (!kindName) return 'text';
    const kind = (kindName.charAt(0).toLowerCase() + kindName.slice(1)) as CompletionKind;
    return KNOWN_KINDS.has(kind) ? kind : 'text';
}

function isRange(value: unknown): value is RangeLike {
    return !!value && typeof value === 'object' && 'start' in value && 'end' in value;
}

export function toSuggestion(
    item: CompletionItemLike,
    kindName: (kind: number) => string | undefined,
    offsetAt: (position: PositionLike) => number
): CompletionSuggestion {
    const label = typeof item.label === 'string' ? item.label : item.label.label;
    const labelDetail = typeof item.label === 'string' ? undefined : item.label.description;
    const insert = item.insertText ?? label;
    const suggestion: CompletionSuggestion = {
        label,
        kind: toCompletionKind(item.kind === undefined ? undefined : kindName(item.kind)),
        insertText: typeof insert === 'string' ? insert : insert.value,
    };
    if (typeof insert !== 'string') suggestion.snippet = true;
    const detail = item.detail ?? labelDetail;
    if (detail) suggestion.detail = detail;
    if (item.documentation) {
        suggestion.documentation =
            typeof item.documentation === 'string' ? item.documentation : item.documentation.value;
    }
    if (item.sortText) suggestion.sortText = item.sortText;
    if (item.filterText) suggestion.filterText = item.filterText;

    const range = isRange(item.range) ? item.range : item.range?.replacing;
    if (range && range.start.line === range.end.line) {
        suggestion.range = { start: offsetAt(range.start), end: offsetAt(range.end) };
    }
    return suggestion;
}
