import { useState } from 'react';
import { ScrollText } from 'lucide-react';
import { EmptyState, LoadState, Spinner } from '../../ui-pieces/basics/Feedback.jsx';
import PageHeader from '../../ui-pieces/basics/PageHeader.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import { formatDateTime } from '../../helpers/format.js';

const FILTERS = [
  { value: '', label: 'Everything' },
  { value: 'user', label: 'Accounts' },
  { value: 'thesis', label: 'Theses' },
];

// Written as what the admin did, so each row reads as a sentence: "Head Admin changed a role"
const ACTIONS = {
  'user.created': 'created an account',
  'user.role_changed': 'changed a role',
  'user.deactivated': 'deactivated an account',
  'user.reactivated': 'reactivated an account',
  'user.password_set': 'set a new password',
  'user.details_changed': 'edited account details',
  'user.deleted': 'deleted an account',
  'thesis.adviser_assigned': 'assigned an adviser',
  'thesis.adviser_removed': 'removed an adviser',
  'thesis.status_overridden': 'overrode a status',
  'thesis.term_changed': 'moved a thesis to another term',
  'thesis.archive_hidden': 'kept a thesis out of the archive',
  'thesis.archive_shown': 'put a thesis back in the archive',
  'thesis.deleted': 'deleted a thesis',
  'thesis.defense_verdict': 'recorded a defense verdict',
};

export default function AuditLog() {
  const [target, setTarget] = useState('');
  // Pages fetched with "Show older", appended below the first page
  const [older, setOlder] = useState({ entries: [], nextBefore: undefined });
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [olderError, setOlderError] = useState('');

  const { data, loading, error, reload } = useApi(() => api.listAudit({ target }), [target]);

  function chooseTarget(value) {
    setOlder({ entries: [], nextBefore: undefined });
    setOlderError('');
    setTarget(value);
  }

  const entries = data ? [...data.entries, ...older.entries] : [];
  const nextBefore = older.nextBefore !== undefined ? older.nextBefore : data?.nextBefore;

  async function showOlder() {
    setLoadingOlder(true);
    setOlderError('');
    try {
      const page = await api.listAudit({ target, before: nextBefore });
      setOlder((prev) => ({ entries: [...prev.entries, ...page.entries], nextBefore: page.nextBefore }));
    } catch (err) {
      setOlderError(err.message);
    } finally {
      setLoadingOlder(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        subtitle="Every change an admin made to accounts and theses, newest first. Entries can't be edited or removed."
      />

      <section className="card card-flush">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Show changes to">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                role="tab"
                aria-selected={target === filter.value}
                className={target === filter.value ? 'active' : ''}
                onClick={() => chooseTarget(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
          {loading && data && <Spinner size={18} />}
        </div>

        {!data ? (
          <div className="card-pad">
            <LoadState loading={loading} error={error} onRetry={reload} />
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="Nothing recorded yet"
            message="Role changes, deactivations, deleted accounts, and adviser assignments will appear here."
          />
        ) : (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Admin</th>
                    <th>Change</th>
                    <th>Details</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="nowrap muted" data-label="When">
                        {formatDateTime(entry.created_at)}
                      </td>
                      <td data-label="Admin">
                        {entry.actor_name}
                        {entry.actor_id === null && <span className="cell-sub">Account since deleted</span>}
                      </td>
                      <td data-label="Change">
                        <strong>{ACTIONS[entry.action] ?? entry.action}</strong>
                        <span className="cell-sub">{entry.target_label}</span>
                      </td>
                      <td data-label="Details">{entry.details || <span className="muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(nextBefore || olderError) && (
              <div className="card-pad">
                {olderError && <p className="form-error">{olderError}</p>}
                {nextBefore && (
                  <button type="button" className="btn btn-secondary" onClick={showOlder} disabled={loadingOlder}>
                    {loadingOlder ? 'Loading…' : 'Show older changes'}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
