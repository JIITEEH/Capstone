import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Trash2 } from 'lucide-react';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { THESIS_STATUS } from '../../utils/constants.js';
import { plural } from '../../utils/format.js';
import { ConfirmDialog } from '../ui/Modal.jsx';

export default function AdminControls({ thesis, onChanged }) {
  const navigate = useNavigate();
  const { data: advisers } = useApi(() => api.listAdvisers(), []);
  const [adviserId, setAdviserId] = useState(thesis.adviser_id ?? '');
  const [status, setStatus] = useState(thesis.status);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setAdviserId(thesis.adviser_id ?? '');
    setStatus(thesis.status);
  }, [thesis.adviser_id, thesis.status]);

  async function run(key, action) {
    setBusy(key);
    setError('');
    try {
      await action();
      await onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  }

  const adviserChanged = String(adviserId) !== String(thesis.adviser_id ?? '');
  const statusChanged = status !== thesis.status;

  return (
    <section className="card">
      <div className="card-header">
        <h3>Admin controls</h3>
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
              onClick={() => run('adviser', () => api.assignAdviser(thesis.id, adviserId ? Number(adviserId) : null))}
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
              onClick={() => run('status', () => api.updateThesisStatus(thesis.id, status))}
            >
              {busy === 'status' ? 'Saving…' : 'Update'}
            </button>
          </div>
          <span className="field-hint">Status updates automatically after each submission and review.</span>
        </div>

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
