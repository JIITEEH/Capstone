import { useEffect, useState } from 'react';
import { Pencil, Search, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import Avatar from '../../components/ui/Avatar.jsx';
import { Badge, RoleBadge } from '../../components/ui/Badge.jsx';
import { EmptyState, LoadState, Spinner } from '../../components/ui/Feedback.jsx';
import Modal, { ConfirmDialog } from '../../components/ui/Modal.jsx';
import PageHeader from '../../components/ui/PageHeader.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { ROLES } from '../../utils/constants.js';
import { formatDate, plural } from '../../utils/format.js';

const ROLE_FILTERS = [
  { value: '', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'adviser', label: 'Advisers' },
  { value: 'admin', label: 'Admins' },
];

function UserForm({ user, isSelf, onSaved, onCancel }) {
  const editing = Boolean(user);
  const [values, setValues] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    role: user?.role ?? 'student',
    program: user?.program ?? '',
    password: '',
    is_active: user ? Boolean(user.is_active) : true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
  };

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const payload = { ...values };
      if (editing && !payload.password) delete payload.password;
      if (editing) await api.updateUser(user.id, payload);
      else await api.createUser(payload);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="form-row">
        <div className="field">
          <label htmlFor="user-name">Full name</label>
          <input id="user-name" className="input" value={values.name} onChange={update('name')} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="user-email">Email</label>
          <input id="user-email" type="email" className="input" value={values.email} onChange={update('email')} />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="user-role">Role</label>
          <select id="user-role" className="input" value={values.role} onChange={update('role')} disabled={isSelf}>
            {Object.entries(ROLES).map(([key, info]) => (
              <option key={key} value={key}>
                {info.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="user-program">{values.role === 'student' ? 'Degree program' : 'Department'}</label>
          <input id="user-program" className="input" value={values.program} onChange={update('program')} />
        </div>
      </div>

      <div className="field">
        <label htmlFor="user-password">{editing ? 'Reset password' : 'Temporary password'}</label>
        <input
          id="user-password"
          type="password"
          className="input"
          value={values.password}
          onChange={update('password')}
          autoComplete="new-password"
          placeholder={editing ? 'Leave blank to keep the current password' : 'At least 8 characters'}
        />
      </div>

      {editing && !isSelf && (
        <label className="checkbox">
          <input type="checkbox" checked={values.is_active} onChange={update('is_active')} />
          <span>
            <strong>Active account</strong>
            <span className="muted"> · Inactive users can't sign in</span>
          </span>
        </label>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
        </button>
      </div>
    </form>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const [role, setRole] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // null, 'new', or a user object
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });

  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: users, loading, error, reload } = useApi(() => api.listUsers({ role, search }), [role, search]);

  async function confirmDelete() {
    setDeleteState({ busy: true, error: '' });
    try {
      await api.deleteUser(deleting.id);
      setDeleting(null);
      setDeleteState({ busy: false, error: '' });
      reload();
    } catch (err) {
      setDeleteState({ busy: false, error: err.message });
    }
  }

  return (
    <>
      <PageHeader
        title="Users"
        subtitle="Create accounts for advisers and admins, and manage every user's access."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <UserPlus size={16} />
            Add user
          </button>
        }
      />

      <section className="card card-flush">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Filter by role">
            {ROLE_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={role === filter.value}
                className={role === filter.value ? 'active' : ''}
                onClick={() => setRole(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="search-input">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by name or email"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              aria-label="Search users"
            />
          </label>
          {loading && users && <Spinner size={18} />}
        </div>

        {!users ? (
          <div className="card-pad">
            <LoadState loading={loading} error={error} />
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={UsersIcon} title="No users found" />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th className="hide-tablet">Program / Department</th>
                  <th>Status</th>
                  <th className="hide-tablet">Joined</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="cell-user">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <strong>
                            {u.name}
                            {u.id === currentUser.id && <span className="muted"> (you)</span>}
                          </strong>
                          <span className="cell-sub">{u.email}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <RoleBadge role={u.role} />
                      {u.role === 'adviser' && <span className="cell-sub">{plural(u.advisee_count, 'advisee')}</span>}
                    </td>
                    <td className="hide-tablet">{u.program || <span className="muted">—</span>}</td>
                    <td>{u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}</td>
                    <td className="hide-tablet nowrap muted">{formatDate(u.created_at)}</td>
                    <td>
                      <div className="row-actions">
                        <button type="button" className="icon-btn" onClick={() => setEditing(u)} aria-label={`Edit ${u.name}`}>
                          <Pencil size={16} />
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            onClick={() => {
                              setDeleteState({ busy: false, error: '' });
                              setDeleting(u);
                            }}
                            aria-label={`Delete ${u.name}`}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(editing)}
        title={editing === 'new' ? 'Add user' : 'Edit user'}
        description={editing === 'new' ? 'Share the temporary password with the user so they can sign in.' : undefined}
        onClose={() => setEditing(null)}
        size="lg"
      >
        {editing && (
          <UserForm
            key={editing === 'new' ? 'new' : editing.id}
            user={editing === 'new' ? null : editing}
            isSelf={editing !== 'new' && editing.id === currentUser.id}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              await reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        message={
          deleting?.role === 'student' && deleting?.has_thesis
            ? "This also permanently deletes the student's thesis, submissions, and uploaded files."
            : 'This permanently removes the account. You can deactivate it instead to keep its history.'
        }
        confirmLabel="Delete user"
        busy={deleteState.busy}
        error={deleteState.error}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
