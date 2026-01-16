// UI Helper utilities for sftools components

/**
 * Update a status badge element with message and type styling
 * @param {HTMLElement} element - The status badge element
 * @param {string} message - The status message to display
 * @param {string} type - Status type ('loading', 'success', 'error', or '')
 */
export function updateStatusBadge(element, message, type = '') {
    element.textContent = message;
    element.className = 'status-badge';
    if (type) {
        element.classList.add(`status-${type}`);
    }
}
