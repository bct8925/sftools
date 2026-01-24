import { getActiveConnectionId } from '../../lib/utils.js';
import template from './schema-browser-link.html?raw';
import './utils-tools.css';

class SchemaBrowserLink extends HTMLElement {
  private openBtn!: HTMLButtonElement;

  connectedCallback(): void {
    this.innerHTML = template;
    this.initElements();
    this.attachEventListeners();
  }

  private initElements(): void {
    this.openBtn = this.querySelector<HTMLButtonElement>('.open-schema-btn')!;
  }

  private attachEventListeners(): void {
    this.openBtn.addEventListener('click', this.openSchemaBrowser);
  }

  private openSchemaBrowser = (): void => {
    const connectionId = getActiveConnectionId();

    if (!connectionId) {
      alert('Please select a connection first');
      return;
    }

    const url = `/dist/pages/schema/schema.html?connectionId=${encodeURIComponent(connectionId)}`;
    window.open(url, '_blank');
  };
}

customElements.define('schema-browser-link', SchemaBrowserLink);
