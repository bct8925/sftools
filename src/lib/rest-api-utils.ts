/**
 * REST API Tab utility functions
 */

/**
 * Determines if an HTTP method should show the request body input.
 */
export function shouldShowBody(method: string): boolean {
    return method === 'POST' || method === 'PATCH' || method === 'PUT';
}
