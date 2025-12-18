import * as monaco from 'monaco-editor';

import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker&inline';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker&inline';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker&inline';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker&inline';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker&inline';


self.MonacoEnvironment = {
  getWorker: function (_, label) {
    if (label === 'json') return new jsonWorker();
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
    if (label === 'typescript' || label === 'javascript') return new tsWorker();
    return new editorWorker();
  }
};

const PRESETS = {
    getItems: {
        descriptor: 'serviceComponent://ui.force.components.controllers.lists.selectableListDataProvider.SelectableListDataProviderController/ACTION$getItems',
        params: {
            'entityNameOrId': 'Account', 
            'layoutType': 'FULL', 
            'pageSize': 25, 
            'currentPage': 0, 
            'useTimeout': false, 
            'getCount': true, 
            'enableRowActions': false
        }
    },
    getObjectInfo: {
        descriptor: 'aura://RecordUiController/ACTION$getObjectInfo',
        params: {
            "objectApiName": "Account"
        }
    },
    getConfigData: {
        descriptor: 'serviceComponent://ui.force.components.controllers.hostConfig.HostConfigController/ACTION$getConfigData',
        params: {}
    },
    apex: {
        descriptor: 'aura://ApexActionController/ACTION$execute',
        params: {
            "namespace": "",
            "classname": "MyApexController",
            "method": "myMethod",
            "cacheable": false,
            "isContinuation": false,
            "params": { "someKey": "someValue" }
        }
    },
    custom: {
        descriptor: '',
        params: {}
    }
};

const paramsEditor = monaco.editor.create(document.getElementById('editorParams'), {
    // Load the default preset params
    value: JSON.stringify(PRESETS.getItems.params, null, 4),
    language: 'json',
    theme: 'vs',
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false
});

// Initialize Response Editor
const responseEditor = monaco.editor.create(document.getElementById('editorResponse'), {
    value: '// Response will appear here',
    language: 'json',
    theme: 'vs',
    readOnly: true,
    minimap: { enabled: false },
    automaticLayout: true,
    scrollBeyondLastLine: false
});

// --- UI Logic ---

const authModeRadios = document.getElementsByName('authMode');
const authFieldsDiv = document.getElementById('authFields');
const methodSelector = document.getElementById('methodSelector');
const methodDescriptorInput = document.getElementById('methodDescriptor');
const executeBtn = document.getElementById('executeBtn');
const statusDiv = document.getElementById('status');

// Toggle Auth Fields
authModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'auth') {
            authFieldsDiv.classList.remove('hidden');
        } else {
            authFieldsDiv.classList.add('hidden');
        }
    });
});

// Method Selector Logic
methodSelector.addEventListener('change', (e) => {
    const key = e.target.value;
    const preset = PRESETS[key];
    
    if (key === 'custom') {
        methodDescriptorInput.value = '';
        methodDescriptorInput.disabled = false;
        if(paramsEditor) paramsEditor.setValue('{\n    \n}');
    } else {
        methodDescriptorInput.value = preset.descriptor;
        methodDescriptorInput.disabled = true; // Lock descriptor for presets
        if(paramsEditor) paramsEditor.setValue(JSON.stringify(preset.params, null, 4));
    }
});

// --- Core Request Logic ---
executeBtn.addEventListener('click', async () => {
    const url = document.getElementById('communityUrl').value.replace(/\/$/, ""); // Remove trailing slash
    const isAuth = document.querySelector('input[name="authMode"]:checked').value === 'auth';
    const descriptor = methodDescriptorInput.value;
    const fwuid = document.getElementById('fwuid').value;
    
    let params;
    try {
        params = JSON.parse(paramsEditor.getValue());
    } catch (err) {
        alert("Invalid JSON in Parameters");
        return;
    }

    if (!url) {
        alert("Please enter a Community URL");
        return;
    }

    // Set Status
    statusDiv.textContent = "Executing...";
    statusDiv.className = "text-sm font-medium text-blue-600";
    responseEditor.setValue("// Loading...");

    try {
        let result;
        if (isAuth) {
            const token = document.getElementById('authToken').value;
            const sid = document.getElementById('authSid').value;
            result = await performRequest(url, descriptor, params, fwuid, true, token, sid);
        } else {
            result = await performRequest(url, descriptor, params, fwuid, false);
        }
        
        // Salesforce often prefixes JSON with "while(1);" to prevent XSSI
        const cleanJson = result.replace(/^while\(1\);/, '');
        
        try {
            const parsed = JSON.parse(cleanJson);
            responseEditor.setValue(JSON.stringify(parsed, null, 4));
            statusDiv.textContent = "Success";
            statusDiv.className = "text-sm font-medium text-green-600";
        } catch (e) {
            // If response isn't JSON, just show text
            responseEditor.setValue(result);
            statusDiv.textContent = "Received Non-JSON";
            statusDiv.className = "text-sm font-medium text-orange-600";
        }

    } catch (error) {
        responseEditor.setValue(JSON.stringify({ error: error.message, stack: error.stack }, null, 4));
        statusDiv.textContent = "Error";
        statusDiv.className = "text-sm font-medium text-red-600";
    }
});

async function extensionFetch(url, options = {}) {
  return await chrome.runtime.sendMessage({ type: 'fetch', url, options });
}

async function performRequest(url, actionDescriptor, params, fwuid, isAuth, token = undefined, sid = undefined) {
    const MESSAGE_DATA = {
        'actions': [{
            'descriptor': actionDescriptor,
            'params': params,
            'id': `${Math.floor(Math.random() * 1000)}`,
            'callingDescriptor': 'UNKNOWN'
        }]
    };

    const MESSAGE = encodeURIComponent(JSON.stringify(MESSAGE_DATA, undefined, false));

    const AURA_DATA = {
        "mode": "PROD",
        "fwuid": fwuid,
        "app": "siteforce:communityApp",
        "loaded": {"APPLICATION@markup://siteforce:communityApp":"1419_b1bLMAuSpl9zzW1jkVMf-w"},
        "dn": [],
        "globals": {},
        "uad": true
    };

    const AURA = encodeURIComponent(JSON.stringify(AURA_DATA, undefined, false));
    const tokenVal = isAuth ? encodeURIComponent(token) : 'null';
    const bodyData = `message=${MESSAGE}&aura.context=${AURA}&aura.pageURI=/&aura.token=${tokenVal}`;
    
    // if (isAuth) {
    //     await chrome.cookies.set({
    //         url: url,
    //         name: "sid",
    //         value: sid,
    //         domain: (new URL(url)).hostname
    //     });
    //     console.log((new URL(url)).hostname);
    // }

    const response = await extensionFetch(`${url}/aura`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: bodyData,
        credentials: (is) ? 'include'
    });

    // await chrome.cookies.set({
    //     url: url,
    //     name: "sid",
    //     value: null,
    //     domain: (new URL(url)).hostname
    // });

    if (!response.success) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}: ${response.data}`);
    }

    return response.data;
}

// --- Resizer Logic ---
const resizer = document.getElementById('responseResizer');
const editorContainer = document.getElementById('editorResponse');
let isResizing = false;
let startY, startHeight;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = editorContainer.offsetHeight;
    
    // Visual feedback
    resizer.classList.add('resizing');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none'; // Prevent text highlighting while dragging
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    
    const dy = e.clientY - startY;
    const newHeight = Math.max(100, startHeight + dy); // Minimum height constraint (100px)
    
    editorContainer.style.height = `${newHeight}px`;
    
    // Explicitly tell Monaco to redraw immediately for smooth resizing
    if (responseEditor) responseEditor.layout(); 
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});