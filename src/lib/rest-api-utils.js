/**
 * REST API Tab utility functions
 */

/**
 * Determines if an HTTP method should show the request body input.
 * @param {string} method - HTTP method (GET, POST, PATCH, PUT, DELETE)
 * @returns {boolean} - True if body should be shown
 */
export function shouldShowBody(method) {
    return method === 'POST' || method === 'PATCH' || method === 'PUT';
}
