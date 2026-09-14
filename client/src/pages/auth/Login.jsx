import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuth } from '../../context/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

// Accounts created by `npm run db:seed`. Only shown in development builds.
const DEMO_ACCOUNTS = [
  { role: 'Student', email: 'ana.cruz@tms.edu' },
  { role: 'Adviser', email: 'maria.santos@tms.edu' },
  { role: 'Admin', email: 'admin@tms.edu' },
];

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(email, password);
      navigate(location.state?.from ?? '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h2>Sign in</h2>
      <p className="muted">Welcome back. Enter your account details to continue.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            className="input"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="login-password">Password</label>
          <input
            id="login-password"
            type="password"
            className="input"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="auth-switch">
        New student? <Link to="/register">Create an account</Link>
      </p>

      {import.meta.env.DEV && (
        <div className="demo-accounts">
          <span className="person-label">Demo accounts</span>
          <p className="muted small">
            Every demo account uses the password <strong>password123</strong>.
          </p>
          <div className="demo-buttons">
            {DEMO_ACCOUNTS.map((account) => (
              <button
                key={account.email}
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setEmail(account.email);
                  setPassword('password123');
                }}
              >
                {account.role}
              </button>
            ))}
          </div>
        </div>
      )}
    </AuthLayout>
  );
}
