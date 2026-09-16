import { useState } from 'react';
import { Eye, EyeOff, TriangleAlert } from 'lucide-react';

// Password field with a show/hide toggle and a Caps Lock warning
export default function PasswordInput({ id, onKeyDown, onKeyUp, onBlur, ...props }) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);

  const checkCapsLock = (event) => setCapsLock(event.getModifierState?.('CapsLock') ?? false);

  return (
    <>
      <div className="password-input">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          className="input"
          aria-describedby={capsLock ? `${id}-caps` : undefined}
          onKeyDown={(event) => {
            checkCapsLock(event);
            onKeyDown?.(event);
          }}
          onKeyUp={(event) => {
            checkCapsLock(event);
            onKeyUp?.(event);
          }}
          onBlur={(event) => {
            setCapsLock(false);
            onBlur?.(event);
          }}
        />
        <button
          type="button"
          className="password-toggle"
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-controls={id}
          aria-pressed={visible}
          title={visible ? 'Hide password' : 'Show password'}
          // Keep focus in the field so typing can continue after toggling
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((value) => !value)}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {capsLock && (
        <span id={`${id}-caps`} className="caps-warning" role="status">
          <TriangleAlert size={14} /> Caps Lock is on
        </span>
      )}
    </>
  );
}
