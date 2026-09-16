import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import AuthLayout from './AuthLayout.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', program: '', password: '', confirm: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => setValues((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (values.password !== values.confirm) return setError('Passwords do not match');
    setBusy(true);
    setError('');
    try {
      const { confirm, ...data } = values;
      await register(data);
      navigate('/thesis', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthLayout>
      <h1>Create a student account</h1>
      <p className="muted">Adviser and admin accounts are created by an administrator.</p>

      <form className="form" onSubmit={handleSubmit}>
        <div className="field">
          <label htmlFor="reg-name">Full name</label>
          <input id="reg-name" className="input" autoComplete="name" value={values.name} onChange={update('name')} required autoFocus />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Email</label>
          <input id="reg-email" type="email" className="input" autoComplete="email" value={values.email} onChange={update('email')} required />
        </div>
        <div className="field">
          <label htmlFor="reg-program">Degree program</label>
          <input id="reg-program" className="input" placeholder="BS Computer Science" value={values.program} onChange={update('program')} />
        </div>
        <div className="form-row">
          <div className="field">
            <label htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="input"
              autoComplete="new-password"
              minLength={8}
              value={values.password}
              onChange={update('password')}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reg-confirm">Confirm password</label>
            <input
              id="reg-confirm"
              type="password"
              className="input"
              autoComplete="new-password"
              value={values.confirm}
              onChange={update('confirm')}
              required
            />
          </div>
        </div>
        <span className="field-hint">Use at least 8 characters.</span>
        {error && <p className="form-error">{error}</p>}
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Sign in</Link>
      </p>
    </AuthLayout>
  );
}
