import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import PasswordInput from '../../ui-pieces/basics/PasswordInput.jsx';
import { api } from '../../api-client/api.js';
import AuthLayout from './AuthLayout.jsx';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      const { message } = await api.resetPassword(token, password);
      navigate('/login', { replace: true, state: { notice: message } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const backLink = (
    <p className="auth-switch">
      <Link to="/login" className="auth-back">
        <ArrowLeft size={14} /> Back to sign in
      </Link>
    </p>
  );

  if (!token) {
    return (
      <AuthLayout>
        <h2>Reset link missing</h2>
        <p className="muted">This page needs the link from your password reset email. Request a new one below.</p>
        <Link to="/forgot-password" className="btn btn-primary btn-block">
          Request a reset link
        </Link>
        {backLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Set a new password</h2>
      <p className="muted">Choose a new password for your account.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reset-password">New password</label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoFocus
          />
          <span className="field-hint">Use at least 8 characters.</span>
        </div>
        <div className="field">
          <label htmlFor="reset-confirm">Confirm new password</label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
        </div>
        {error && (
          <p className="form-error">
            {error}
            {/invalid or has expired/.test(error) && (
              <>
                {' '}
                <Link to="/forgot-password">Request a new link</Link>
              </>
            )}
          </p>
        )}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Saving…' : 'Reset password'}
        </button>
      </form>

      {backLink}
    </AuthLayout>
  );
}
