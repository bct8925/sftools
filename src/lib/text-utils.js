// Text utility functions for HTML escaping and formatting

/**
 * Escape HTML special characters
 * Prevents XSS by converting special characters to HTML entities
 * @param {string} str - String to escape
 * @returns {string} - HTML-safe string
 */
export function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Escape HTML attribute values
 * Safe for use in HTML attributes like data-* or title
 * @param {string} str - String to escape
 * @returns {string} - Attribute-safe string
 */
export function escapeAttr(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Truncate string to specified length with ellipsis
 * @param {string} str - String to truncate
 * @param {number} length - Maximum length before truncation
 * @returns {string} - Truncated string with ellipsis if needed
 */
export function truncate(str, length) {
    if (!str || str.length <= length) return str || '';
    return str.substring(0, length) + '...';
}
