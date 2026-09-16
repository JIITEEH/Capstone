import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { KeyRound, UserPlus } from 'lucide-react';
import PasswordInput from '../../ui-pieces/basics/PasswordInput.jsx';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import AuthLayout from './AuthLayout.jsx';

const ROLE_GROUPS = [
  { role: 'admin', label: 'Admins' },
  { role: 'adviser', label: 'Advisers' },
  { role: 'student', label: 'Students' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Current accounts from the database; the endpoint only exists outside production
  const { data: demo } = useApi(() => (import.meta.env.DEV ? api.demoAccounts() : Promise.resolve(null)), []);

  function chooseAccount(account) {
    setEmail(account.email);
    setError('');
    if (account.usesDemoPassword) {
      setPassword(demo.demoPassword);
    } else {
      setPassword('');
      passwordRef.current?.focus();
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password, remember);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Welcome back</h2>
      <p className="muted">Sign in to continue to your thesis workspace</p>

      {location.state?.notice && <p className="form-success auth-notice">{location.state.notice}</p>}

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="input"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <PasswordInput
            id="login-password"
            ref={passwordRef}
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <label className="checkbox">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Keep me signed in
        </label>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="auth-alt">
        <Link to="/forgot-password" state={{ email }} className="btn">
          <KeyRound size={17} />
          Forgot password
        </Link>
        <Link to="/register" className="btn">
          <UserPlus size={17} />
          Register
        </Link>
      </div>

      {demo?.accounts.length > 0 && (
        <details className="demo-accounts">
          <summary>Use a demo account</summary>
          <p className="muted small">
            Pick an account to fill in the form. Accounts marked <KeyRound size={11} /> don't use the default password{' '}
            <strong>{demo.demoPassword}</strong>, so type theirs in.
          </p>
          {ROLE_GROUPS.map(({ role, label }) => {
            const group = demo.accounts.filter((account) => account.role === role);
            if (!group.length) return null;
            return (
              <div key={role} className="demo-group">
                <span className="demo-group-label">{label}</span>
                <div className="demo-buttons">
                  {group.map((account) => (
                    <button
                      key={account.id}
                      type="button"
                      className={`btn btn-secondary btn-sm${email === account.email ? ' demo-selected' : ''}`}
                      title={account.email}
                      onClick={() => chooseAccount(account)}
                    >
                      {account.name}
                      {!account.usesDemoPassword && <KeyRound size={12} aria-label="Uses a custom password" />}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </details>
      )}
    </AuthLayout>
  );
}
