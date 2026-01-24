import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/modal/Modal';

/**
 * Handles CORS error events by showing a modal with configuration instructions.
 * Listens for 'show-cors-error' custom events dispatched by the fetch layer.
 */
export function CorsErrorHandler() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleCorsError = () => {
      setIsOpen(true);
    };

    document.addEventListener('show-cors-error', handleCorsError);
    return () => document.removeEventListener('show-cors-error', handleCorsError);
  }, []);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <Modal isOpen={isOpen} onClose={handleClose}>
      <div className="modal-dialog" style={{ maxWidth: '600px', padding: '24px' }}>
        <h3 style={{ marginTop: 0, marginBottom: '16px', color: 'var(--error-color)' }}>
          CORS Configuration Required
        </h3>
        <p style={{ marginBottom: '16px' }}>
          To allow the Chrome extension to make requests to your Salesforce org, you need to add a
          CORS entry or enable the local proxy.
        </p>
        <p style={{ marginBottom: '12px', fontWeight: 600 }}>
          Option 1: Configure CORS in Salesforce (Recommended for Quick Setup)
        </p>
        <ol style={{ marginBottom: '20px', paddingLeft: '24px' }}>
          <li>In Salesforce Setup, search for &quot;CORS&quot;</li>
          <li>Click &quot;CORS&quot; under Security</li>
          <li>Click &quot;New&quot; to add an allowed origin pattern</li>
          <li>
            Enter:{' '}
            <code
              style={{
                background: 'var(--bg-secondary)',
                padding: '2px 6px',
                borderRadius: '3px',
              }}
            >
              chrome-extension://mckblnkfhlgocgmehmnihmagmhbnjioj
            </code>
          </li>
          <li>Save the CORS entry</li>
        </ol>
        <p style={{ marginBottom: '12px', fontWeight: 600 }}>
          Option 2: Enable Local Proxy (Bypasses CORS Automatically)
        </p>
        <p style={{ marginBottom: '20px' }}>
          The local proxy routes requests through a native host, bypassing browser CORS
          restrictions. See the Settings tab for installation instructions.
        </p>
        <div className="modal-buttons">
          <button className="button-brand" onClick={handleClose}>
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}
