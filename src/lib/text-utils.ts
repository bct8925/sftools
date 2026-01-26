// Text utility functions for HTML escaping and formatting

/**
 * Escape HTML special characters
 * Prevents XSS by converting special characters to HTML entities
 */
export function escapeHtml(str: string | null | undefined): string {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape HTML attribute values
 * Safe for use in HTML attributes like data-* or title
 */
export function escapeAttr(str: string | null | undefined): string {
    if (str === null || str === undefined) return '';
    const s = typeof str !== 'string' ? String(str) : str;
    return s
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Truncate string to specified length with ellipsis
 */
export function truncate(str: string | null | undefined, length: number): string {
    if (!str || str.length <= length) return str || '';
    return `${str.substring(0, length)}...`;
}
