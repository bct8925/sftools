// Reusable Search Box Component
import { escapeHtml } from '../../lib/text-utils.js';
import template from './search-box.html?raw';

class SearchBox extends HTMLElement {
    input = null;
    dropdown = null;
    results = null;
    labelEl = null;

    searchFn = null;
    renderFn = null;
    searchTimeout = null;
    selectedValue = null;

    static get observedAttributes() {
        return ['placeholder', 'label'];
    }

    connectedCallback() {
        this.innerHTML = template;
        this.initElements();
        this.attachEventListeners();
        this.applyAttributes();
    }

    initElements() {
        this.input = this.querySelector('.search-box-input');
        this.dropdown = this.querySelector('.search-box-dropdown');
        this.results = this.querySelector('.search-box-results');
        this.labelEl = this.querySelector('.search-box-label');
    }

    applyAttributes() {
        if (this.hasAttribute('placeholder')) {
            this.input.placeholder = this.getAttribute('placeholder');
        }
        if (this.hasAttribute('label')) {
            this.labelEl.textContent = this.getAttribute('label');
        }
    }

    attributeChangedCallback(name, oldValue, newValue) {
        if (!this.input) return;
        if (name === 'placeholder') {
            this.input.placeholder = newValue || '';
        } else if (name === 'label') {
            this.labelEl.textContent = newValue || '';
        }
    }

    attachEventListeners() {
        this.input.addEventListener('input', () => this.handleInput());
        this.input.addEventListener('focus', () => this.handleFocus());
        this.results.addEventListener('click', e => this.handleResultClick(e));

        // Close dropdown when clicking outside
        document.addEventListener('click', e => {
            if (!this.contains(e.target)) {
                this.hideDropdown();
            }
        });
    }

    /**
     * Set the search function
     * @param {function(string): Promise<Array>} fn - Async function that takes search term and returns results
     */
    setSearchFn(fn) {
        this.searchFn = fn;
    }

    /**
     * Set custom render function for results
     * @param {function(item): {id: string, name: string, detail?: string}} fn - Function that returns display data
     */
    setRenderFn(fn) {
        this.renderFn = fn;
    }

    handleInput() {
        clearTimeout(this.searchTimeout);
        const term = this.input.value.trim();

        if (term.length < 2) {
            this.hideDropdown();
            return;
        }

        this.searchTimeout = setTimeout(() => this.doSearch(term), 300);
    }

    handleFocus() {
        // Show dropdown if there are results and input has value
        if (this.input.value.trim().length >= 2 && this.results.children.length > 0) {
            this.showDropdown();
        }
    }

    async doSearch(term) {
        if (!this.searchFn) return;

        try {
            const items = await this.searchFn(term);
            this.renderResults(items);
        } catch (error) {
            console.error('Search error:', error);
            this.renderResults([]);
        }
    }

    renderResults(items) {
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

    defaultRender(item) {
        return {
            id: item.Id || item.id,
            name: item.Name || item.name || item.Label || item.label,
            detail: item.detail || null,
        };
    }

    handleResultClick(e) {
        const item = e.target.closest('.search-box-item');
        if (!item) return;

        const value = JSON.parse(item.dataset.value);
        const name = item.querySelector('.search-box-item-name').textContent;

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
    }

    showDropdown() {
        this.dropdown.classList.remove('hidden');
    }

    hideDropdown() {
        this.dropdown.classList.add('hidden');
    }

    /**
     * Get the currently selected value
     */
    getValue() {
        return this.selectedValue;
    }

    /**
     * Clear the search box
     */
    clear() {
        this.input.value = '';
        this.selectedValue = null;
        this.results.innerHTML = '';
        this.hideDropdown();
    }

    /**
     * Set the input value without triggering search
     */
    setValue(text) {
        this.input.value = text;
    }
}

customElements.define('search-box', SearchBox);
