import { useState } from 'react';
import { Mail } from 'lucide-react';
import { Badge } from '../basics/Badge.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';

// Shows whether password reset emails can go out, and lets the admin prove it with a test email.
// Loading the card doesn't contact the mail server; only the button does.
export default function EmailStatusCard() {
  const { data: status, error: loadError } = useApi(() => api.emailStatus(), []);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { ok, message }

  async function sendTest() {
    setBusy(true);
    setResult(null);
    try {
      const { message } = await api.sendTestEmail();
      setResult({ ok: true, message });
    } catch (err) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  }

  let badge = null;
  let detail = 'Checking email settings…';
  if (loadError) {
    detail = loadError;
  } else if (status?.configured) {
    // Until a test runs, all we know is that settings exist, not that they work
    badge = result ? (
      <Badge tone={result.ok ? 'success' : 'danger'}>{result.ok ? 'Working' : 'Not working'}</Badge>
    ) : (
      <Badge tone="info">Set up</Badge>
    );
    detail = status.host ? `Sends through ${status.host}:${status.port} as ${status.from}.` : `Sends as ${status.from}.`;
  } else if (status) {
    badge = <Badge tone="warning">Not set up</Badge>;
    detail = "SMTP_HOST is empty in server/.env, so password reset emails aren't sent. See DEPLOYMENT.md, section 4.";
  }

  return (
    <section className="dash-card email-status">
      <div className="dash-card-head">
        <h2>
          <Mail size={18} aria-hidden="true" /> Email
        </h2>
        {badge}
      </div>
      <p className="muted small">{detail}</p>
      {result && (
        <p className={result.ok ? 'form-success' : 'form-error'} role="status">
          {result.message}
        </p>
      )}
      {status?.configured && (
        <button type="button" className="btn btn-secondary btn-sm" onClick={sendTest} disabled={busy}>
          {busy ? 'Sending…' : 'Send test email'}
        </button>
      )}
    </section>
  );
}
