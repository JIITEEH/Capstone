import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { api } from '../../api-client/api.js';
import AuthLayout from './AuthLayout.jsx';

export default function ForgotPassword() {
  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      setResult(await api.forgotPassword(email));
    } catch (err) {
      setError(err.message);
    } finally {
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

  if (result) {
    const devLink = result.devResetUrl ? new URL(result.devResetUrl) : null;
    return (
      <AuthLayout>
        <h2>Check your email</h2>
        <p className="muted">{result.message} The link expires in 1 hour.</p>

        {devLink && (
          <div className="dev-note">
            <span className="person-label">Development only</span>
            <p className="muted small">
              Emails aren't sent in development. The link was also printed in the server console.
            </p>
            <Link to={devLink.pathname + devLink.search} className="btn btn-secondary btn-sm dev-reset-link">
              Open the reset link
            </Link>
          </div>
        )}

        <button type="button" className="btn btn-secondary btn-block auth-resend" onClick={() => setResult(null)}>
          Use a different email
        </button>
        {backLink}
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2>Forgot your password?</h2>
      <p className="muted">Enter the email for your account and we'll send you a link to reset it.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="forgot-email">Email</label>
          <input
            id="forgot-email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      {backLink}
    </AuthLayout>
  );
}
