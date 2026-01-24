// Button Icon - Icon button with optional dropdown menu
import './button-icon.css';
import { icons } from '../../lib/icons.js';

class ButtonIcon extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['icon', 'data-icon', 'title', 'disabled'];
    }

    private hasMenu = false;
    private trigger!: HTMLButtonElement;
    private menu!: HTMLDivElement;

    connectedCallback(): void {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback(name: string, oldValue: string | null, newValue: string | null): void {
        if (this.isConnected && oldValue !== newValue) {
            if (name === 'icon' || name === 'data-icon') this.updateIcon();
            if (name === 'title') this.updateTitle();
            if (name === 'disabled') this.updateDisabled();
        }
    }

    private getIconContent(): string {
        // Check data-icon (SLDS) first, fall back to icon (HTML entity)
        const dataIcon = this.getAttribute('data-icon');
        if (dataIcon && (icons as Record<string, string>)[dataIcon]) {
            return (icons as Record<string, string>)[dataIcon];
        }
        return this.getAttribute('icon') || '&#8942;';
    }

    private render(): void {
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
            this.menu = this.querySelector<HTMLDivElement>('.btn-icon-menu')!;
            this.menu.appendChild(menuContent);
        } else {
            this.innerHTML = `
                <button class="btn-icon-trigger"${title ? ` title="${title}"` : ''}${disabled ? ' disabled' : ''}>${icon}</button>
            `;
        }

        this.trigger = this.querySelector<HTMLButtonElement>('.btn-icon-trigger')!;
    }

    private attachEventListeners(): void {
        // Delegate clicks on the button-icon element to the trigger
        // But skip CustomEvents to avoid infinite loops
        this.addEventListener('click', (e: Event) => {
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
                if (this.hasMenu && this.menu.contains(e.target as Node)) {
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
            this.trigger.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.classList.toggle('open');
                this.dispatchEvent(new CustomEvent('toggle', { bubbles: true }));
            });

            document.addEventListener('click', (e: Event) => {
                if (!this.contains(e.target as Node)) {
                    this.classList.remove('open');
                }
            });
        } else {
            // Simple button - dispatch click event
            this.trigger.addEventListener('click', (e: Event) => {
                e.stopPropagation();
                this.dispatchEvent(new CustomEvent('click', { bubbles: true }));
            });
        }
    }

    private updateIcon(): void {
        if (this.trigger) {
            this.trigger.innerHTML = this.getIconContent();
        }
    }

    private updateTitle(): void {
        if (this.trigger) {
            const title = this.getAttribute('title');
            if (title) {
                this.trigger.setAttribute('title', title);
            } else {
                this.trigger.removeAttribute('title');
            }
        }
    }

    private updateDisabled(): void {
        if (this.trigger) {
            if (this.hasAttribute('disabled')) {
                this.trigger.setAttribute('disabled', '');
            } else {
                this.trigger.removeAttribute('disabled');
            }
        }
    }

    public close(): void {
        this.classList.remove('open');
    }

    public open(): void {
        this.classList.add('open');
    }

    public toggle(): void {
        this.classList.toggle('open');
    }
}

customElements.define('button-icon', ButtonIcon);
