import { useState, useRef, useCallback, useEffect } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { RestApiHistory, type RestApiHistoryRef, type RestApiRequest } from './RestApiHistory';
import { useConnection } from '../../contexts/ConnectionContext';
import { executeRestRequest } from '../../api/salesforce';
import { shouldShowBody } from '../../lib/rest-api-utils';
import type { RestApiResponse } from '../../types/salesforce';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import { useToast } from '../../contexts/ToastContext';
import styles from './RestApiTab.module.css';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

/**
 * REST API Explorer Tab - Send HTTP requests to Salesforce REST API
 */
export function RestApiTab() {
    const { isAuthenticated } = useConnection();
    const toast = useToast();
    const [url, setUrl] = useState('/services/data/v62.0/limits');
    const [method, setMethod] = useState<HttpMethod>('GET');
    const [isRequestCollapsed, setIsRequestCollapsed] = useState(false);
    const [isResponseCollapsed, setIsResponseCollapsed] = useState(false);
    const [initialBody, setInitialBody] = useState('{\n  \n}');
    const handleToggleRequest = useCallback(() => setIsRequestCollapsed(prev => !prev), []);
    const handleToggleResponse = useCallback(() => setIsResponseCollapsed(prev => !prev), []);

    const requestEditorRef = useRef<MonacoEditorRef>(null);
    const responseEditorRef = useRef<MonacoEditorRef>(null);
    const historyRef = useRef<RestApiHistoryRef>(null);

    const showBodyInput = shouldShowBody(method);

    // Restore most recently used request from history on mount
    useEffect(() => {
        chrome.storage.local.get(['restApiHistory', 'restApiFavorites']).then(data => {
            const history = data.restApiHistory as
                | Array<{ request: string; timestamp: number }>
                | undefined;
            const favorites = data.restApiFavorites as
                | Array<{ request: string; timestamp: number }>
                | undefined;

            const lastHistory = history?.[0];
            const lastFavorite = favorites?.reduce(
                (latest, fav) => (!latest || fav.timestamp > latest.timestamp ? fav : latest),
                undefined as (typeof favorites)[0] | undefined
            );

            let lastRequest: string | undefined;
            if (lastHistory && lastFavorite) {
                lastRequest =
                    lastHistory.timestamp > lastFavorite.timestamp
                        ? lastHistory.request
                        : lastFavorite.request;
            } else if (lastHistory) {
                lastRequest = lastHistory.request;
            } else if (lastFavorite) {
                lastRequest = lastFavorite.request;
            }

            if (!lastRequest) return;

            try {
                const parsed = JSON.parse(lastRequest) as RestApiRequest;
                setUrl(parsed.url);
                setMethod(parsed.method as HttpMethod);
                if (parsed.body) setInitialBody(parsed.body);
            } catch {
                // Ignore malformed history entries
            }
        });
    }, []);

    const handleLoadRequest = useCallback((request: RestApiRequest) => {
        setUrl(request.url);
        setMethod(request.method as HttpMethod);
        if (request.body) {
            // Update initialBody for when the body editor mounts (method switching to body-type)
            setInitialBody(request.body);
            // Also set directly if the editor is already mounted (same method, different body)
            requestEditorRef.current?.setValue(request.body);
        }
    }, []);

    const executeRequest = useCallback(async () => {
        const urlValue = url.trim();

        if (!urlValue) {
            alert('Please enter an API URL.');
            return;
        }

        if (!isAuthenticated) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        // Validate JSON for POST/PATCH/PUT
        let body: string | null = null;
        if (showBodyInput) {
            const bodyValue = requestEditorRef.current?.getValue() ?? '';
            try {
                JSON.parse(bodyValue);
                body = bodyValue;
            } catch {
                alert('Invalid JSON in Request Body.');
                toast.show('Invalid JSON', 'error');
                return;
            }
        }

        const id = toast.show('Loading...', 'loading');
        responseEditorRef.current?.setValue('// Loading...');

        try {
            const response: RestApiResponse = await executeRestRequest(urlValue, method, body);

            if (response.success) {
                toast.update(id, `${response.status} ${response.statusText}`, 'success');
            } else {
                toast.update(id, response.status.toString(), 'error');
            }

            if (typeof response.data === 'object') {
                responseEditorRef.current?.setValue(JSON.stringify(response.data, null, 2));
            } else if (response.raw) {
                responseEditorRef.current?.setValue(response.raw);
            } else if (response.error) {
                responseEditorRef.current?.setValue(`Error: ${response.error}`);
            } else {
                responseEditorRef.current?.setValue(response.statusText || 'No response');
            }

            // Save to history after successful request
            const request = JSON.stringify({ method, url: urlValue, ...(body && { body }) });
            await historyRef.current?.saveToHistory(request);
        } catch (error) {
            toast.show('Client Error', 'error');
            responseEditorRef.current?.setValue(`Error: ${(error as Error).message}`);
            console.error('REST API Error:', error);
        }
    }, [url, method, showBodyInput, isAuthenticated, toast]);

    return (
        <div className={styles.restApiTab} data-testid="rest-api-tab">
            {/* Request Card */}
            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconRest}`}>R</div>
                    <h2 className="card-collapse-title" onClick={handleToggleRequest}>
                        Request
                    </h2>
                    <CollapseChevron isOpen={!isRequestCollapsed} onClick={handleToggleRequest} />
                    <RestApiHistory ref={historyRef} onLoadRequest={handleLoadRequest} />
                </div>
                <div className="card-body" hidden={isRequestCollapsed}>
                    <div className="form-element">
                        <label htmlFor="rest-api-url">API URL (Relative to Instance)</label>
                        <input
                            id="rest-api-url"
                            type="text"
                            className="input"
                            value={url}
                            onChange={e => setUrl(e.target.value)}
                            data-testid="rest-api-url"
                        />
                    </div>

                    <div className="form-element">
                        <label htmlFor="rest-method-select">HTTP Method</label>
                        <select
                            id="rest-method-select"
                            className="select"
                            value={method}
                            onChange={e => setMethod(e.target.value as HttpMethod)}
                            data-testid="rest-method-select"
                        >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                        </select>
                    </div>

                    {showBodyInput && (
                        <div className="form-element" data-testid="rest-body-container">
                            <label>Body (JSON)</label>
                            <MonacoEditor
                                ref={requestEditorRef}
                                language="json"
                                value={initialBody}
                                onExecute={executeRequest}
                                className={styles.requestEditor}
                                data-testid="rest-request-editor"
                            />
                        </div>
                    )}

                    <div className="m-top_small">
                        <button
                            className="button-brand"
                            onClick={executeRequest}
                            data-testid="rest-send-btn"
                        >
                            Send Request
                        </button>
                    </div>
                </div>
            </div>

            {/* Response Card */}
            <div
                className={`card ${styles.responseCard} ${isResponseCollapsed ? styles.responseCardCollapsed : ''}`}
            >
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIconSuccess}`}>✓</div>
                    <h2 className="card-collapse-title" onClick={handleToggleResponse}>
                        Response
                    </h2>
                    <CollapseChevron isOpen={!isResponseCollapsed} onClick={handleToggleResponse} />
                </div>
                <div
                    className={`card-body ${styles.responseCardBody}`}
                    hidden={isResponseCollapsed}
                >
                    <MonacoEditor
                        ref={responseEditorRef}
                        language="json"
                        value="// Response will appear here"
                        readonly
                        resizable={false}
                        className={styles.responseEditor}
                        data-testid="rest-response-editor"
                    />
                </div>
            </div>
        </div>
    );
}
