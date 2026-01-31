import { useState, useEffect, useCallback } from 'react';
import { Modal } from '../components/modal/Modal';
import styles from './CorsErrorHandler.module.css';

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
      <div className={`modal-dialog ${styles.dialog}`}>
        <h3 className={styles.heading}>
          CORS Configuration Required
        </h3>
        <p className={styles.description}>
          To allow the Chrome extension to make requests to your Salesforce org, you need to add a
          CORS entry or enable the local proxy.
        </p>
        <p className={styles.optionHeading}>
          Option 1: Configure CORS in Salesforce (Recommended for Quick Setup)
        </p>
        <ol className={styles.steps}>
          <li>In Salesforce Setup, search for &quot;CORS&quot;</li>
          <li>Click &quot;CORS&quot; under Security</li>
          <li>Click &quot;New&quot; to add an allowed origin pattern</li>
          <li>
            Enter:{' '}
            <code className={styles.code}>
              chrome-extension://mckblnkfhlgocgmehmnihmagmhbnjioj
            </code>
          </li>
          <li>Save the CORS entry</li>
        </ol>
        <p className={styles.optionHeading}>
          Option 2: Enable Local Proxy (Bypasses CORS Automatically)
        </p>
        <p className={styles.optionDescription}>
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
