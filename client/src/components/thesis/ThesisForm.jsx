import { useState } from 'react';

export default function ThesisForm({ initial = {}, submitLabel, onSubmit, onCancel }) {
  const [values, setValues] = useState({
    title: initial.title ?? '',
    abstract: initial.abstract ?? '',
    keywords: initial.keywords ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => setValues((prev) => ({ ...prev, [field]: event.target.value }));

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.title.trim()) return setError('Enter a thesis title');
    setBusy(true);
    setError('');
    try {
      await onSubmit(values);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="thesis-title">Title</label>
        <input id="thesis-title" className="input" value={values.title} onChange={update('title')} maxLength={250} autoFocus />
      </div>
      <div className="field">
        <label htmlFor="thesis-abstract">Abstract</label>
        <textarea
          id="thesis-abstract"
          className="input"
          rows={6}
          value={values.abstract}
          onChange={update('abstract')}
          maxLength={5000}
          placeholder="Summarize the problem, your approach, and the expected results."
        />
      </div>
      <div className="field">
        <label htmlFor="thesis-keywords">Keywords</label>
        <input
          id="thesis-keywords"
          className="input"
          value={values.keywords}
          onChange={update('keywords')}
          maxLength={300}
          placeholder="machine learning, agriculture, computer vision"
        />
        <span className="field-hint">Separate keywords with commas.</span>
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
