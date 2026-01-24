// Modal Popup - Centered modal with backdrop
import './modal-popup.css';

class ModalPopup extends HTMLElement {
    private backdrop!: HTMLDivElement;
    private content!: HTMLDivElement;
    private keyHandler!: (e: KeyboardEvent) => void;

    connectedCallback(): void {
        this.render();
        this.attachEventListeners();
    }

    disconnectedCallback(): void {
        document.removeEventListener('keydown', this.keyHandler);
    }

    private render(): void {
        // Move existing children (content) to a temp container
        const content = document.createDocumentFragment();
        while (this.firstChild) {
            content.appendChild(this.firstChild);
        }

        this.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content"></div>
        `;

        this.backdrop = this.querySelector<HTMLDivElement>('.modal-backdrop')!;
        this.content = this.querySelector<HTMLDivElement>('.modal-content')!;

        // Restore content
        this.content.appendChild(content);
    }

    private attachEventListeners(): void {
        this.backdrop.addEventListener('click', () => {
            this.close();
        });

        // Close on Escape key
        this.keyHandler = (e: KeyboardEvent): void => {
            if (e.key === 'Escape' && this.classList.contains('open')) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    public open(): void {
        this.classList.add('open');
        this.dispatchEvent(new CustomEvent('open', { bubbles: true }));
    }

    public close(): void {
        this.classList.remove('open');
        this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    }

    public toggle(): void {
        if (this.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    get isOpen(): boolean {
        return this.classList.contains('open');
    }
}

customElements.define('modal-popup', ModalPopup);
