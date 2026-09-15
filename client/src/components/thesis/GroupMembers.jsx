import { useState } from 'react';
import { LogOut, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../services/api.js';
import Avatar from '../ui/Avatar.jsx';
import { Badge } from '../ui/Badge.jsx';
import { ConfirmDialog } from '../ui/Modal.jsx';

// Students in a thesis group. The leader and admins add classmates by email and remove members,
// and any member can leave. The API enforces the same rules.
export default function GroupMembers({ thesis, members, limit, onChanged, onLeft }) {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [pending, setPending] = useState(null); // member chosen for removal, or yourself when leaving
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');

  const me = members.find((member) => member.id === user.id);
  const canManage = user.role === 'admin' || Boolean(me?.is_leader);
  // Completed theses are frozen for students; admins can still fix the group
  const editable = thesis.status !== 'completed' || user.role === 'admin';
  const full = members.length >= limit;
  const leaving = pending?.id === user.id;

  async function handleAdd(event) {
    event.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      await api.addThesisMember(thesis.id, email);
      setEmail('');
      toast.success('Member added to the group');
      await onChanged();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove() {
    setRemoving(true);
    setRemoveError('');
    try {
      await api.removeThesisMember(thesis.id, pending.id);
      setPending(null);
      if (leaving) {
        toast.success('You left the group');
        onLeft?.();
      } else {
        toast.success(`${pending.name} was removed from the group`);
        await onChanged();
      }
    } catch (err) {
      setRemoveError(err.message);
    } finally {
      setRemoving(false);
    }
  }

  function removalMessage() {
    if (!pending) return '';
    const handover = pending.is_leader && members.length > 1 ? ' The next member in the list becomes the group leader.' : '';
    return leaving
      ? `You'll lose access to "${thesis.title}" and its submissions.${handover}`
      : `${pending.name} will lose access to this thesis and can join or start another one.${handover}`;
  }

  return (
    <div className="group-members">
      <div className="group-members-head">
        <span className="person-label">Group</span>
        <span className="field-hint">
          {members.length} of {limit} students
        </span>
      </div>

      <ul className="member-list">
        {members.map((member) => {
          const isMe = member.id === user.id;
          const canRemove = editable && members.length > 1 && (isMe || canManage);
          return (
            <li key={member.id} className="person member-row">
              <Avatar name={member.name} />
              <div>
                <strong>
                  {member.name}
                  {isMe && <span className="muted"> (you)</span>}
                </strong>
                <span className="muted">{member.program || member.email}</span>
              </div>
              {Boolean(member.is_leader) && <Badge tone="primary">Leader</Badge>}
              {canRemove && (
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={isMe ? 'Leave group' : `Remove ${member.name}`}
                  title={isMe ? 'Leave group' : `Remove ${member.name}`}
                  onClick={() => {
                    setRemoveError('');
                    setPending(member);
                  }}
                >
                  {isMe ? <LogOut size={16} /> : <X size={16} />}
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {canManage && editable && !full && (
        <form className="member-add" onSubmit={handleAdd}>
          <label htmlFor="add-member-email" className="person-label">
            Add a classmate
          </label>
          <div className="inline-field">
            <input
              id="add-member-email"
              type="email"
              className="input"
              placeholder="classmate@school.edu"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button type="submit" className="btn btn-secondary" disabled={adding}>
              <UserPlus size={16} />
              {adding ? 'Adding…' : 'Add'}
            </button>
          </div>
          {addError && <p className="form-error">{addError}</p>}
          <span className="field-hint">They need a student account and can't already be in another group.</span>
        </form>
      )}
      {canManage && editable && full && <span className="field-hint">This group is full.</span>}

      <ConfirmDialog
        open={Boolean(pending)}
        title={leaving ? 'Leave this group?' : `Remove ${pending?.name ?? 'this member'}?`}
        message={removalMessage()}
        confirmLabel={leaving ? 'Leave group' : 'Remove member'}
        busy={removing}
        error={removeError}
        onClose={() => setPending(null)}
        onConfirm={handleRemove}
      />
    </div>
  );
}
