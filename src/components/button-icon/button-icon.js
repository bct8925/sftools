// Button Icon - Icon button with dropdown menu
import './button-icon.css';

class ButtonIcon extends HTMLElement {
    static get observedAttributes() {
        return ['icon', 'title'];
    }

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this.isConnected && oldValue !== newValue) {
            if (name === 'icon') this.updateIcon();
            if (name === 'title') this.updateTitle();
        }
    }

    render() {
        const icon = this.getAttribute('icon') || '&#8942;';
        const title = this.getAttribute('title') || '';

        // Move existing children (menu content) to a temp container
        const menuContent = document.createDocumentFragment();
        while (this.firstChild) {
            menuContent.appendChild(this.firstChild);
        }

        this.innerHTML = `
            <button class="btn-icon-trigger"${title ? ` title="${title}"` : ''}>${icon}</button>
            <div class="btn-icon-menu"></div>
        `;

        this.trigger = this.querySelector('.btn-icon-trigger');
        this.menu = this.querySelector('.btn-icon-menu');

        // Restore menu content
        this.menu.appendChild(menuContent);
    }

    attachEventListeners() {
        this.trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            this.classList.toggle('open');
            this.dispatchEvent(new CustomEvent('toggle', { bubbles: true }));
        });

        document.addEventListener('click', (e) => {
            if (!this.contains(e.target)) {
                this.classList.remove('open');
            }
        });
    }

    updateIcon() {
        if (this.trigger) {
            this.trigger.innerHTML = this.getAttribute('icon') || '&#8942;';
        }
    }

    updateTitle() {
        if (this.trigger) {
            const title = this.getAttribute('title');
            if (title) {
                this.trigger.setAttribute('title', title);
            } else {
                this.trigger.removeAttribute('title');
            }
        }
    }

    close() {
        this.classList.remove('open');
    }

    open() {
        this.classList.add('open');
    }

    toggle() {
        this.classList.toggle('open');
    }
}

customElements.define('button-icon', ButtonIcon);
