/**
 * REST API Handler
 *
 * Proxies HTTP requests to bypass CORS restrictions.
 * Supports all HTTP methods with headers and body.
 */

/**
 * Handle a REST API request
 * @param {object} request - The request object
 * @param {string} request.url - URL to fetch
 * @param {string} [request.method] - HTTP method (default: GET)
 * @param {object} [request.headers] - Request headers
 * @param {string|object} [request.body] - Request body (string or object)
 * @returns {Promise<object>} - Response object
 */
async function handleRest(request) {
    const { url, method = 'GET', headers = {}, body } = request;

    if (!url) {
        return {
            success: false,
            error: 'URL is required'
        };
    }

    try {
        // Prepare fetch options
        const fetchOptions = {
            method,
            headers: { ...headers }
        };

        // Handle body - can be string or object
        if (body !== undefined && body !== null) {
            if (typeof body === 'object') {
                fetchOptions.body = JSON.stringify(body);
            } else {
                fetchOptions.body = body;
            }
        }

        // Make the request
        const response = await fetch(url, fetchOptions);

        // Extract response headers
        const responseHeaders = {};
        response.headers.forEach((value, key) => {
            responseHeaders[key.toLowerCase()] = value;
        });

        // Get response body as text
        const data = await response.text();

        return {
            success: response.ok,
            status: response.status,
            statusText: response.statusText,
            headers: responseHeaders,
            data
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { handleRest };
