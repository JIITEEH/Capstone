import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';

const ToastContext = createContext(null);
const TOAST_DURATION = 4000;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((list) => list.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (tone, message) => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, tone, message }]);
      setTimeout(() => dismiss(id), TOAST_DURATION);
    },
    [dismiss],
  );

  const value = useMemo(
    () => ({
      success: (message) => show('success', message),
      error: (message) => show('error', message),
    }),
    [show],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.tone === 'success' ? CircleCheck : CircleAlert;
          return (
            <div key={toast.id} className={`toast toast-${toast.tone}`} role="status">
              <Icon size={18} />
              <span>{toast.message}</span>
              <button type="button" className="toast-close" onClick={() => dismiss(toast.id)} aria-label="Dismiss">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
