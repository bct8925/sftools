import { LightningElement, track } from 'lwc';

export default class AppContainer extends LightningElement {
    @track message = 'LWC is working!';
    @track counter = 0;
    @track buttonClickResult = 'Click a button icon...';
    @track menuResult = 'Select a menu option...';
    @track dropdownResult = 'Click Execute or select an option...';
    @track modalResult = 'Modal is closed';
    @track searchResult = 'Search and select an item...';

    connectedCallback() {
        console.log('AppContainer connected');
    }

    renderedCallback() {
        // Set up dropdown options after render
        const dropdown = this.template.querySelector('c-button-dropdown');
        if (dropdown && !this._dropdownInitialized) {
            dropdown.setOptions([
                { label: 'Option A' },
                { label: 'Option B' },
                { label: 'Option C (disabled)', disabled: true }
            ]);
            this._dropdownInitialized = true;
        }

        // Set up search box with mock search function
        const searchBox = this.template.querySelector('c-search-box');
        if (searchBox && !this._searchBoxInitialized) {
            searchBox.setSearchFn(async (term) => {
                // Mock search function for testing
                await new Promise((resolve) => setTimeout(resolve, 200));
                return [
                    { id: '1', name: `Result 1 for "${term}"`, detail: 'Detail 1' },
                    { id: '2', name: `Result 2 for "${term}"`, detail: 'Detail 2' },
                    { id: '3', name: `Result 3 for "${term}"` }
                ];
            });
            this._searchBoxInitialized = true;
        }
    }

    handleClick() {
        this.counter++;
        this.message = `Clicked ${this.counter} time${this.counter === 1 ? '' : 's'}`;
    }

    handleButtonClick(event) {
        const icon = event.target.icon;
        this.buttonClickResult = `Button clicked: ${icon}`;
    }

    handleMenuOption(event) {
        const value = event.target.dataset.value;
        this.menuResult = `Menu option selected: ${value}`;
    }

    handleDropdownMain() {
        this.dropdownResult = 'Main button clicked - Execute!';
    }

    handleDropdownOption(event) {
        const { index, option } = event.detail;
        this.dropdownResult = `Dropdown option ${index}: ${option.label}`;
    }

    handleOpenModal() {
        const modal = this.template.querySelector('c-modal-popup');
        if (modal) {
            modal.open();
            this.modalResult = 'Modal is open';
        }
    }

    handleCloseModal() {
        const modal = this.template.querySelector('c-modal-popup');
        if (modal) {
            modal.close();
        }
    }

    handleModalClose() {
        this.modalResult = 'Modal closed';
    }

    handleSearchSelect(event) {
        const item = event.detail;
        this.searchResult = `Selected: ${item.name} (id: ${item.id})`;
    }
}
