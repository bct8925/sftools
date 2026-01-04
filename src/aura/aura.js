// Aura Debugger - Standalone Tool
import { createEditor, createReadOnlyEditor } from '../lib/monaco.js';
import { extensionFetch } from '../lib/utils.js';

// --- Presets Configuration ---
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
    auraCmpDef: {
        descriptor: 'aura://ComponentController/ACTION$getComponentDef',
        params: {
            "name": "markup://force:recordData"
        }
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

// --- DOM References ---
const communityUrlInput = document.getElementById('communityUrl');
const authModeRadios = document.getElementsByName('authMode');
const authFieldsDiv = document.getElementById('authFields');
const authTokenInput = document.getElementById('authToken');
const authSidInput = document.getElementById('authSid');
const methodSelector = document.getElementById('methodSelector');
const methodDescriptorInput = document.getElementById('methodDescriptor');
const fwuidInput = document.getElementById('fwuid');
const executeBtn = document.getElementById('executeBtn');
const statusBadge = document.getElementById('status');

// --- Monaco Editors ---
const paramsEditor = createEditor(document.getElementById('paramsEditor'), {
    language: 'json',
    value: JSON.stringify(PRESETS.getItems.params, null, 4)
});

const responseEditor = createReadOnlyEditor(document.getElementById('responseEditor'), {
    language: 'json',
    value: '// Response will appear here'
});

// --- UI Logic ---

// Toggle Auth Fields visibility
authModeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
        if (e.target.value === 'auth') {
            authFieldsDiv.classList.remove('hidden');
        } else {
            authFieldsDiv.classList.add('hidden');
        }
    });
});

// Method Selector - update descriptor and params based on selection
methodSelector.addEventListener('change', (e) => {
    const key = e.target.value;
    const preset = PRESETS[key];

    if (key === 'custom') {
        methodDescriptorInput.value = '';
        methodDescriptorInput.disabled = false;
        methodDescriptorInput.style.backgroundColor = '#fff';
        paramsEditor.setValue('{\n    \n}');
    } else {
        methodDescriptorInput.value = preset.descriptor;
        methodDescriptorInput.disabled = true;
        methodDescriptorInput.style.backgroundColor = '#f3f4f6';
        paramsEditor.setValue(JSON.stringify(preset.params, null, 4));
    }
});

// --- Status Badge Helper ---
function setStatus(text, type) {
    statusBadge.textContent = text;
    statusBadge.className = 'status-badge';
    if (type === 'success') {
        statusBadge.classList.add('status-success');
    } else if (type === 'error') {
        statusBadge.classList.add('status-error');
    } else if (type === 'loading') {
        statusBadge.classList.add('status-loading');
    }
}

// --- Cookie Helpers ---
async function getCookie(url, name) {
    return new Promise((resolve) => {
        chrome.cookies.get({ url, name }, (cookie) => {
            resolve(cookie ? cookie.value : null);
        });
    });
}

async function setCookie(url, name, value) {
    const urlObj = new URL(url);
    return new Promise((resolve) => {
        chrome.cookies.set({
            url: url,
            name: name,
            value: value,
            domain: urlObj.hostname,
            path: '/'
        }, (cookie) => {
            resolve(cookie);
        });
    });
}

async function removeCookie(url, name) {
    return new Promise((resolve) => {
        chrome.cookies.remove({ url, name }, () => {
            resolve();
        });
    });
}

// --- Validation ---
function validateRequest(url, descriptor, paramsJson) {
    if (!url) return { valid: false, error: 'Enter Community URL' };
    if (!descriptor) return { valid: false, error: 'Enter Method Descriptor' };
    try {
        JSON.parse(paramsJson);
        return { valid: true };
    } catch (e) {
        return { valid: false, error: 'Invalid JSON' };
    }
}

// --- Authentication Flow ---
async function resolveSessionId(url, providedSid) {
    if (providedSid) {
        await setCookie(url, 'sid', providedSid);
        return { sid: providedSid, cleanup: true };
    }

    const sid = await getCookie(url, 'sid');
    if (!sid) {
        throw new Error('No SID cookie found for this domain. Either provide a SID value manually, or ensure you are logged into this Salesforce org in your browser.');
    }
    return { sid, cleanup: false };
}

// --- Response Parsing ---
function parseAuraResponse(responseText) {
    const cleanJson = responseText.replace(/^while\(1\);/, '');
    return JSON.parse(cleanJson);
}

// --- Core Request Logic ---
executeBtn.addEventListener('click', async () => {
    const url = communityUrlInput.value.replace(/\/$/, '');
    const isAuth = document.querySelector('input[name="authMode"]:checked').value === 'auth';
    const descriptor = methodDescriptorInput.value;

    const validation = validateRequest(url, descriptor, paramsEditor.getValue());
    if (!validation.valid) {
        setStatus(validation.error, 'error');
        return;
    }

    const params = JSON.parse(paramsEditor.getValue());
    let sessionInfo = null;

    if (isAuth) {
        try {
            sessionInfo = await resolveSessionId(url, authSidInput.value.trim());
        } catch (e) {
            setStatus('Auth Error', 'error');
            responseEditor.setValue(JSON.stringify({ error: e.message }, null, 4));
            return;
        }
    }

    setStatus('Executing...', 'loading');
    responseEditor.setValue('// Loading...');

    try {
        const token = isAuth ? authTokenInput.value : null;
        const result = await performAuraRequest(url, descriptor, params, fwuidInput.value, token, isAuth);
        const parsed = parseAuraResponse(result);
        responseEditor.setValue(JSON.stringify(parsed, null, 4));
        setStatus('Success', 'success');
    } catch (error) {
        responseEditor.setValue(JSON.stringify({ error: error.message }, null, 4));
        setStatus(error.message.includes('JSON') ? 'Non-JSON Response' : 'Error', 'error');
    } finally {
        if (sessionInfo?.cleanup) {
            await removeCookie(url, 'sid').catch(() => {});
        }
    }
});

// --- Aura Request Function ---
async function performAuraRequest(url, actionDescriptor, params, fwuid, token, isAuth) {
    const messageData = {
        'actions': [{
            'descriptor': actionDescriptor,
            'params': params,
            'id': `${Math.floor(Math.random() * 1000)}`,
            'callingDescriptor': 'UNKNOWN'
        }]
    };

    const auraContext = {
        "mode": "PROD",
        "fwuid": fwuid,
        "app": "siteforce:communityApp",
        "loaded": { "APPLICATION@markup://siteforce:communityApp": "1419_b1bLMAuSpl9zzW1jkVMf-w" },
        "dn": [],
        "globals": {},
        "uad": true
    };

    const message = encodeURIComponent(JSON.stringify(messageData));
    const aura = encodeURIComponent(JSON.stringify(auraContext));
    const tokenVal = token ? encodeURIComponent(token) : 'null';

    const bodyData = `message=${message}&aura.context=${aura}&aura.pageURI=/&aura.token=${tokenVal}`;

    const response = await extensionFetch(`${url}/aura`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
        },
        body: bodyData,
        credentials: isAuth ? 'include' : 'omit'
    });

    if (!response.success) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response.data;
}

// --- Resizer Logic ---
const resizer = document.getElementById('responseResizer');
const responseContainer = document.getElementById('responseEditor');
let isResizing = false;
let startY, startHeight;

resizer.addEventListener('mousedown', (e) => {
    isResizing = true;
    startY = e.clientY;
    startHeight = responseContainer.offsetHeight;
    resizer.classList.add('resizing');
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
});

document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;
    const dy = e.clientY - startY;
    const newHeight = Math.max(100, startHeight + dy);
    responseContainer.style.height = `${newHeight}px`;
    responseEditor.layout();
});

document.addEventListener('mouseup', () => {
    if (isResizing) {
        isResizing = false;
        resizer.classList.remove('resizing');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    }
});
