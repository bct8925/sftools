import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Toast } from '../components/toast/Toast';
import styles from '../components/toast/Toast.module.css';

export type StatusType = 'loading' | 'success' | 'error';

interface ToastItem {
    id: string;
    message: string;
    type: StatusType;
    autoClose: boolean;
}

export interface UseToastReturn {
    show: (message: string, type: StatusType) => string;
    update: (id: string, message: string, type?: StatusType) => void;
    dismiss: (id: string) => void;
}

const ToastContext = createContext<UseToastReturn | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);

    const show = useCallback((message: string, type: StatusType): string => {
        const id = String(++nextId);
        const autoClose = type !== 'loading';
        // Prepend so newest toast appears at top
        setToasts(prev => [{ id, message, type, autoClose }, ...prev]);
        return id;
    }, []);

    const update = useCallback((id: string, message: string, type?: StatusType) => {
        setToasts(prev =>
            prev.map(t => {
                if (t.id !== id) return t;
                const newType = type ?? t.type;
                const autoClose = newType !== 'loading';
                return { ...t, message, type: newType, autoClose };
            })
        );
    }, []);

    const dismiss = useCallback((id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ show, update, dismiss }}>
            {children}
            {createPortal(
                <div className={styles.container} aria-live="polite">
                    {toasts.map(toast => (
                        <Toast key={toast.id} {...toast} onDismiss={dismiss} />
                    ))}
                </div>,
                document.body
            )}
        </ToastContext.Provider>
    );
}

export function useToast(): UseToastReturn {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
}
