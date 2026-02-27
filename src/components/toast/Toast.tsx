import { useState, useEffect, useCallback } from 'react';
import type { StatusType } from '../../contexts/ToastContext';
import styles from './Toast.module.css';

interface ToastProps {
    id: string;
    message: string;
    type: StatusType;
    autoClose: boolean;
    onDismiss: (id: string) => void;
}

const AUTO_CLOSE_MS = 2000;

export function Toast({ id, message, type, autoClose, onDismiss }: ToastProps) {
    const [isDismissing, setIsDismissing] = useState(false);

    const startDismiss = useCallback(() => {
        setIsDismissing(true);
    }, []);

    const handleAnimationEnd = useCallback(
        (e: React.AnimationEvent) => {
            if (isDismissing && e.target === e.currentTarget) {
                onDismiss(id);
            }
        },
        [isDismissing, id, onDismiss]
    );

    // Start auto-close timer when autoClose is true
    useEffect(() => {
        if (!autoClose || isDismissing) return;
        const timer = setTimeout(startDismiss, AUTO_CLOSE_MS);
        return () => clearTimeout(timer);
    }, [autoClose, isDismissing, startDismiss]);

    const toastClass = [
        styles.toast,
        type === 'success' ? styles.toastSuccess : '',
        type === 'error' ? styles.toastError : '',
        type === 'loading' ? styles.toastLoading : '',
        isDismissing ? styles.toastDismissing : '',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div
            className={toastClass}
            onAnimationEnd={handleAnimationEnd}
            role="alert"
            data-type={type}
        >
            <div className={styles.icon}>{renderIcon(type)}</div>
            <span className={styles.message}>{message}</span>
            <button
                className={styles.closeBtn}
                onClick={startDismiss}
                aria-label="Dismiss notification"
            >
                <svg
                    width="10"
                    height="10"
                    viewBox="0 0 10 10"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                >
                    <path d="M1 1L9 9M9 1L1 9" />
                </svg>
            </button>
            {autoClose && !isDismissing && <div className={styles.progress} />}
        </div>
    );
}

function renderIcon(type: StatusType) {
    if (type === 'success') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="var(--success-color)" opacity="0.15" />
                <path
                    d="M5 9L7.5 11.5L13 6"
                    stroke="var(--success-color)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
            </svg>
        );
    }

    if (type === 'error') {
        return (
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="9" fill="var(--error-color)" opacity="0.15" />
                <path
                    d="M6 6L12 12M12 6L6 12"
                    stroke="var(--error-color)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                />
            </svg>
        );
    }

    // loading
    return (
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className={styles.spinner}>
            <circle
                cx="9"
                cy="9"
                r="7"
                stroke="var(--primary-color)"
                strokeOpacity="0.25"
                strokeWidth="2"
            />
            <path
                d="M9 2C13.4183 2 17 5.58172 17 10"
                stroke="var(--primary-color)"
                strokeWidth="2"
                strokeLinecap="round"
            />
        </svg>
    );
}
