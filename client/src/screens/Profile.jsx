import { useState } from 'react';
import Avatar from '../ui-pieces/basics/Avatar.jsx';
import { RoleBadge } from '../ui-pieces/basics/Badge.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { api } from '../api-client/api.js';
import { formatDate } from '../helpers/format.js';

function useFormStatus() {
  const [status, setStatus] = useState({ busy: false, error: '', success: '' });
  async function run(action, successMessage) {
    setStatus({ busy: true, error: '', success: '' });
    try {
      await action();
      setStatus({ busy: false, error: '', success: successMessage });
      return true;
    } catch (err) {
      setStatus({ busy: false, error: err.message, success: '' });
      return false;
    }
  }
  return [status, run];
}

export default function Profile() {
  const { user, setUser } = useAuth();
  const [details, setDetails] = useState({ name: user.name, program: user.program ?? '' });
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [detailsStatus, runDetails] = useFormStatus();
  const [passwordStatus, runPassword] = useFormStatus();

  function saveDetails(event) {
    event.preventDefault();
    runDetails(async () => {
      const { user: updated } = await api.updateMe(details);
      setUser(updated);
    }, 'Profile updated.');
  }

  async function savePassword(event) {
    event.preventDefault();
    const ok = await runPassword(async () => {
      if (passwords.newPassword !== passwords.confirm) throw new Error('New passwords do not match');
      await api.updateMe({ currentPassword: passwords.currentPassword, newPassword: passwords.newPassword });
    }, 'Password changed.');
    if (ok) setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
  }

  return (
    <>
      <PageHeader title="Profile" subtitle="Manage your account details and password." />

      <div className="detail-layout detail-layout-reverse">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <h3>Account details</h3>
            </div>
            <form className="form" onSubmit={saveDetails}>
              <div className="field">
                <label htmlFor="profile-name">Full name</label>
                <input
                  id="profile-name"
                  className="input"
                  value={details.name}
                  onChange={(e) => setDetails({ ...details, name: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="profile-email">Email</label>
                <input id="profile-email" className="input" value={user.email} disabled />
                <span className="field-hint">Contact an administrator to change your email.</span>
              </div>
              <div className="field">
                <label htmlFor="profile-program">{user.role === 'student' ? 'Degree program' : 'Department'}</label>
                <input
                  id="profile-program"
                  className="input"
                  value={details.program}
                  onChange={(e) => setDetails({ ...details, program: e.target.value })}
                />
              </div>
              {detailsStatus.error && <p className="form-error">{detailsStatus.error}</p>}
              {detailsStatus.success && <p className="form-success">{detailsStatus.success}</p>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={detailsStatus.busy}>
                  {detailsStatus.busy ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </section>

          <section className="card">
            <div className="card-header">
              <h3>Change password</h3>
            </div>
            <form className="form" onSubmit={savePassword}>
              <div className="field">
                <label htmlFor="current-password">Current password</label>
                <input
                  id="current-password"
                  type="password"
                  className="input"
                  autoComplete="current-password"
                  value={passwords.currentPassword}
                  onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div className="field">
                  <label htmlFor="new-password">New password</label>
                  <input
                    id="new-password"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                  />
                </div>
                <div className="field">
                  <label htmlFor="confirm-password">Confirm new password</label>
                  <input
                    id="confirm-password"
                    type="password"
                    className="input"
                    autoComplete="new-password"
                    value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                  />
                </div>
              </div>
              {passwordStatus.error && <p className="form-error">{passwordStatus.error}</p>}
              {passwordStatus.success && <p className="form-success">{passwordStatus.success}</p>}
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={passwordStatus.busy}>
                  {passwordStatus.busy ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </section>
        </div>

        <aside>
          <section className="card profile-card">
            <Avatar name={user.name} size="lg" />
            <h2>{user.name}</h2>
            <p className="muted">{user.email}</p>
            <RoleBadge role={user.role} />
            <p className="muted small">Member since {formatDate(user.created_at)}</p>
          </section>
        </aside>
      </div>
    </>
  );
}
