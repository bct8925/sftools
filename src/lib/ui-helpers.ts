// UI Helper utilities for sftools components

export type StatusType = 'loading' | 'success' | 'error' | '';

/**
 * Update a status badge element with message and type styling
 */
export function updateStatusBadge(
    element: HTMLElement,
    message: string,
    type: StatusType = ''
): void {
    element.textContent = message;
    element.className = 'status-badge';
    if (type) {
        element.classList.add(`status-${type}`);
    }
}
