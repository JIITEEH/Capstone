import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Download, Pencil, Search, Trash2, UserPlus, Users as UsersIcon } from 'lucide-react';
import Avatar from '../../ui-pieces/basics/Avatar.jsx';
import { Badge, RoleBadge } from '../../ui-pieces/basics/Badge.jsx';
import { EmptyState, LoadState, Spinner } from '../../ui-pieces/basics/Feedback.jsx';
import Modal, { ConfirmDialog } from '../../ui-pieces/basics/Modal.jsx';
import PageHeader from '../../ui-pieces/basics/PageHeader.jsx';
import Pagination from '../../ui-pieces/basics/Pagination.jsx';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import usePage from '../../reusable-logic/usePage.js';
import { api } from '../../api-client/api.js';
import { ROLES } from '../../helpers/constants.js';
import { formatDate, plural } from '../../helpers/format.js';

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
  const toast = useToast();
  const [role, setRole] = useState('');
  // Search results for a person arrive as ?q=
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';
  const [searchInput, setSearchInput] = useState(query);
  const [search, setSearch] = useState(query.trim());
  const [editing, setEditing] = useState(null); // null, 'new', or a user object
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });

  useEffect(() => {
    setSearchInput(query);
  }, [query]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const [page, setPage] = usePage({ role, search });
  const { data, loading, error, reload } = useApi(() => api.listUsers({ role, search, page }), [role, search, page]);
  const users = data?.items;

  const [exporting, setExporting] = useState(false);
  async function exportWorkload() {
    setExporting(true);
    try {
      await api.exportAdviserWorkload();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setExporting(false);
    }
  }

  async function confirmDelete() {
    setDeleteState({ busy: true, error: '' });
    try {
      await api.deleteUser(deleting.id);
      toast.success(`${deleting.name} was deleted`);
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
          <>
            <button type="button" className="btn btn-secondary" onClick={exportWorkload} disabled={exporting}>
              <Download size={16} />
              {exporting ? 'Preparing…' : 'Export adviser workload'}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
              <UserPlus size={16} />
              Add user
            </button>
          </>
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
                    <td data-label="User">
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
                    <td data-label="Role">
                      <RoleBadge role={u.role} />
                      {u.role === 'adviser' && <span className="cell-sub">{plural(u.advisee_count, 'advisee')}</span>}
                    </td>
                    <td className="hide-tablet" data-label="Program / Department">
                      {u.program || <span className="muted">—</span>}
                    </td>
                    <td data-label="Status">
                      {u.is_active ? <Badge tone="success">Active</Badge> : <Badge tone="danger">Inactive</Badge>}
                    </td>
                    <td className="hide-tablet nowrap muted" data-label="Joined">{formatDate(u.created_at)}</td>
                    <td className="cell-actions">
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
        {data && <Pagination {...data} onChange={setPage} />}
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
              toast.success(editing === 'new' ? 'User created' : 'User updated');
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
            ? 'This permanently removes the account and takes them out of their thesis group. If they are the only member, the thesis, its submissions, and uploaded files are deleted too.'
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
