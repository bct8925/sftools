import { useState, useRef, useCallback, useEffect } from 'react';
import { MonacoEditor, type MonacoEditorRef, monaco } from '../monaco-editor/MonacoEditor';
import { ApexHistory, type ApexHistoryRef } from './ApexHistory';
import { ApexOutput } from './ApexOutput';
import { CollapseChevron } from '../collapse-chevron/CollapseChevron';
import { StatusBadge } from '../status-badge/StatusBadge';
import { useConnection } from '../../contexts/ConnectionContext';
import { useStatusBadge } from '../../hooks/useStatusBadge';
import { executeAnonymousApex } from '../../api/salesforce';
import { formatOutput } from '../../lib/apex-utils';
import type { ApexExecutionResult } from '../../types/salesforce';
import styles from './ApexTab.module.css';

const DEFAULT_CODE = `// Enter your Apex code here
System.debug('Hello from Anonymous Apex!');

// Example: Query and debug accounts
List<Account> accounts = [SELECT Id, Name FROM Account LIMIT 5];
for (Account acc : accounts) {
    System.debug('Account: ' + acc.Name);
}`;

/**
 * Anonymous Apex execution tab with history, favorites, and debug logging
 */
export function ApexTab() {
    const { isAuthenticated } = useConnection();
    const codeEditorRef = useRef<MonacoEditorRef>(null);
    const historyRef = useRef<ApexHistoryRef>(null);

    const [isExecuting, setIsExecuting] = useState(false);
    const [output, setOutput] = useState('// Output will appear here after execution');
    const [initialCode, setInitialCode] = useState<string | null>(null);
    const [isApexCollapsed, setIsApexCollapsed] = useState(false);
    const handleToggleApex = useCallback(() => setIsApexCollapsed(prev => !prev), []);
    const { statusText, statusType, updateStatus } = useStatusBadge();

    // Load last Apex code from history or favorites on mount (whichever is more recent)
    useEffect(() => {
        chrome.storage.local.get(['apexHistory', 'apexFavorites']).then(data => {
            const history = data.apexHistory as
                | Array<{ code: string; timestamp: number }>
                | undefined;
            const favorites = data.apexFavorites as
                | Array<{ code: string; timestamp: number }>
                | undefined;

            // Find most recent from both arrays
            const lastHistory = history?.[0];
            const lastFavorite = favorites?.reduce(
                (latest, fav) => (!latest || fav.timestamp > latest.timestamp ? fav : latest),
                undefined as (typeof favorites)[0] | undefined
            );

            let lastCode: string | undefined;
            if (lastHistory && lastFavorite) {
                lastCode =
                    lastHistory.timestamp > lastFavorite.timestamp
                        ? lastHistory.code
                        : lastFavorite.code;
            } else if (lastHistory) {
                lastCode = lastHistory.code;
            } else if (lastFavorite) {
                lastCode = lastFavorite.code;
            }

            // Set resolved initial code (use DEFAULT_CODE if no history)
            setInitialCode(lastCode ?? DEFAULT_CODE);
        });
    }, []);

    // Set editor markers for compile/runtime errors
    const setEditorMarkers = useCallback((result: ApexExecutionResult) => {
        const editor = codeEditorRef.current?.getEditor();
        const model = editor?.getModel();
        if (!model) return;

        monaco.editor.setModelMarkers(model, 'apex', []);

        const markers = [];

        if (!result.compiled && result.compileProblem && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.compileProblem,
                startLineNumber: result.line,
                startColumn: result.column || 1,
                endLineNumber: result.line,
                endColumn: result.column ? result.column + 10 : model.getLineMaxColumn(result.line),
            });
        } else if (!result.success && result.exceptionMessage && result.line) {
            markers.push({
                severity: monaco.MarkerSeverity.Error,
                message: result.exceptionMessage,
                startLineNumber: result.line,
                startColumn: 1,
                endLineNumber: result.line,
                endColumn: model.getLineMaxColumn(result.line),
            });
        }

        if (markers.length > 0) {
            monaco.editor.setModelMarkers(model, 'apex', markers);
        }
    }, []);

    // Execute Apex code
    const handleExecute = useCallback(async () => {
        const apexCode = codeEditorRef.current?.getValue().trim() || '';

        if (!apexCode) {
            setOutput('// Please enter Apex code to execute');
            return;
        }

        if (!isAuthenticated) {
            alert('Not authenticated. Please authorize via the connection selector.');
            return;
        }

        // Clear previous markers
        const editor = codeEditorRef.current?.getEditor();
        const model = editor?.getModel();
        if (model) {
            monaco.editor.setModelMarkers(model, 'apex', []);
        }

        setIsExecuting(true);

        try {
            const result = await executeAnonymousApex(apexCode, (status: string) => {
                updateStatus(status, 'loading');
                setOutput(`// ${status}`);
            });

            setEditorMarkers(result.execution);

            if (!result.execution.compiled) {
                updateStatus('Compile Error', 'error');
            } else if (!result.execution.success) {
                updateStatus('Runtime Error', 'error');
            } else {
                updateStatus('Success', 'success');
            }

            setOutput(formatOutput(result.execution, result.debugLog));

            // Save to history after successful execution
            await historyRef.current?.saveToHistory(apexCode);
        } catch (error) {
            updateStatus('Error', 'error');
            setOutput(`Error: ${(error as Error).message}`);
            console.error('Apex execution error:', error);
        } finally {
            setIsExecuting(false);
        }
    }, [isAuthenticated, updateStatus, setEditorMarkers]);

    // Load script from history/favorites
    const handleLoadScript = useCallback((code: string) => {
        codeEditorRef.current?.setValue(code);
    }, []);

    // Wait for initial code to be resolved before rendering editor
    if (initialCode === null) {
        return (
            <div className={styles.apexTab} data-testid="apex-tab">
                <div className="card">
                    <div className="card-header">
                        <div className={`card-header-icon ${styles.headerIcon}`}>A</div>
                        <h2>Anonymous Apex</h2>
                    </div>
                    <div className="card-body">
                        <div className={styles.editorPlaceholder} />
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.apexTab} data-testid="apex-tab">
            <div className="card">
                <div className="card-header">
                    <div className={`card-header-icon ${styles.headerIcon}`}>A</div>
                    <h2 className="card-collapse-title" onClick={handleToggleApex}>
                        Anonymous Apex
                    </h2>
                    <CollapseChevron isOpen={!isApexCollapsed} onClick={handleToggleApex} />
                    <ApexHistory ref={historyRef} onLoadScript={handleLoadScript} />
                </div>
                <div className="card-body" hidden={isApexCollapsed}>
                    <div className="form-element">
                        <MonacoEditor
                            ref={codeEditorRef}
                            language="apex"
                            value={initialCode}
                            onExecute={handleExecute}
                            className="monaco-container"
                            data-testid="apex-editor"
                        />
                    </div>
                    <div className="m-top_small">
                        <button
                            className="button-brand"
                            onClick={handleExecute}
                            disabled={isExecuting}
                            data-testid="apex-execute-btn"
                        >
                            Execute
                        </button>
                        <StatusBadge type={statusType} data-testid="apex-status">
                            {statusText}
                        </StatusBadge>
                    </div>
                </div>
            </div>

            <ApexOutput output={output} className={styles.outputCard} />
        </div>
    );
}
