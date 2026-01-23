import { getActiveConnectionId } from '../../lib/utils.js';
import template from './schema-browser-link.html?raw';
import './utils-tools.css';

class SchemaBrowserLink extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.attachEventListeners();
    }

    attachEventListeners() {
        const openBtn = this.querySelector('.open-schema-btn');
        openBtn.addEventListener('click', () => this.openSchemaBrowser());
    }

    openSchemaBrowser() {
        const connectionId = getActiveConnectionId();

        if (!connectionId) {
            alert('Please select a connection first');
            return;
        }

        const url = `/dist/pages/schema/schema.html?connectionId=${encodeURIComponent(connectionId)}`;
        window.open(url, '_blank');
    }
}

customElements.define('schema-browser-link', SchemaBrowserLink);
