/**
 * Tests for the webview link and right-click handling (src/platform/vscode-dom.ts)
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installWebviewBehaviors } from '../../../src/platform/vscode-dom';

describe('installWebviewBehaviors', () => {
    let host: HTMLDivElement;
    let target: EventTarget;
    let openExternal: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        host = document.createElement('div');
        host.innerHTML = `
            <a id="web" href="https://acme.my.salesforce.com/001000000000001AAA"><span id="inner">001000000000001AAA</span></a>
            <a id="relative" href="record.html?recordId=1">Related</a>
            <table><tbody><tr><td id="cell">Acme Corp</td></tr></tbody></table>
            <p id="plain">plain text</p>`;
        document.body.appendChild(host);
        // A fresh target per test, so listeners from earlier tests don't fire
        target = new EventTarget();
        openExternal = vi.fn();
        installWebviewBehaviors(
            {
                addEventListener: target.addEventListener.bind(target),
                getSelection: () => window.getSelection(),
            } as unknown as Window,
            openExternal
        );
        window.getSelection()?.removeAllRanges();
    });

    afterEach(() => host.remove());

    function fire(type: string, element: Element, init: MouseEventInit = {}): MouseEvent {
        const event = new MouseEvent(type, { bubbles: true, cancelable: true, ...init });
        Object.defineProperty(event, 'target', { value: element });
        target.dispatchEvent(event);
        return event;
    }

    it('opens web links through the host', () => {
        const event = fire('click', document.getElementById('inner')!);
        expect(event.defaultPrevented).toBe(true);
        expect(openExternal).toHaveBeenCalledWith(
            'https://acme.my.salesforce.com/001000000000001AAA'
        );
    });

    it('opens web links on middle click too', () => {
        fire('auxclick', document.getElementById('web')!, { button: 1 });
        expect(openExternal).toHaveBeenCalledTimes(1);
    });

    it('leaves relative links and other clicks alone', () => {
        expect(fire('click', document.getElementById('relative')!).defaultPrevented).toBe(false);
        expect(fire('click', document.getElementById('plain')!).defaultPrevented).toBe(false);
        expect(openExternal).not.toHaveBeenCalled();
    });

    it('selects a link or cell on right-click when nothing is selected', () => {
        fire('contextmenu', document.getElementById('inner')!);
        expect(window.getSelection()!.toString()).toBe('001000000000001AAA');

        window.getSelection()!.removeAllRanges();
        fire('contextmenu', document.getElementById('cell')!);
        expect(window.getSelection()!.toString()).toBe('Acme Corp');
    });

    it('keeps an existing selection and ignores other elements', () => {
        const range = document.createRange();
        range.selectNodeContents(document.getElementById('plain')!);
        window.getSelection()!.addRange(range);
        fire('contextmenu', document.getElementById('cell')!);
        expect(window.getSelection()!.toString()).toBe('plain text');

        window.getSelection()!.removeAllRanges();
        fire('contextmenu', document.getElementById('plain')!);
        expect(window.getSelection()!.toString()).toBe('');
    });
});
