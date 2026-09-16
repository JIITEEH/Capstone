import { useState } from 'react';
import { Check, Mail, X } from 'lucide-react';
import { useToast } from '../../shared-state/ToastContext.jsx';
import { api } from '../../api-client/api.js';

// Invitations a student without a group has received. Accepting joins that group, which withdraws
// the others; declining tells the leader.
export default function GroupInvitations({ invitations, onJoined, onChanged }) {
  const toast = useToast();
  const [busy, setBusy] = useState(null); // id of the invitation being answered
  const [error, setError] = useState({ id: null, message: '' });

  async function answer(invitation, choice) {
    setBusy(invitation.id);
    setError({ id: null, message: '' });
    try {
      if (choice === 'accept') {
        await api.acceptInvitation(invitation.id);
        toast.success(`You joined "${invitation.thesis_title}"`);
        await onJoined();
      } else {
        await api.declineInvitation(invitation.id);
        toast.success('Invitation declined');
        await onChanged();
      }
    } catch (err) {
      setError({ id: invitation.id, message: err.message });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="card invitations-card">
      <div className="card-header">
        <h2>
          <Mail size={18} aria-hidden="true" /> Group invitations
        </h2>
      </div>
      <ul className="invite-cards">
        {invitations.map((invitation) => (
          <li key={invitation.id} className="invite-card">
            <div className="invite-card-text">
              <strong>{invitation.thesis_title}</strong>
              <span className="muted small">
                {invitation.invited_by_name ? `${invitation.invited_by_name} invited you. ` : ''}
                Group: {invitation.group_names}
              </span>
              {error.id === invitation.id && <p className="form-error">{error.message}</p>}
            </div>
            <div className="invite-card-actions">
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={busy !== null}
                onClick={() => answer(invitation, 'accept')}
              >
                <Check size={16} />
                {busy === invitation.id ? 'Working…' : 'Accept'}
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy !== null}
                onClick={() => answer(invitation, 'decline')}
              >
                <X size={16} />
                Decline
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
