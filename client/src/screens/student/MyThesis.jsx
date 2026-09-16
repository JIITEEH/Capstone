import { useState } from 'react';
import { Link, useLocation } from 'react-router';
import { MailCheck } from 'lucide-react';
import GroupInvitations from '../../ui-pieces/thesis/GroupInvitations.jsx';
import ThesisForm from '../../ui-pieces/thesis/ThesisForm.jsx';
import { EmptyState, LoadState } from '../../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../../ui-pieces/basics/PageHeader.jsx';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import ThesisDetail from '../ThesisDetail.jsx';

// A student who signed up must confirm their email before starting or joining a group, so nobody can
// register with a classmate's address and be added in their place.
function VerifyFirst({ email, devVerifyUrl }) {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const [error, setError] = useState('');
  const devLink = sent?.devVerifyUrl ?? devVerifyUrl;

  async function resend() {
    setBusy(true);
    setError('');
    try {
      setSent(await api.resendVerification());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card form-card">
      <EmptyState
        icon={MailCheck}
        title="Verify your email to start a thesis"
        message={
          sent
            ? sent.message
            : `We sent a link to ${email}. Open it to confirm the address is yours. Until then you can't start a thesis or be invited to a group.`
        }
        action={
          <button type="button" className="btn btn-secondary" onClick={resend} disabled={busy}>
            {busy ? 'Sending…' : 'Send a new link'}
          </button>
        }
      />
      {error && <p className="form-error">{error}</p>}
      {devLink && (
        <div className="dev-note">
          <span className="person-label">Development only</span>
          <p className="muted small">Emails aren&apos;t sent without a mail server. The link was also printed in the server console.</p>
          <Link to={new URL(devLink).pathname + new URL(devLink).search} className="btn btn-secondary btn-sm dev-reset-link">
            Open the verification link
          </Link>
        </div>
      )}
    </section>
  );
}

export default function MyThesis() {
  const { user } = useAuth();
  const location = useLocation();
  const { data: theses, loading, error, reload } = useApi(() => api.listTheses(), []);
  const invites = useApi(() => api.listMyInvitations(), []);

  if (!theses) return <LoadState loading={loading} error={error} />;
  // Leaving the group reloads this page, which then offers to start a new thesis
  if (theses.length) return <ThesisDetail thesisId={theses[0].id} onLeft={reload} />;

  if (!user.email_verified) {
    return (
      <>
        <PageHeader title="Start your thesis" subtitle="One step first: confirm your email address." />
        <VerifyFirst email={user.email} devVerifyUrl={location.state?.devVerifyUrl} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Start your thesis"
        subtitle="Add the basic details now. You'll lead the group and can invite classmates afterwards. Joining someone else's group? Ask the group leader to invite you by email, then accept it here."
      />
      <div className="stack">
        {invites.data?.length > 0 && (
          <GroupInvitations invitations={invites.data} onJoined={reload} onChanged={invites.reload} />
        )}
        <section className="card form-card">
          <ThesisForm
            submitLabel="Create thesis"
            onSubmit={async (values) => {
              await api.createThesis(values);
              await reload();
            }}
          />
        </section>
      </div>
    </>
  );
}
