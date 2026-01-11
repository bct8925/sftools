// Button Icon - Icon button with optional dropdown menu
import './button-icon.css';

class ButtonIcon extends HTMLElement {
    static get observedAttributes() {
        return ['icon', 'title', 'disabled'];
    }

    hasMenu = false;

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this.isConnected && oldValue !== newValue) {
            if (name === 'icon') this.updateIcon();
            if (name === 'title') this.updateTitle();
            if (name === 'disabled') this.updateDisabled();
        }
    }

    render() {
        const icon = this.getAttribute('icon') || '&#8942;';
        const title = this.getAttribute('title') || '';
        const disabled = this.hasAttribute('disabled');

        // Check if there are menu items (children)
        this.hasMenu = this.children.length > 0;

        // Move existing children (menu content) to a temp container
        const menuContent = document.createDocumentFragment();
        while (this.firstChild) {
            menuContent.appendChild(this.firstChild);
        }

        if (this.hasMenu) {
            this.innerHTML = `
                <button class="btn-icon-trigger"${title ? ` title="${title}"` : ''}${disabled ? ' disabled' : ''}>${icon}</button>
                <div class="btn-icon-menu"></div>
            `;
            this.menu = this.querySelector('.btn-icon-menu');
            this.menu.appendChild(menuContent);
        } else {
            this.innerHTML = `
                <button class="btn-icon-trigger"${title ? ` title="${title}"` : ''}${disabled ? ' disabled' : ''}>${icon}</button>
            `;
        }

        this.trigger = this.querySelector('.btn-icon-trigger');
    }

    attachEventListeners() {
        if (this.hasMenu) {
            // Dropdown behavior
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
        } else {
            // Simple button - dispatch click event
            this.trigger.addEventListener('click', (e) => {
                this.dispatchEvent(new CustomEvent('click', { bubbles: true }));
            });
        }
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

    updateDisabled() {
        if (this.trigger) {
            if (this.hasAttribute('disabled')) {
                this.trigger.setAttribute('disabled', '');
            } else {
                this.trigger.removeAttribute('disabled');
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
