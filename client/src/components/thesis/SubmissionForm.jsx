import { useState } from 'react';
import { FileText, Upload } from 'lucide-react';
import { formatBytes } from '../../utils/format.js';

// Keep in sync with maxUploadBytes in server/src/config/index.js
const MAX_MB = 50;
const MAX_BYTES = MAX_MB * 1024 * 1024;

export default function SubmissionForm({ stages, onSubmit, onCancel }) {
  const [stage, setStage] = useState(stages[0]?.key ?? '');
  const [file, setFile] = useState(null);
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function chooseFile(event) {
    const chosen = event.target.files?.[0] ?? null;
    setError('');
    if (chosen && chosen.size > MAX_BYTES) {
      setFile(null);
      return setError(`File must be ${MAX_MB} MB or smaller`);
    }
    setFile(chosen);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file) return setError('Attach your manuscript file');

    const formData = new FormData();
    formData.append('stage', stage);
    formData.append('notes', notes);
    formData.append('file', file);

    setBusy(true);
    setError('');
    try {
      await onSubmit(formData);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="submission-stage">Stage</label>
        <select id="submission-stage" className="input" value={stage} onChange={(e) => setStage(e.target.value)}>
          {stages.map((option) => (
            <option key={option.key} value={option.key}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <span className="label">Manuscript</span>
        <label className={`file-drop${file ? ' has-file' : ''}`}>
          <input type="file" accept=".pdf,.doc,.docx" onChange={chooseFile} />
          {file ? <FileText size={22} /> : <Upload size={22} />}
          {file ? (
            <span>
              <strong>{file.name}</strong>
              <span className="muted"> · {formatBytes(file.size)} · Click to change</span>
            </span>
          ) : (
            <span>
              <strong>Choose a file</strong>
              <span className="muted"> PDF, DOC, or DOCX, up to {MAX_MB} MB</span>
            </span>
          )}
        </label>
      </div>

      <div className="field">
        <label htmlFor="submission-notes">Notes for your adviser (optional)</label>
        <textarea
          id="submission-notes"
          className="input"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
          placeholder="What changed since the last version?"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          <Upload size={16} />
          {busy ? 'Uploading…' : 'Submit for review'}
        </button>
      </div>
    </form>
  );
}
