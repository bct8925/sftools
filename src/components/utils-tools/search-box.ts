// Reusable Search Box Component
import { escapeHtml } from '../../lib/text-utils.js';
import template from './search-box.html?raw';

interface SearchBoxRenderData {
    id: string;
    name: string;
    detail?: string;
}

class SearchBox extends HTMLElement {
    private input!: HTMLInputElement;
    private dropdown!: HTMLDivElement;
    private results!: HTMLDivElement;
    private labelEl!: HTMLElement;

    private searchFn: ((term: string) => Promise<unknown[]>) | null = null;
    private renderFn: ((item: unknown) => SearchBoxRenderData) | null = null;
    private searchTimeout: ReturnType<typeof setTimeout> | null = null;
    private selectedValue: unknown | null = null;

    static get observedAttributes(): string[] {
        return ['placeholder', 'label'];
    }

    connectedCallback(): void {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.applyAttributes();
    }

    private initElements(): void {
        this.input = this.querySelector<HTMLInputElement>('.search-box-input')!;
        this.dropdown = this.querySelector<HTMLDivElement>('.search-box-dropdown')!;
        this.results = this.querySelector<HTMLDivElement>('.search-box-results')!;
        this.labelEl = this.querySelector<HTMLElement>('.search-box-label')!;
    }

    private applyAttributes(): void {
        if (this.hasAttribute('placeholder')) {
            this.input.placeholder = this.getAttribute('placeholder')!;
        }
        if (this.hasAttribute('label')) {
            this.labelEl.textContent = this.getAttribute('label');
        }
    }

    attributeChangedCallback(
        name: string,
        _oldValue: string | null,
        newValue: string | null
    ): void {
        if (!this.input) return;
        if (name === 'placeholder') {
            this.input.placeholder = newValue || '';
        } else if (name === 'label') {
            this.labelEl.textContent = newValue || '';
        }
    }

    private attachEventListeners(): void {
        this.input.addEventListener('input', this.handleInput);
        this.input.addEventListener('focus', this.handleFocus);
        this.results.addEventListener('click', this.handleResultClick);

        // Close dropdown when clicking outside
        document.addEventListener('click', this.handleDocumentClick);
    }

    private handleDocumentClick = (e: MouseEvent): void => {
        if (!this.contains(e.target as Node)) {
            this.hideDropdown();
        }
    };

    /**
     * Set the search function
     * @param fn - Async function that takes search term and returns results
     */
    setSearchFn(fn: (term: string) => Promise<unknown[]>): void {
        this.searchFn = fn;
    }

    /**
     * Set custom render function for results
     * @param fn - Function that returns display data
     */
    setRenderFn(fn: (item: unknown) => SearchBoxRenderData): void {
        this.renderFn = fn;
    }

    private handleInput = (): void => {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }
        const term = this.input.value.trim();

        if (term.length < 2) {
            this.hideDropdown();
            return;
        }

        this.searchTimeout = setTimeout(() => this.doSearch(term), 300);
    };

    private handleFocus = (): void => {
        // Show dropdown if there are results and input has value
        if (this.input.value.trim().length >= 2 && this.results.children.length > 0) {
            this.showDropdown();
        }
    };

    private async doSearch(term: string): Promise<void> {
        if (!this.searchFn) return;

        try {
            const items = await this.searchFn(term);
            this.renderResults(items);
        } catch (error) {
            console.error('Search error:', error);
            this.renderResults([]);
        }
    }

    private renderResults(items: unknown[]): void {
        if (items.length === 0) {
            this.results.innerHTML = '<div class="search-box-no-results">No results found</div>';
        } else {
            this.results.innerHTML = items
                .map(item => {
                    const data = this.renderFn ? this.renderFn(item) : this.defaultRender(item);
                    return `
                    <div class="search-box-item" data-id="${data.id}" data-value='${JSON.stringify(item).replace(/'/g, '&#39;')}'>
                        <span class="search-box-item-name">${escapeHtml(data.name)}</span>
                        ${data.detail ? `<span class="search-box-item-detail">${escapeHtml(data.detail)}</span>` : ''}
                    </div>
                `;
                })
                .join('');
        }
        this.showDropdown();
    }

    private defaultRender(item: unknown): SearchBoxRenderData {
        const obj = item as Record<string, unknown>;
        return {
            id: String(obj.Id || obj.id || ''),
            name: String(obj.Name || obj.name || obj.Label || obj.label || ''),
            detail: obj.detail ? String(obj.detail) : undefined,
        };
    }

    private handleResultClick = (e: MouseEvent): void => {
        const item = (e.target as HTMLElement).closest<HTMLElement>('.search-box-item');
        if (!item) return;

        const value = JSON.parse(item.dataset.value || '{}');
        const name = item.querySelector('.search-box-item-name')!.textContent || '';

        this.selectedValue = value;
        this.input.value = name;
        this.hideDropdown();

        // Emit select event
        this.dispatchEvent(
            new CustomEvent('select', {
                detail: value,
                bubbles: true,
            })
        );
    };

    private showDropdown(): void {
        this.dropdown.classList.remove('hidden');
    }

    private hideDropdown(): void {
        this.dropdown.classList.add('hidden');
    }

    /**
     * Get the currently selected value
     */
    getValue(): unknown {
        return this.selectedValue;
    }

    /**
     * Clear the search box
     */
    clear(): void {
        this.input.value = '';
        this.selectedValue = null;
        this.results.innerHTML = '';
        this.hideDropdown();
    }

    /**
     * Set the input value without triggering search
     */
    setValue(text: string): void {
        this.input.value = text;
    }
}

customElements.define('search-box', SearchBox);
