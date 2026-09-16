import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function Modal({ open, title, description, onClose, children, size = 'md' }) {
  const dialogRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const dialog = dialogRef.current;
    // The page behind stays visible but is taken out of the tab order and away from screen readers
    const appRoot = document.getElementById('root');
    const openerFocus = document.activeElement;

    function focusable() {
      return [...dialog.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
    }

    const onKey = (event) => {
      if (event.key === 'Escape') return onClose();
      if (event.key !== 'Tab') return;

      const items = focusable();
      if (items.length === 0) return event.preventDefault();
      const first = items[0];
      const last = items.at(-1);
      // Wrap around instead of stepping out onto the page behind
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    (focusable()[0] ?? dialog).focus();
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    appRoot?.setAttribute('inert', '');

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
      appRoot?.removeAttribute('inert');
      // Put the keyboard back where it was, so closing doesn't drop the user at the top of the page
      if (openerFocus instanceof HTMLElement && document.contains(openerFocus)) openerFocus.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered into <body>: cards animate in with a lingering transform, which would otherwise
  // trap this position: fixed overlay inside whichever card opened the dialog
  return createPortal(
    <div
      className="modal-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="modal-header">
          <div>
            <h2 id="modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  busy,
  error,
  onConfirm,
  onClose,
}) {
  return (
    <Modal open={open} title={title} onClose={onClose} size="sm">
      <p className="muted">{message}</p>
      {error && <p className="form-error">{error}</p>}
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>
          {cancelLabel}
        </button>
        <button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
