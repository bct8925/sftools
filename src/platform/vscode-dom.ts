// Browser behavior a VS Code webview needs that Chrome pages get for free.

/** Elements whose text a right-click selects when nothing else is selected */
const COPYABLE = 'a[href], td, th';

function webLink(target: EventTarget | null): HTMLAnchorElement | null {
    const element = target instanceof Element ? target : null;
    const link = element?.closest<HTMLAnchorElement>('a[href]');
    if (!link) return null;
    const href = link.getAttribute('href') ?? '';
    return /^https?:\/\//i.test(href) ? link : null;
}

/**
 * - Web links open through the host, so org pages land in VS Code's integrated
 *   browser signed in, rather than in the system browser VS Code picks for webviews.
 *   This runs in the capture phase because some links stop propagation (and relative
 *   links, like record pages, are left to their own handlers).
 * - Right-clicking a link or table cell with nothing selected selects its text, so the
 *   context menu's Copy copies it.
 */
export function installWebviewBehaviors(
    win: Pick<Window, 'addEventListener' | 'getSelection'>,
    openExternal: (url: string) => void
): void {
    const openLink = (event: MouseEvent) => {
        if (event.button > 1) return;
        const link = webLink(event.target);
        if (!link) return;
        event.preventDefault();
        openExternal(link.href);
    };
    win.addEventListener('click', openLink, true);
    win.addEventListener('auxclick', openLink, true);

    win.addEventListener(
        'contextmenu',
        (event: MouseEvent) => {
            const element = event.target instanceof Element ? event.target : null;
            const copyable = element?.closest(COPYABLE);
            const selection = win.getSelection();
            if (!copyable || !selection) return;
            const hasSelection = !selection.isCollapsed && selection.toString().trim() !== '';
            if (hasSelection) return;
            const range = copyable.ownerDocument.createRange();
            range.selectNodeContents(copyable);
            selection.removeAllRanges();
            selection.addRange(range);
        },
        true
    );
}
