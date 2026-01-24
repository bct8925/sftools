// Utils Tab - Container for utility tools
import template from './utils.html?raw';
import '../utils-tools/schema-browser-link.js';
import '../utils-tools/debug-logs.js';
import '../utils-tools/flow-cleanup.js';

class UtilsTab extends HTMLElement {
    connectedCallback(): void {
        this.innerHTML = template;
    }
}

customElements.define('utils-tab', UtilsTab);
