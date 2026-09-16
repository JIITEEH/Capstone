import { useState } from 'react';
import { LogOut, Mail, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import { api } from '../../api-client/api.js';
import Avatar from '../basics/Avatar.jsx';
import { Badge } from '../basics/Badge.jsx';
import { ConfirmDialog } from '../basics/Modal.jsx';

// Students in a thesis group. The leader invites classmates by email, and they join once they accept.
// Admins add students directly to fix a group. The leader and admins remove members, and any member
// can leave. The API enforces the same rules.
export default function GroupMembers({ thesis, members, invitations = [], limit, onChanged, onLeft }) {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [pending, setPending] = useState(null); // member chosen for removal, or yourself when leaving
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState('');
  const [cancelling, setCancelling] = useState(null);

  const me = members.find((member) => member.id === user.id);
  const canManage = user.role === 'admin' || Boolean(me?.is_leader);
  // Completed theses are frozen for students; admins can still fix the group
  const editable = thesis.status !== 'completed' || user.role === 'admin';
  const isAdmin = user.role === 'admin';
  // Invitations still out hold a seat, so a leader can't invite past a full group
  const full = members.length + (isAdmin ? 0 : invitations.length) >= limit;
  const leaving = pending?.id === user.id;

  async function handleAdd(event) {
    event.preventDefault();
    setAdding(true);
    setAddError('');
    try {
      if (isAdmin) {
        await api.addThesisMember(thesis.id, email);
        toast.success('Member added to the group');
      } else {
        await api.inviteThesisMember(thesis.id, email);
        toast.success(`Invitation sent to ${email}`);
      }
      setEmail('');
      await onChanged();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleCancel(invitation) {
    setCancelling(invitation.id);
    try {
      await api.cancelInvitation(thesis.id, invitation.id);
      toast.success(`Invitation to ${invitation.student_name} cancelled`);
      await onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setCancelling(null);
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
          {invitations.length > 0 && ` · ${invitations.length} invited`}
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

      {invitations.length > 0 && (
        <ul className="member-list invitation-list" aria-label="Waiting for a reply">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="person member-row member-invited">
              <Avatar name={invitation.student_name} />
              <div>
                <strong>{invitation.student_name}</strong>
                <span className="muted">{invitation.student_email}</span>
              </div>
              <Badge tone="warning">Invited</Badge>
              {canManage && (
                <button
                  type="button"
                  className="icon-btn icon-btn-danger"
                  aria-label={`Cancel the invitation to ${invitation.student_name}`}
                  title="Cancel invitation"
                  disabled={cancelling === invitation.id}
                  onClick={() => handleCancel(invitation)}
                >
                  <X size={16} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && editable && !full && (
        <form className="member-add" onSubmit={handleAdd}>
          <label htmlFor="add-member-email" className="person-label">
            {isAdmin ? 'Add a student' : 'Invite a classmate'}
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
              {isAdmin ? <UserPlus size={16} /> : <Mail size={16} />}
              {isAdmin ? (adding ? 'Adding…' : 'Add') : adding ? 'Sending…' : 'Invite'}
            </button>
          </div>
          {addError && <p className="form-error">{addError}</p>}
          <span className="field-hint">
            {isAdmin
              ? "They're added right away. They need a verified student account and can't be in another group."
              : "They need a verified student account. They'll get a notification and join once they accept."}
          </span>
        </form>
      )}
      {canManage && editable && full && (
        <span className="field-hint">
          {invitations.length > 0 && !isAdmin
            ? 'This group is full, counting invitations still waiting for a reply.'
            : 'This group is full.'}
        </span>
      )}

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
