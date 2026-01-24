// Button Dropdown - Split button with main action and dropdown options
import './button-dropdown.css';

interface DropdownOption {
    label: string;
    disabled?: boolean;
}

class ButtonDropdown extends HTMLElement {
    static get observedAttributes(): string[] {
        return ['label', 'disabled'];
    }

    private options: DropdownOption[] = [];
    private mainBtn!: HTMLButtonElement;
    private triggerBtn!: HTMLButtonElement;
    private menu!: HTMLDivElement;

    connectedCallback(): void {
        this.render();
        this.attachEventListeners();
    }

    attributeChangedCallback(): void {
        if (this.isConnected) {
            this.updateLabel();
            this.updateDisabled();
        }
    }

    private render(): void {
        const label = this.getAttribute('label') || 'Action';
        const disabled = this.hasAttribute('disabled');

        this.innerHTML = `
            <button class="btn-dropdown-main button-brand"${disabled ? ' disabled' : ''}>${label}</button>
            <button class="btn-dropdown-trigger button-brand"${disabled ? ' disabled' : ''}>&#9662;</button>
            <div class="btn-dropdown-menu"></div>
        `;

        this.mainBtn = this.querySelector<HTMLButtonElement>('.btn-dropdown-main')!;
        this.triggerBtn = this.querySelector<HTMLButtonElement>('.btn-dropdown-trigger')!;
        this.menu = this.querySelector<HTMLDivElement>('.btn-dropdown-menu')!;

        this.renderOptions();
    }

    private renderOptions(): void {
        this.menu.innerHTML = this.options
            .map(
                (opt, i) => `
            <button class="btn-dropdown-option" data-index="${i}"${opt.disabled ? ' disabled' : ''}>${opt.label}</button>
        `
            )
            .join('');
    }

    private attachEventListeners(): void {
        this.mainBtn.addEventListener('click', () => {
            if (!this.hasAttribute('disabled')) {
                this.dispatchEvent(new CustomEvent('click-main', { bubbles: true }));
            }
        });

        this.triggerBtn.addEventListener('click', (e: Event) => {
            e.stopPropagation();
            if (!this.hasAttribute('disabled')) {
                this.classList.toggle('open');
            }
        });

        this.menu.addEventListener('click', (e: Event) => {
            const option = (e.target as HTMLElement).closest<HTMLButtonElement>('.btn-dropdown-option');
            if (option && !option.disabled) {
                const index = parseInt(option.dataset.index || '0', 10);
                this.dispatchEvent(
                    new CustomEvent('click-option', {
                        bubbles: true,
                        detail: { index, option: this.options[index] },
                    })
                );
                this.classList.remove('open');
            }
        });

        document.addEventListener('click', (e: Event) => {
            if (!this.contains(e.target as Node)) {
                this.classList.remove('open');
            }
        });
    }

    private updateLabel(): void {
        if (this.mainBtn) {
            this.mainBtn.textContent = this.getAttribute('label') || 'Action';
        }
    }

    private updateDisabled(): void {
        const disabled = this.hasAttribute('disabled');
        if (this.mainBtn) this.mainBtn.disabled = disabled;
        if (this.triggerBtn) this.triggerBtn.disabled = disabled;
    }

    public setOptions(options: DropdownOption[]): void {
        this.options = options;
        if (this.menu) {
            this.renderOptions();
        }
    }

    public setOptionDisabled(index: number, disabled: boolean): void {
        if (this.options[index]) {
            this.options[index].disabled = disabled;
            const optionEl = this.menu?.querySelector<HTMLButtonElement>(`[data-index="${index}"]`);
            if (optionEl) optionEl.disabled = disabled;
        }
    }
}

customElements.define('button-dropdown', ButtonDropdown);
