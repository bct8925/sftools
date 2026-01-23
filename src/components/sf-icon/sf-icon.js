// SF Icon - Display-only icon component
import './sf-icon.css';
import { icons } from '../../lib/icons.js';

class SfIcon extends HTMLElement {
    static get observedAttributes() {
        return ['name'];
    }

    connectedCallback() {
        this.render();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this.isConnected && oldValue !== newValue) {
            this.render();
        }
    }

    render() {
        const iconName = this.getAttribute('name');
        this.innerHTML = iconName && icons[iconName] ? icons[iconName] : '';
    }
}

customElements.define('sf-icon', SfIcon);
