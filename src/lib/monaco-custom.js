// Custom Monaco Editor import with only the languages we need
// This avoids importing all 80+ languages from editor.main.js

// Core editor API (no languages included)
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api.js';

// Inline workers for JSON validation and editor features
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline';

// Configure Monaco to use inline workers
if (!self.MonacoEnvironment) {
    self.MonacoEnvironment = {
        getWorker: function (_, label) {
            if (label === 'json') return new jsonWorker();
            return new editorWorker();
        }
    };
}

// Core editor features
import 'monaco-editor/esm/vs/editor/browser/coreCommands.js';
import 'monaco-editor/esm/vs/editor/browser/widget/codeEditor/codeEditorWidget.js';

// Editor contributions we want
import 'monaco-editor/esm/vs/editor/contrib/bracketMatching/browser/bracketMatching.js';
import 'monaco-editor/esm/vs/editor/contrib/clipboard/browser/clipboard.js';
import 'monaco-editor/esm/vs/editor/contrib/find/browser/findController.js';
import 'monaco-editor/esm/vs/editor/contrib/folding/browser/folding.js';
import 'monaco-editor/esm/vs/editor/contrib/hover/browser/hoverContribution.js';
import 'monaco-editor/esm/vs/editor/contrib/suggest/browser/suggestController.js';
import 'monaco-editor/esm/vs/editor/contrib/wordHighlighter/browser/wordHighlighter.js';
import 'monaco-editor/esm/vs/editor/contrib/wordOperations/browser/wordOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/linesOperations/browser/linesOperations.js';
import 'monaco-editor/esm/vs/editor/contrib/multicursor/browser/multicursor.js';
import 'monaco-editor/esm/vs/editor/contrib/contextmenu/browser/contextmenu.js';

// Standalone features
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneCommandsQuickAccess.js';

// Languages with advanced features (workers)
import 'monaco-editor/esm/vs/language/json/monaco.contribution.js';

// Basic languages we need (syntax highlighting only)
import 'monaco-editor/esm/vs/basic-languages/sql/sql.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/apex/apex.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution.js';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution.js';

// Codicons CSS for icons
import 'monaco-editor/esm/vs/base/browser/ui/codicons/codicon/codicon.css';

export { monaco };
export default monaco;
