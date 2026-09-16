import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarRange, Pencil, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../ui-pieces/basics/Badge.jsx';
import { EmptyState, LoadState } from '../../ui-pieces/basics/Feedback.jsx';
import Modal, { ConfirmDialog } from '../../ui-pieces/basics/Modal.jsx';
import PageHeader from '../../ui-pieces/basics/PageHeader.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import useApi from '../../reusable-logic/useApi.js';
import { api } from '../../api-client/api.js';
import { STAGES } from '../../helpers/constants.js';
import { formatDay } from '../../helpers/format.js';

function TermForm({ term, onSaved, onCancel }) {
  const editing = Boolean(term);
  const [values, setValues] = useState({
    name: term?.name ?? '',
    startsOn: term?.starts_on ?? '',
    endsOn: term?.ends_on ?? '',
    deadlines: Object.fromEntries(STAGES.map((stage) => [stage.key, term?.deadlines[stage.key] ?? ''])),
    isCurrent: term ? Boolean(term.is_current) : false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (event) => {
    const value = event.target.type === 'checkbox' ? event.target.checked : event.target.value;
    setValues((prev) => ({ ...prev, [field]: value }));
  };
  const updateDeadline = (stage) => (event) =>
    setValues((prev) => ({ ...prev, deadlines: { ...prev.deadlines, [stage]: event.target.value } }));

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (editing) await api.updateTerm(term.id, values);
      else await api.createTerm(values);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="term-name">Name</label>
        <input
          id="term-name"
          className="input"
          value={values.name}
          onChange={update('name')}
          placeholder="1st Semester 2026–2027"
          autoFocus
        />
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="term-starts">Starts</label>
          <input id="term-starts" type="date" className="input" value={values.startsOn} onChange={update('startsOn')} />
        </div>
        <div className="field">
          <label htmlFor="term-ends">Ends</label>
          <input id="term-ends" type="date" className="input" value={values.endsOn} onChange={update('endsOn')} />
        </div>
      </div>

      <fieldset className="term-deadlines">
        <legend className="person-label">Due dates</legend>
        <span className="field-hint">A stage is due by the end of the day. Leave a date empty if that stage has no deadline.</span>
        <div className="form-row">
          {STAGES.map((stage) => (
            <div key={stage.key} className="field">
              <label htmlFor={`term-due-${stage.key}`}>{stage.label}</label>
              <input
                id={`term-due-${stage.key}`}
                type="date"
                className="input"
                value={values.deadlines[stage.key]}
                onChange={updateDeadline(stage.key)}
              />
            </div>
          ))}
        </div>
      </fieldset>

      {!term?.is_current && (
        <label className="checkbox">
          <input type="checkbox" checked={values.isCurrent} onChange={update('isCurrent')} />
          <span>
            <strong>Make this the current term</strong>
            <span className="muted"> · New theses join the current term</span>
          </span>
        </label>
      )}

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Create term'}
        </button>
      </div>
    </form>
  );
}

// Academic terms and each stage's due date. Theses join the current term when they're created.
export default function Terms() {
  const toast = useToast();
  const { data: terms, loading, error, reload } = useApi(() => api.listTerms(), []);
  const [editing, setEditing] = useState(null); // 'new', or the term being edited
  const [deleting, setDeleting] = useState(null);
  const [deleteState, setDeleteState] = useState({ busy: false, error: '' });

  async function confirmDelete() {
    setDeleteState({ busy: true, error: '' });
    try {
      await api.deleteTerm(deleting.id);
      toast.success(`${deleting.name} deleted`);
      setDeleting(null);
      await reload();
    } catch (err) {
      setDeleteState({ busy: false, error: err.message });
    }
  }

  return (
    <>
      <PageHeader
        title="Terms"
        subtitle="Set each semester's stage due dates. Theses join the current term when they're created."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
            <Plus size={16} />
            Add term
          </button>
        }
      />

      <section className="card card-flush">
        {!terms ? (
          <div className="card-pad">
            <LoadState loading={loading} error={error} onRetry={reload} />
          </div>
        ) : terms.length === 0 ? (
          <EmptyState
            icon={CalendarRange}
            title="No terms yet"
            message="Add the current semester and its due dates. Until then, theses have no deadlines."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Term</th>
                  {STAGES.map((stage) => (
                    <th key={stage.key} className="hide-tablet">
                      {stage.label}
                    </th>
                  ))}
                  <th>Theses</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {terms.map((term) => (
                  <tr key={term.id}>
                    <td data-label="Term">
                      <strong>{term.name}</strong> {Boolean(term.is_current) && <Badge tone="primary">Current</Badge>}
                      <span className="cell-sub">
                        {formatDay(term.starts_on)} – {formatDay(term.ends_on)}
                      </span>
                    </td>
                    {STAGES.map((stage) => (
                      <td key={stage.key} className="hide-tablet nowrap" data-label={stage.label}>
                        {term.deadlines[stage.key] ? formatDay(term.deadlines[stage.key]) : <span className="muted">—</span>}
                      </td>
                    ))}
                    <td data-label="Theses">
                      <Link to={`/theses?term=${term.id}`} className="nowrap">{term.thesis_count === 1 ? '1 thesis' : `${term.thesis_count} theses`}</Link>
                    </td>
                    <td className="cell-actions">
                      <div className="row-actions">
                        <button type="button" className="icon-btn" onClick={() => setEditing(term)} aria-label={`Edit ${term.name}`}>
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn-danger"
                          onClick={() => {
                            setDeleteState({ busy: false, error: '' });
                            setDeleting(term);
                          }}
                          aria-label={`Delete ${term.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal
        open={Boolean(editing)}
        title={editing === 'new' ? 'Add term' : 'Edit term'}
        description={editing === 'new' ? 'The first term you add becomes the current one.' : undefined}
        onClose={() => setEditing(null)}
        size="lg"
      >
        {editing && (
          <TermForm
            key={editing === 'new' ? 'new' : editing.id}
            term={editing === 'new' ? null : editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              toast.success(editing === 'new' ? 'Term created' : 'Term updated');
              setEditing(null);
              await reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Delete ${deleting?.name}?`}
        message="This removes the term and its due dates. A term that still has theses can't be deleted."
        confirmLabel="Delete term"
        busy={deleteState.busy}
        error={deleteState.error}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
