// Button Icon - Icon button with optional dropdown menu
import './button-icon.css';
import { icons } from '../../lib/icons.js';

class ButtonIcon extends HTMLElement {
    static get observedAttributes() {
        return ['icon', 'data-icon', 'title', 'disabled'];
    }

    hasMenu = false;

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (this.isConnected && oldValue !== newValue) {
            if (name === 'icon' || name === 'data-icon') this.updateIcon();
            if (name === 'title') this.updateTitle();
            if (name === 'disabled') this.updateDisabled();
        }
    }

    getIconContent() {
        // Check data-icon (SLDS) first, fall back to icon (HTML entity)
        const dataIcon = this.getAttribute('data-icon');
        if (dataIcon && icons[dataIcon]) {
            return icons[dataIcon];
        }
        return this.getAttribute('icon') || '&#8942;';
    }

    render() {
        const icon = this.getIconContent();
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
        // Delegate clicks on the button-icon element to the trigger
        // But skip CustomEvents to avoid infinite loops
        this.addEventListener('click', e => {
            // Skip if this is a CustomEvent we dispatched (to avoid infinite loop)
            if (e instanceof CustomEvent) {
                return;
            }

            // Don't process if disabled
            if (this.hasAttribute('disabled')) {
                e.stopPropagation();
                e.preventDefault();
                return;
            }

            // If click is not on the trigger button itself, delegate it
            // But allow clicks inside the menu to work normally
            if (e.target !== this.trigger) {
                // If we have a menu and the click is inside it, allow normal behavior
                if (this.hasMenu && this.menu.contains(e.target)) {
                    return;
                }
                // Otherwise delegate to trigger
                e.stopPropagation();
                e.preventDefault();
                this.trigger.click();
            }
        });

        if (this.hasMenu) {
            // Dropdown behavior
            this.trigger.addEventListener('click', e => {
                e.stopPropagation();
                this.classList.toggle('open');
                this.dispatchEvent(new CustomEvent('toggle', { bubbles: true }));
            });

            document.addEventListener('click', e => {
                if (!this.contains(e.target)) {
                    this.classList.remove('open');
                }
            });
        } else {
            // Simple button - dispatch click event
            this.trigger.addEventListener('click', e => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('click', { bubbles: true }));
            });
        }
    }

    updateIcon() {
        if (this.trigger) {
            this.trigger.innerHTML = this.getIconContent();
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
