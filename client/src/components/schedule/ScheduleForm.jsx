import { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import useApi from '../../hooks/useApi.js';
import { api } from '../../services/api.js';
import { DURATIONS, MEETING_MODES, SCHEDULE_TYPES } from '../../utils/constants.js';
import { formatDuration, toLocalInputValue } from '../../utils/format.js';

// Creates or edits a consultation or defense.
// Pass `event` to edit, or `thesis` to schedule for a specific thesis.
export default function ScheduleForm({ event, thesis: fixedThesis, onSaved, onCancel }) {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const editing = Boolean(event);
  const needsThesisPicker = !editing && !fixedThesis;

  const { data: theses } = useApi(() => (needsThesisPicker ? api.listTheses() : Promise.resolve([])), [needsThesisPicker]);
  const { data: advisers } = useApi(() => (isAdmin ? api.listAdvisers() : Promise.resolve([])), [isAdmin]);

  const [values, setValues] = useState({
    thesisId: '',
    type: event?.type ?? 'consultation',
    title: event?.title ?? '',
    startsAt: event ? toLocalInputValue(event.starts_at) : '',
    durationMinutes: event?.duration_minutes ?? 60,
    mode: event?.mode ?? 'in_person',
    location: event?.location ?? '',
    notes: event?.notes ?? '',
    panelistIds: event?.panelists.map((panelist) => panelist.id) ?? [],
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const update = (field) => (e) => setValues((prev) => ({ ...prev, [field]: e.target.value }));

  // Theses need an adviser before anything can be scheduled
  const schedulableTheses = (theses ?? []).filter((thesis) => thesis.adviser_id);
  const selectedThesis = editing
    ? { id: event.thesis_id, adviser_id: event.adviser_id }
    : (fixedThesis ?? schedulableTheses.find((thesis) => String(thesis.id) === String(values.thesisId)));
  const showPanel = isAdmin && values.type !== 'consultation';
  const panelOptions = (advisers ?? []).filter((adviser) => adviser.id !== selectedThesis?.adviser_id);

  function togglePanelist(id) {
    setValues((prev) => ({
      ...prev,
      panelistIds: prev.panelistIds.includes(id)
        ? prev.panelistIds.filter((existing) => existing !== id)
        : [...prev.panelistIds, id],
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedThesis) return setError('Choose a thesis');
    if (!values.startsAt) return setError('Choose a date and time');

    const payload = {
      title: values.title.trim() || SCHEDULE_TYPES[values.type].label,
      startsAt: new Date(values.startsAt).toISOString(),
      durationMinutes: Number(values.durationMinutes),
      mode: values.mode,
      location: values.location,
      notes: values.notes,
    };
    if (!editing) Object.assign(payload, { thesisId: selectedThesis.id, type: values.type });
    if (showPanel) payload.panelistIds = values.panelistIds;

    setBusy(true);
    setError('');
    try {
      if (editing) await api.updateSchedule(event.id, payload);
      else await api.createSchedule(payload);
      await onSaved();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {needsThesisPicker && (
        <div className="field">
          <label htmlFor="event-thesis">Thesis</label>
          <select id="event-thesis" className="input" value={values.thesisId} onChange={update('thesisId')}>
            <option value="">{theses ? 'Choose a thesis' : 'Loading…'}</option>
            {schedulableTheses.map((thesis) => (
              <option key={thesis.id} value={thesis.id}>
                {thesis.student_name} · {thesis.title}
              </option>
            ))}
          </select>
          {theses && schedulableTheses.length < theses.length && (
            <span className="field-hint">Theses without an adviser can't be scheduled yet.</span>
          )}
        </div>
      )}

      <div className="form-row">
        <div className="field">
          <label htmlFor="event-type">Type</label>
          {isAdmin && !editing ? (
            <select id="event-type" className="input" value={values.type} onChange={update('type')}>
              {Object.entries(SCHEDULE_TYPES).map(([key, info]) => (
                <option key={key} value={key}>
                  {info.label}
                </option>
              ))}
            </select>
          ) : (
            <input id="event-type" className="input" value={SCHEDULE_TYPES[values.type].label} disabled />
          )}
          {!isAdmin && !editing && <span className="field-hint">Defenses are scheduled by an administrator.</span>}
        </div>
        <div className="field">
          <label htmlFor="event-title">Title</label>
          <input
            id="event-title"
            className="input"
            value={values.title}
            onChange={update('title')}
            maxLength={150}
            placeholder={SCHEDULE_TYPES[values.type].label}
          />
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="event-start">Date and time</label>
          <input
            id="event-start"
            type="datetime-local"
            className="input"
            value={values.startsAt}
            min={editing ? undefined : toLocalInputValue(new Date().toISOString())}
            onChange={update('startsAt')}
          />
        </div>
        <div className="field">
          <label htmlFor="event-duration">Duration</label>
          <select id="event-duration" className="input" value={values.durationMinutes} onChange={update('durationMinutes')}>
            {DURATIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {formatDuration(minutes)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="form-row">
        <div className="field">
          <label htmlFor="event-mode">Meeting mode</label>
          <select id="event-mode" className="input" value={values.mode} onChange={update('mode')}>
            {Object.entries(MEETING_MODES).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="event-location">{values.mode === 'online' ? 'Meeting link' : 'Room or venue'}</label>
          <input
            id="event-location"
            className="input"
            value={values.location}
            onChange={update('location')}
            maxLength={300}
            placeholder={values.mode === 'online' ? 'https://meet.google.com/…' : 'CS Faculty Room 204'}
          />
        </div>
      </div>

      {showPanel && (
        <fieldset className="field panel-picker">
          <legend className="label">Panel members</legend>
          {!advisers ? (
            <span className="field-hint">Loading advisers…</span>
          ) : panelOptions.length ? (
            <div className="checkbox-grid">
              {panelOptions.map((adviser) => (
                <label key={adviser.id} className="checkbox">
                  <input
                    type="checkbox"
                    checked={values.panelistIds.includes(adviser.id)}
                    onChange={() => togglePanelist(adviser.id)}
                  />
                  <span>{adviser.name}</span>
                </label>
              ))}
            </div>
          ) : (
            <span className="field-hint">No other advisers are available.</span>
          )}
          <span className="field-hint">The student's adviser attends automatically.</span>
        </fieldset>
      )}

      <div className="field">
        <label htmlFor="event-notes">Notes (optional)</label>
        <textarea
          id="event-notes"
          className="input"
          rows={3}
          maxLength={2000}
          value={values.notes}
          onChange={update('notes')}
          placeholder="Agenda, what to prepare, or other details"
        />
      </div>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? 'Saving…' : editing ? 'Save changes' : 'Schedule event'}
        </button>
      </div>
    </form>
  );
}
