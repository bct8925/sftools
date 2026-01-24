// SF Icon - Display-only icon component
import './sf-icon.css';
import { icons } from '../../lib/icons.js';

class SfIcon extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['name'];
    }

    connectedCallback(): void {
        this.render();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (this.isConnected && oldValue !== newValue) {
            this.render();
        }
    }

    private render(): void {
        const iconName = this.getAttribute('name');
        this.innerHTML = iconName && (icons as Record<string, string>)[iconName]
            ? (icons as Record<string, string>)[iconName]
            : '';
    }
}

customElements.define('sf-icon', SfIcon);
