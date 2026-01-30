import { useState, useRef, useCallback } from 'react';
import { MonacoEditor, type MonacoEditorRef } from '../monaco-editor/MonacoEditor';
import { useConnection } from '../../contexts/ConnectionContext';
import { executeRestRequest } from '../../api/salesforce';
import { shouldShowBody } from '../../lib/rest-api-utils';
import type { RestApiResponse } from '../../types/salesforce';
import { StatusBadge, type StatusType } from '../status-badge/StatusBadge';
import styles from './RestApiTab.module.css';

type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE';

interface StatusState {
  message: string;
  type: StatusType;
}

/**
 * REST API Explorer Tab - Send HTTP requests to Salesforce REST API
 */
export function RestApiTab() {
  const { isAuthenticated } = useConnection();
  const [url, setUrl] = useState('/services/data/v62.0/limits');
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [status, setStatus] = useState<StatusState>({ message: '', type: '' });

  const requestEditorRef = useRef<MonacoEditorRef>(null);
  const responseEditorRef = useRef<MonacoEditorRef>(null);

  const showBodyInput = shouldShowBody(method);

  const updateStatus = useCallback((message: string, type: StatusState['type'] = '') => {
    setStatus({ message, type });
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
        updateStatus('Invalid JSON', 'error');
        return;
      }
    }

    updateStatus('Loading...', 'loading');
    responseEditorRef.current?.setValue('// Loading...');

    try {
      const response: RestApiResponse = await executeRestRequest(urlValue, method, body);

      updateStatus(response.status.toString(), response.success ? 'success' : 'error');

      if (typeof response.data === 'object') {
        responseEditorRef.current?.setValue(JSON.stringify(response.data, null, 2));
      } else if (response.raw) {
        responseEditorRef.current?.setValue(response.raw);
      } else if (response.error) {
        responseEditorRef.current?.setValue(`Error: ${response.error}`);
      } else {
        responseEditorRef.current?.setValue(response.statusText || 'No response');
      }
    } catch (error) {
      updateStatus('Client Error', 'error');
      responseEditorRef.current?.setValue(`Error: ${(error as Error).message}`);
      console.error('REST API Error:', error);
    }
  }, [url, method, showBodyInput, isAuthenticated, updateStatus]);

  return (
    <div className={styles.restApiTab} data-testid="rest-api-tab">
      {/* Request Card */}
      <div className="card">
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconRest}`}>
            R
          </div>
          <h2>Request</h2>
        </div>
        <div className="card-body">
          <div className="form-element">
            <label htmlFor="rest-api-url">API URL (Relative to Instance)</label>
            <input
              id="rest-api-url"
              type="text"
              className="input"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              data-testid="rest-api-url"
            />
          </div>

          <div className="form-element">
            <label htmlFor="rest-method-select">HTTP Method</label>
            <select
              id="rest-method-select"
              className="select"
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
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
                value="{\n    \n}"
                onExecute={executeRequest}
                className={styles.requestEditor}
                data-testid="rest-request-editor"
              />
            </div>
          )}

          <div className="m-top_small">
            <button className="button-brand" onClick={executeRequest} data-testid="rest-send-btn">
              Send Request
            </button>
            {status.message && (
              <StatusBadge type={status.type} data-testid="rest-status">{status.message}</StatusBadge>
            )}
          </div>
        </div>
      </div>

      {/* Response Card */}
      <div className={`card ${styles.responseCard}`}>
        <div className="card-header">
          <div className={`card-header-icon ${styles.headerIconSuccess}`}>
            ✓
          </div>
          <h2>Response</h2>
        </div>
        <div className={`card-body ${styles.responseCardBody}`}>
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
