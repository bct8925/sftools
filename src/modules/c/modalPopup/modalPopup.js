// Modal Popup - LWC version of centered modal with backdrop
import { LightningElement, api, track } from 'lwc';

export default class ModalPopup extends LightningElement {
    @track _isOpen = false;

    _boundKeyHandler = null;

    connectedCallback() {
        this._boundKeyHandler = this.handleKeyDown.bind(this);
        document.addEventListener('keydown', this._boundKeyHandler);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this._boundKeyHandler);
    }

    handleKeyDown(event) {
        if (event.key === 'Escape' && this._isOpen) {
            this.close();
        }
    }

    handleBackdropClick() {
        this.close();
    }

    @api
    get isOpen() {
        return this._isOpen;
    }

    @api
    open() {
        if (!this._isOpen) {
            this._isOpen = true;
            this.template.host.classList.add('open');
            this.dispatchEvent(new CustomEvent('open', { bubbles: true, composed: true }));
        }
    }

    @api
    close() {
        if (this._isOpen) {
            this._isOpen = false;
            this.template.host.classList.remove('open');
            this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
        }
    }

    @api
    toggle() {
        if (this._isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    get hostClass() {
        return this._isOpen ? 'open' : '';
    }
}
