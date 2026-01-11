import template from './schema-browser-link.html?raw';
import './utils-tools.css';
import { getActiveConnectionId } from '../../lib/utils.js';

class SchemaBrowserLink extends HTMLElement {
    connectedCallback() {
        this.innerHTML = template;
        this.attachEventListeners();
    }

    attachEventListeners() {
        const openBtn = this.querySelector('.open-schema-btn');
        openBtn.addEventListener('click', () => this.openSchemaBrowser());
    }

    async openSchemaBrowser() {
        const connectionId = getActiveConnectionId();

        if (!connectionId) {
            alert('Please select a connection first');
            return;
        }

        const url = `schema.html?connectionId=${encodeURIComponent(connectionId)}`;
        window.open(url, '_blank');
    }
}

customElements.define('schema-browser-link', SchemaBrowserLink);
