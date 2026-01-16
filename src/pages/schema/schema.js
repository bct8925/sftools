import '../../components/schema/schema-page.js';
import '../../components/modal-popup/modal-popup.js';

// Initialize CORS error modal
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('cors-error-modal');
    const closeBtn = document.getElementById('cors-modal-close');

    if (modal && closeBtn) {
        document.addEventListener('show-cors-error', () => {
            modal.open();
        });

        closeBtn.addEventListener('click', () => {
            modal.close();
        });
    }
});
