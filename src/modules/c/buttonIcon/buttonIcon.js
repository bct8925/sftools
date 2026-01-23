// Button Icon - LWC version of icon button with optional dropdown menu
import { LightningElement, api, track } from 'lwc';

export default class ButtonIcon extends LightningElement {
    @api icon = '';
    @api title = '';

    @track isOpen = false;
    @track hasMenu = false;

    _disabled = false;
    _boundHandleOutsideClick = null;

    @api
    get disabled() {
        return this._disabled;
    }
    set disabled(value) {
        this._disabled = value === true || value === '' || value === 'true';
    }

    connectedCallback() {
        this._boundHandleOutsideClick = this.handleOutsideClick.bind(this);
    }

    disconnectedCallback() {
        this.removeOutsideClickListener();
    }

    renderedCallback() {
        // Check if slot has content
        const slot = this.template.querySelector('slot');
        if (slot) {
            const hasSlotContent = slot.assignedElements().length > 0;
            if (hasSlotContent !== this.hasMenu) {
                this.hasMenu = hasSlotContent;
            }
        }
    }

    handleSlotChange() {
        const slot = this.template.querySelector('slot');
        this.hasMenu = slot && slot.assignedElements().length > 0;
    }

    handleTriggerClick(event) {
        event.stopPropagation();

        if (this._disabled) {
            return;
        }

        if (this.hasMenu) {
            this.toggle();
        } else {
            this.dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));
        }
    }

    handleOutsideClick(event) {
        if (!this.template.host.contains(event.target)) {
            this.close();
        }
    }

    addOutsideClickListener() {
        document.addEventListener('click', this._boundHandleOutsideClick);
    }

    removeOutsideClickListener() {
        document.removeEventListener('click', this._boundHandleOutsideClick);
    }

    @api
    close() {
        if (this.isOpen) {
            this.isOpen = false;
            this.removeOutsideClickListener();
            this.dispatchEvent(new CustomEvent('toggle', { bubbles: true, detail: { open: false } }));
        }
    }

    @api
    open() {
        if (!this.isOpen && !this._disabled) {
            this.isOpen = true;
            this.addOutsideClickListener();
            this.dispatchEvent(new CustomEvent('toggle', { bubbles: true, detail: { open: true } }));
        }
    }

    @api
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    get menuClass() {
        return this.isOpen ? 'btn-icon-menu open' : 'btn-icon-menu';
    }

    get buttonDisabled() {
        return this._disabled;
    }
}
