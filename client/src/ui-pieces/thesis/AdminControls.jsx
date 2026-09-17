import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import { THESIS_STATUS } from '../../helpers/constants.js';
import { plural } from '../../helpers/format.js';
import { ConfirmDialog } from '../basics/Modal.jsx';

export default function AdminControls({ thesis, onChanged }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { data: advisers } = useApi(() => api.listAdvisers(), []);
  const { data: terms } = useApi(() => api.listTerms(), []);
  const [termId, setTermId] = useState(thesis.term_id ?? '');
  const [adviserId, setAdviserId] = useState(thesis.adviser_id ?? '');
  const [status, setStatus] = useState(thesis.status);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setAdviserId(thesis.adviser_id ?? '');
    setStatus(thesis.status);
    setTermId(thesis.term_id ?? '');
  }, [thesis.adviser_id, thesis.status, thesis.term_id]);

  async function run(key, action, successMessage) {
    setBusy(key);
    setError('');
    try {
      await action();
      await onChanged();
      toast.success(successMessage);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const adviserChanged = String(adviserId) !== String(thesis.adviser_id ?? '');
  const statusChanged = status !== thesis.status;
  const termChanged = String(termId) !== String(thesis.term_id ?? '');

  return (
    <section className="card">
      <div className="card-header">
        <h2>Admin controls</h2>
      </div>

      <div className="form">
        <div className="field">
          <label htmlFor="assign-adviser">Adviser</label>
          <div className="inline-field">
            <select id="assign-adviser" className="input" value={adviserId} onChange={(e) => setAdviserId(e.target.value)}>
              <option value="">Not assigned</option>
              {advisers?.map((adviser) => (
                <option key={adviser.id} value={adviser.id}>
                  {adviser.name} ({plural(adviser.advisee_count, 'advisee')})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!adviserChanged || Boolean(busy)}
              onClick={() =>
                run('adviser', () => api.assignAdviser(thesis.id, adviserId ? Number(adviserId) : null), 'Adviser assignment saved')
              }
            >
              {busy === 'adviser' ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>

        <div className="field">
          <label htmlFor="override-status">Status</label>
          <div className="inline-field">
            <select id="override-status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
              {Object.entries(THESIS_STATUS).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!statusChanged || Boolean(busy)}
              onClick={() => run('status', () => api.updateThesisStatus(thesis.id, status), 'Thesis status updated')}
            >
              {busy === 'status' ? 'Saving…' : 'Update'}
            </button>
          </div>
          <span className="field-hint">Status updates automatically after each submission and review.</span>
        </div>

        <div className="field">
          <label htmlFor="thesis-term">Term</label>
          <div className="inline-field">
            <select id="thesis-term" className="input" value={termId} onChange={(e) => setTermId(e.target.value)}>
              <option value="">No term</option>
              {terms?.map((term) => (
                <option key={term.id} value={term.id}>
                  {term.name}
                  {term.is_current ? ' (current)' : ''}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!termChanged || Boolean(busy)}
              onClick={() => run('term', () => api.setThesisTerm(thesis.id, termId ? Number(termId) : null), 'Term updated')}
            >
              {busy === 'term' ? 'Saving…' : 'Move'}
            </button>
          </div>
          <span className="field-hint">The term sets this thesis's stage due dates.</span>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={Boolean(thesis.in_archive)}
            disabled={Boolean(busy)}
            onChange={(e) => {
              const inArchive = e.target.checked;
              run('archive', () => api.setThesisArchived(thesis.id, inArchive), inArchive ? 'Shown in the archive' : 'Kept out of the archive');
            }}
          />
          <span>
            <strong>Show in the thesis archive</strong>
            <span className="muted"> · Once completed, anyone signed in can read it and download the final manuscript</span>
          </span>
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="button" className="btn btn-danger-ghost" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={16} />
          Delete thesis
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this thesis?"
        message={`This permanently deletes "${thesis.title}", including all submissions, files, and comments.`}
        confirmLabel="Delete thesis"
        busy={busy === 'delete'}
        error={confirmDelete ? error : ''}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setBusy('delete');
          setError('');
          try {
            await api.deleteThesis(thesis.id);
            toast.success('Thesis deleted');
            navigate('/theses', { replace: true });
          } catch (err) {
            setError(err.message);
            setBusy('');
          }
        }}
      />
    </section>
  );
}
