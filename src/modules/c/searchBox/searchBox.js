// Search Box - LWC version of reusable search with dropdown results
import { LightningElement, api, track } from 'lwc';

export default class SearchBox extends LightningElement {
    @api placeholder = '';
    @api label = '';

    @track results = [];
    @track isDropdownOpen = false;
    @track hasNoResults = false;

    _searchFn = null;
    _renderFn = null;
    _searchTimeout = null;
    _selectedValue = null;
    _boundHandleOutsideClick = null;

    connectedCallback() {
        this._boundHandleOutsideClick = this.handleOutsideClick.bind(this);
        document.addEventListener('click', this._boundHandleOutsideClick);
    }

    disconnectedCallback() {
        document.removeEventListener('click', this._boundHandleOutsideClick);
        if (this._searchTimeout) {
            clearTimeout(this._searchTimeout);
        }
    }

    handleOutsideClick(event) {
        if (!this.template.host.contains(event.target)) {
            this.hideDropdown();
        }
    }

    /**
     * Set the search function
     * @param {function(string): Promise<Array>} fn - Async function that takes search term and returns results
     */
    @api
    setSearchFn(fn) {
        this._searchFn = fn;
    }

    /**
     * Set custom render function for results
     * @param {function(item): {id: string, name: string, detail?: string}} fn - Function that returns display data
     */
    @api
    setRenderFn(fn) {
        this._renderFn = fn;
    }

    /**
     * Get the currently selected value
     */
    @api
    getValue() {
        return this._selectedValue;
    }

    /**
     * Clear the search box
     */
    @api
    clear() {
        const input = this.template.querySelector('.search-box-input');
        if (input) {
            input.value = '';
        }
        this._selectedValue = null;
        this.results = [];
        this.hasNoResults = false;
        this.hideDropdown();
    }

    /**
     * Set the input value without triggering search
     */
    @api
    setValue(text) {
        const input = this.template.querySelector('.search-box-input');
        if (input) {
            input.value = text;
        }
    }

    handleInput(event) {
        clearTimeout(this._searchTimeout);
        const term = event.target.value.trim();

        if (term.length < 2) {
            this.hideDropdown();
            return;
        }

        this._searchTimeout = setTimeout(() => this.doSearch(term), 300);
    }

    handleFocus() {
        const input = this.template.querySelector('.search-box-input');
        if (input && input.value.trim().length >= 2 && this.results.length > 0) {
            this.showDropdown();
        }
    }

    async doSearch(term) {
        if (!this._searchFn) return;

        try {
            const items = await this._searchFn(term);
            this.renderResults(items);
        } catch (error) {
            console.error('Search error:', error);
            this.renderResults([]);
        }
    }

    renderResults(items) {
        if (items.length === 0) {
            this.results = [];
            this.hasNoResults = true;
        } else {
            this.hasNoResults = false;
            this.results = items.map((item) => {
                const data = this._renderFn ? this._renderFn(item) : this.defaultRender(item);
                return {
                    id: data.id,
                    name: data.name,
                    detail: data.detail || null,
                    rawValue: item
                };
            });
        }
        this.showDropdown();
    }

    defaultRender(item) {
        return {
            id: item.Id || item.id,
            name: item.Name || item.name || item.Label || item.label,
            detail: item.detail || null
        };
    }

    handleResultClick(event) {
        const item = event.currentTarget;
        const index = parseInt(item.dataset.index, 10);
        const result = this.results[index];

        if (!result) return;

        this._selectedValue = result.rawValue;

        const input = this.template.querySelector('.search-box-input');
        if (input) {
            input.value = result.name;
        }

        this.hideDropdown();

        // Emit select event
        this.dispatchEvent(
            new CustomEvent('select', {
                detail: result.rawValue,
                bubbles: true,
                composed: true
            })
        );
    }

    showDropdown() {
        this.isDropdownOpen = true;
    }

    hideDropdown() {
        this.isDropdownOpen = false;
    }

    get dropdownClass() {
        return this.isDropdownOpen ? 'search-box-dropdown' : 'search-box-dropdown hidden';
    }

    get showResults() {
        return this.results.length > 0;
    }
}
