// Button Dropdown - LWC version of split button with main action and dropdown options
import { LightningElement, api, track } from 'lwc';

export default class ButtonDropdown extends LightningElement {
    @api label = 'Action';

    @track options = [];
    @track isOpen = false;

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

    @api
    setOptions(optionsList) {
        // Create new array with keys for iteration
        this.options = optionsList.map((opt, index) => ({
            ...opt,
            key: `opt-${index}`,
            index
        }));
    }

    @api
    setOptionDisabled(index, isDisabled) {
        if (this.options[index]) {
            // Create new array to trigger reactivity
            this.options = this.options.map((opt, i) =>
                i === index ? { ...opt, disabled: isDisabled } : opt
            );
        }
    }

    handleMainClick() {
        if (!this._disabled) {
            this.dispatchEvent(new CustomEvent('clickmain', { bubbles: true, composed: true }));
        }
    }

    handleTriggerClick(event) {
        event.stopPropagation();
        if (!this._disabled) {
            this.toggleMenu();
        }
    }

    handleOptionClick(event) {
        const index = parseInt(event.currentTarget.dataset.index, 10);
        const option = this.options[index];

        if (option && !option.disabled) {
            this.dispatchEvent(
                new CustomEvent('clickoption', {
                    bubbles: true,
                    composed: true,
                    detail: { index, option }
                })
            );
            this.closeMenu();
        }
    }

    handleOutsideClick(event) {
        if (!this.template.host.contains(event.target)) {
            this.closeMenu();
        }
    }

    addOutsideClickListener() {
        document.addEventListener('click', this._boundHandleOutsideClick);
    }

    removeOutsideClickListener() {
        document.removeEventListener('click', this._boundHandleOutsideClick);
    }

    toggleMenu() {
        if (this.isOpen) {
            this.closeMenu();
        } else {
            this.openMenu();
        }
    }

    openMenu() {
        if (!this.isOpen) {
            this.isOpen = true;
            this.addOutsideClickListener();
        }
    }

    closeMenu() {
        if (this.isOpen) {
            this.isOpen = false;
            this.removeOutsideClickListener();
        }
    }

    get menuClass() {
        return this.isOpen ? 'btn-dropdown-menu open' : 'btn-dropdown-menu';
    }

    get buttonDisabled() {
        return this._disabled;
    }

    get hasOptions() {
        return this.options.length > 0;
    }
}
