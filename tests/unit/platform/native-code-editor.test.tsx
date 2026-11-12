/**
 * Tests for the VS Code build of CodeEditor (src/components/code-editor/NativeCodeEditor.tsx)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRef } from 'react';
import { render, act, fireEvent } from '@testing-library/react';
import { resetPlatformForTests } from '../../../src/platform/index.testing';
import type { CodeEditorRef } from '../../../src/components/code-editor/types';

let posted: any[];

function deliver(data: unknown) {
    window.dispatchEvent(new MessageEvent('message', { data }));
}

async function loadEditor() {
    const mod = await import('../../../src/components/code-editor/NativeCodeEditor');
    return mod;
}

describe('NativeCodeEditor', () => {
    beforeEach(() => {
        vi.resetModules();
        resetPlatformForTests();
        posted = [];
        (window as any).acquireVsCodeApi = () => ({ postMessage: (m: unknown) => posted.push(m) });
        (window as any).__SFTOOLS_VSCODE__ = { launchParams: '' };
    });

    afterEach(() => {
        delete (window as any).acquireVsCodeApi;
        delete (window as any).__SFTOOLS_VSCODE__;
        resetPlatformForTests();
    });

    it('maps languages to native document extensions', async () => {
        const { getDocumentExtension } = await loadEditor();
        expect(getDocumentExtension('sql', false)).toBe('soql');
        expect(getDocumentExtension('apex', false)).toBe('apex');
        expect(getDocumentExtension('apex', true)).toBe('log');
        expect(getDocumentExtension('json', false)).toBe('json');
        expect(getDocumentExtension('text', false)).toBe('txt');
    });

    it('opens its native document on mount and follows edits made there', async () => {
        const { CodeEditor } = await loadEditor();
        const onChange = vi.fn();
        const onExecute = vi.fn();
        const ref = createRef<CodeEditorRef>();
        render(
            <CodeEditor
                ref={ref}
                language="sql"
                value="SELECT Id FROM Account"
                documentName="Query"
                openNativeEditor
                onChange={onChange}
                onExecute={onExecute}
            />
        );

        const open = posted.find(p => p.message?.type === 'editor:open')?.message;
        expect(open).toMatchObject({
            name: 'Query',
            extension: 'soql',
            value: 'SELECT Id FROM Account',
            readonly: false,
            reveal: true,
        });

        act(() =>
            deliver({
                kind: 'event',
                message: {
                    type: 'editor:changed',
                    docId: open.docId,
                    value: 'SELECT Name FROM Contact',
                },
            })
        );
        expect(ref.current?.getValue()).toBe('SELECT Name FROM Contact');
        expect(onChange).toHaveBeenCalledWith('SELECT Name FROM Contact');

        act(() =>
            deliver({ kind: 'event', message: { type: 'editor:execute', docId: open.docId } })
        );
        act(() => deliver({ kind: 'event', message: { type: 'editor:execute', docId: 'other' } }));
        expect(onExecute).toHaveBeenCalledTimes(1);
    });

    it('syncs programmatic changes and markers to the host', async () => {
        vi.useFakeTimers();
        try {
            const { CodeEditor } = await loadEditor();
            const ref = createRef<CodeEditorRef>();
            render(<CodeEditor ref={ref} language="apex" readonly documentName="Debug Log" />);
            const docId = posted.find(p => p.message?.type === 'editor:open').message.docId;

            act(() => {
                ref.current?.setValue('line 1\n');
                ref.current?.appendValue('line 2');
            });
            vi.advanceTimersByTime(200);
            const updates = posted.filter(p => p.message?.type === 'editor:update');
            expect(updates).toHaveLength(1);
            expect(updates[0].message).toEqual({
                type: 'editor:update',
                docId,
                value: 'line 1\nline 2',
            });

            act(() => ref.current?.setMarkers([{ message: 'Bad', line: 2 }]));
            expect(posted.at(-1).message).toEqual({
                type: 'editor:markers',
                docId,
                markers: [{ message: 'Bad', line: 2 }],
            });
        } finally {
            vi.useRealTimers();
        }
    });

    it('runs on Ctrl+Enter in the panel view', async () => {
        const { CodeEditor } = await loadEditor();
        const onExecute = vi.fn();
        const { container } = render(<CodeEditor language="json" onExecute={onExecute} />);
        fireEvent.keyDown(container.querySelector('textarea')!, { key: 'Enter', ctrlKey: true });
        expect(onExecute).toHaveBeenCalled();
    });

    it('answers completion requests from its completion source', async () => {
        const { CodeEditor } = await loadEditor();
        const provide = vi.fn(async () => [
            { label: 'Name', kind: 'field' as const, insertText: 'Name' },
        ]);
        render(
            <CodeEditor language="sql" completionSource={{ triggerCharacters: ['.'], provide }} />
        );
        const docId = posted.find(p => p.message?.type === 'editor:open').message.docId;

        deliver({
            kind: 'hostRequest',
            id: 3,
            message: { type: 'editor:complete', docId, text: 'SELECT N', offset: 8 },
        });

        // (Platforms from earlier tests also listen on window, so look for this answer)
        await vi.waitFor(() =>
            expect(posted).toContainEqual({
                kind: 'hostResponse',
                id: 3,
                result: [{ label: 'Name', kind: 'field', insertText: 'Name' }],
            })
        );
        expect(provide).toHaveBeenCalledWith('SELECT N', 8);
    });

    it('tells the host when it unmounts', async () => {
        const { CodeEditor } = await loadEditor();
        const { unmount } = render(<CodeEditor language="json" />);
        const docId = posted.find(p => p.message?.type === 'editor:open').message.docId;
        unmount();
        expect(posted.at(-1).message).toEqual({ type: 'editor:dispose', docId });
    });
});
