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

/**
 * Format a number using locale-aware thousands separators
 */
export function formatNumber(value: number): string {
    return value.toLocaleString();
}

/**
 * Format a number in compact notation: 783 → "783", 1500 → "1.5K", 1200000 → "1.2M"
 */
export function formatCompactNumber(value: number): string {
    if (value < 1000) return String(value);
    if (value < 1_000_000) {
        const k = value / 1000;
        return `${parseFloat(k.toFixed(1))}K`;
    }
    const m = value / 1_000_000;
    return `${parseFloat(m.toFixed(1))}M`;
}
