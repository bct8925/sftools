// CORS error detection and handling utilities

/**
 * Detect if an error is caused by CORS
 * @param {object} response - Fetch response object
 * @returns {boolean} - True if CORS error detected
 */
export function isCorsError(response) {
    // CORS errors typically manifest as:
    // 1. Failed requests with status 0 (network error)
    // 2. "Failed to fetch" error message (generic browser CORS/network error)
    // 3. Error message containing CORS-related keywords (rare, but check anyway)
    const errorText = (response.error || '').toLowerCase();
    if (!response.success && response.status === 0 && errorText.includes('failed to fetch')) {
        return true;
    }

    // Check for explicit CORS keywords (less common but possible)
    const corsKeywords = ['cors', 'cross-origin', 'access-control'];
    return corsKeywords.some(keyword => errorText.includes(keyword));
}

/**
 * Show CORS error modal if available
 * Dispatches a global event that the app can listen to
 */
export function showCorsErrorModal() {
    const event = new CustomEvent('show-cors-error');
    document.dispatchEvent(event);
}
