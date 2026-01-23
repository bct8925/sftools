// Modal Popup - Centered modal with backdrop
import './modal-popup.css';

class ModalPopup extends HTMLElement {
    connectedCallback() {
        this.render();
        this.attachEventListeners();
    }

    render() {
        // Move existing children (content) to a temp container
        const content = document.createDocumentFragment();
        while (this.firstChild) {
            content.appendChild(this.firstChild);
        }

        this.innerHTML = `
            <div class="modal-backdrop"></div>
            <div class="modal-content"></div>
        `;

        this.backdrop = this.querySelector('.modal-backdrop');
        this.content = this.querySelector('.modal-content');

        // Restore content
        this.content.appendChild(content);
    }

    attachEventListeners() {
        this.backdrop.addEventListener('click', () => {
            this.close();
        });

        // Close on Escape key
        this.keyHandler = e => {
            if (e.key === 'Escape' && this.classList.contains('open')) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    disconnectedCallback() {
        document.removeEventListener('keydown', this.keyHandler);
    }

    open() {
        this.classList.add('open');
        this.dispatchEvent(new CustomEvent('open', { bubbles: true }));
    }

    close() {
        this.classList.remove('open');
        this.dispatchEvent(new CustomEvent('close', { bubbles: true }));
    }

    toggle() {
        if (this.classList.contains('open')) {
            this.close();
        } else {
            this.open();
        }
    }

    get isOpen() {
        return this.classList.contains('open');
    }
}

customElements.define('modal-popup', ModalPopup);
