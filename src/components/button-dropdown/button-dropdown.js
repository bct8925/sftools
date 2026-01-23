// Button Dropdown - Split button with main action and dropdown options
import './button-dropdown.css';

class ButtonDropdown extends HTMLElement {
    static get observedAttributes() {
        return ['label', 'disabled'];
    }

    constructor() {
        super();
        this.options = [];
    }

    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback() {
        if (this.isConnected) {
            this.updateLabel();
            this.updateDisabled();
        }
    }

    render() {
        const label = this.getAttribute('label') || 'Action';
        const disabled = this.hasAttribute('disabled');

        this.innerHTML = `
            <button class="btn-dropdown-main button-brand"${disabled ? ' disabled' : ''}>${label}</button>
            <button class="btn-dropdown-trigger button-brand"${disabled ? ' disabled' : ''}>&#9662;</button>
            <div class="btn-dropdown-menu"></div>
        `;

        this.mainBtn = this.querySelector('.btn-dropdown-main');
        this.triggerBtn = this.querySelector('.btn-dropdown-trigger');
        this.menu = this.querySelector('.btn-dropdown-menu');

        this.renderOptions();
    }

    renderOptions() {
        this.menu.innerHTML = this.options
            .map(
                (opt, i) => `
            <button class="btn-dropdown-option" data-index="${i}"${opt.disabled ? ' disabled' : ''}>${opt.label}</button>
        `
            )
            .join('');
    }

    attachEventListeners() {
        this.mainBtn.addEventListener('click', () => {
            if (!this.hasAttribute('disabled')) {
                this.dispatchEvent(new CustomEvent('click-main', { bubbles: true }));
            }
        });

        this.triggerBtn.addEventListener('click', e => {
            e.stopPropagation();
            if (!this.hasAttribute('disabled')) {
                this.classList.toggle('open');
            }
        });

        this.menu.addEventListener('click', e => {
            const option = e.target.closest('.btn-dropdown-option');
            if (option && !option.disabled) {
                const index = parseInt(option.dataset.index);
                this.dispatchEvent(
                    new CustomEvent('click-option', {
                        bubbles: true,
                        detail: { index, option: this.options[index] },
                    })
                );
                this.classList.remove('open');
            }
        });

        document.addEventListener('click', e => {
            if (!this.contains(e.target)) {
                this.classList.remove('open');
            }
        });
    }

    updateLabel() {
        if (this.mainBtn) {
            this.mainBtn.textContent = this.getAttribute('label') || 'Action';
        }
    }

    updateDisabled() {
        const disabled = this.hasAttribute('disabled');
        if (this.mainBtn) this.mainBtn.disabled = disabled;
        if (this.triggerBtn) this.triggerBtn.disabled = disabled;
    }

    setOptions(options) {
        this.options = options;
        if (this.menu) {
            this.renderOptions();
        }
    }

    setOptionDisabled(index, disabled) {
        if (this.options[index]) {
            this.options[index].disabled = disabled;
            const optionEl = this.menu?.querySelector(`[data-index="${index}"]`);
            if (optionEl) optionEl.disabled = disabled;
        }
    }
}

customElements.define('button-dropdown', ButtonDropdown);
