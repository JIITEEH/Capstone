import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ChevronLeft, Gavel, Printer } from 'lucide-react';
import { Badge, ScheduleTypeBadge } from '../ui-pieces/basics/Badge.jsx';
import { Alert, LoadState } from '../ui-pieces/basics/Feedback.jsx';
import { ConfirmDialog } from '../ui-pieces/basics/Modal.jsx';
import PageHeader from '../ui-pieces/basics/PageHeader.jsx';
import { useAuth } from '../shared-state/AuthContext.jsx';
import { useToast } from '../shared-state/ToastContext.jsx';
import useApi from '../reusable-logic/useApi.js';
import { api } from '../api-client/api.js';
import { MEETING_MODES } from '../helpers/constants.js';
import { formatDate, formatDateTime, formatTime } from '../helpers/format.js';

const SCALE = [1, 2, 3, 4, 5];
const SCALE_WORDS = { 1: 'Poor', 2: 'Fair', 3: 'Good', 4: 'Very good', 5: 'Excellent' };
const VERDICT_TONES = { passed: 'success', passed_with_revisions: 'warning', failed: 'danger' };
// Short column headings for the scores table; the full criterion name labels each cell
const SHORT = { content: 'Content', methodology: 'Methods', presentation: 'Presentation', answers: 'Q&A' };

function average(evaluation, keys) {
  return Math.round((keys.reduce((sum, key) => sum + evaluation[key], 0) / keys.length) * 100) / 100;
}

function VerdictBanner({ verdict, verdicts, summary }) {
  const tone = VERDICT_TONES[verdict.verdict];
  return (
    <section className={`card verdict-banner verdict-${tone}`}>
      <div className="verdict-banner-head">
        <span className={`review-result-icon tone-${tone}`}>
          <Gavel size={20} />
        </span>
        <div>
          <span className="person-label">Verdict</span>
          <strong className="verdict-label">{verdicts[verdict.verdict]}</strong>
        </div>
        {summary && (
          <div className="verdict-score">
            <span className="person-label">Panel average</span>
            <strong>{summary.overall.toFixed(2)}</strong>
            <span className="muted">out of 5</span>
          </div>
        )}
      </div>
      {verdict.notes && <p className="prose">{verdict.notes}</p>}
      <p className="muted small">
        Recorded by {verdict.recorded_by_name} · {formatDateTime(verdict.recorded_at)}
      </p>
    </section>
  );
}

function EvaluationForm({ defenseId, criteria, initial, onSaved }) {
  const keys = Object.keys(criteria);
  const [scores, setScores] = useState(() => Object.fromEntries(keys.map((key) => [key, initial?.[key] ?? 0])));
  const [remarks, setRemarks] = useState(initial?.remarks ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const complete = keys.every((key) => scores[key] >= 1);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api.saveDefenseEvaluation(defenseId, { scores, remarks });
      await onSaved(Boolean(initial));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>{initial ? 'Your scores' : 'Score this defense'}</h2>
        {initial && <Badge tone="success">Saved</Badge>}
      </div>
      <p className="muted card-intro">
        1 is poor and 5 is excellent. Other panelists can&apos;t see your scores until the verdict is recorded, and you
        can change them until then.
      </p>

      <form className="form rubric" onSubmit={handleSubmit}>
        {keys.map((key) => (
          <fieldset key={key} className="rubric-row">
            <legend>{criteria[key]}</legend>
            <div className="rubric-scale">
              {SCALE.map((value) => (
                <label key={value} className={`rubric-option${scores[key] === value ? ' selected' : ''}`}>
                  <input
                    type="radio"
                    className="rubric-input"
                    name={`score-${key}`}
                    value={value}
                    checked={scores[key] === value}
                    onChange={() => setScores((prev) => ({ ...prev, [key]: value }))}
                  />
                  <span className="rubric-number">{value}</span>
                  <span className="rubric-word">{SCALE_WORDS[value]}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}

        <div className="field">
          <label htmlFor="defense-remarks">Remarks for the group</label>
          <textarea
            id="defense-remarks"
            className="input"
            rows={4}
            maxLength={3000}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="What went well, and what should they revise?"
          />
        </div>

        {error && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={busy || !complete}>
            {busy ? 'Saving…' : initial ? 'Update scores' : 'Save scores'}
          </button>
        </div>
        {!complete && <p className="field-hint">Score all four criteria to save.</p>}
      </form>
    </section>
  );
}

function VerdictForm({ defenseId, verdicts, submittedCount, panelSize, onRecorded }) {
  const [verdict, setVerdict] = useState('');
  const [notes, setNotes] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needsNotes = Boolean(verdict) && verdict !== 'passed';
  const ready = Boolean(verdict) && (!needsNotes || notes.trim());

  async function record() {
    setBusy(true);
    setError('');
    try {
      await api.recordDefenseVerdict(defenseId, { verdict, notes });
      setConfirming(false);
      await onRecorded();
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Record the verdict</h2>
      </div>
      <p className="muted card-intro">
        {submittedCount} of {panelSize} panelists have submitted scores. Recording the verdict completes the defense,
        tells the group, and locks the scores.
      </p>

      <div className="form">
        <fieldset className="verdict-choices">
          <legend className="sr-only">Verdict</legend>
          {Object.entries(verdicts).map(([value, label]) => (
            <label key={value} className={`verdict-choice${verdict === value ? ' selected' : ''}`}>
              <input type="radio" name="verdict" value={value} checked={verdict === value} onChange={() => setVerdict(value)} />
              <Badge tone={VERDICT_TONES[value]}>{label}</Badge>
            </label>
          ))}
        </fieldset>

        <div className="field">
          <label htmlFor="verdict-notes">
            {needsNotes ? 'Explanation for the group (required)' : 'Notes for the group (optional)'}
          </label>
          <textarea
            id="verdict-notes"
            className="input"
            rows={3}
            maxLength={3000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={needsNotes ? 'What must they revise, and by when?' : ''}
          />
        </div>

        {error && !confirming && <p className="form-error">{error}</p>}
        <div className="form-actions">
          <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => setConfirming(true)}>
            Record verdict
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirming}
        title={`Record "${verdicts[verdict] ?? ''}"?`}
        message="The group and panel will be told, and the verdict and scores can't be changed afterwards."
        confirmLabel="Record verdict"
        cancelLabel="Go back"
        busy={busy}
        error={error}
        onConfirm={record}
        onClose={() => setConfirming(false)}
      />
    </section>
  );
}

function ScoresCard({ criteria, evaluations, summary }) {
  const keys = Object.keys(criteria);
  return (
    <section className="card card-flush">
      <div className="card-header card-pad">
        <h2>Panel scores</h2>
        <span className="muted">
          {summary.count} {summary.count === 1 ? 'panelist' : 'panelists'}
        </span>
      </div>
      <div className="table-wrap">
        <table className="table scores-table">
          <thead>
            <tr>
              <th>Panelist</th>
              {keys.map((key) => (
                <th key={key} title={criteria[key]}>
                  {SHORT[key] ?? criteria[key]}
                </th>
              ))}
              <th>Average</th>
            </tr>
          </thead>
          <tbody>
            {evaluations.map((e) => (
              <tr key={e.id}>
                <td data-label="Panelist">
                  <strong>{e.panelist_name}</strong>
                </td>
                {keys.map((key) => (
                  <td key={key} data-label={criteria[key]}>
                    {e[key]}
                  </td>
                ))}
                <td data-label="Average">{average(e, keys).toFixed(2)}</td>
              </tr>
            ))}
            <tr className="scores-total">
              <td data-label="Panelist">
                <strong>Panel average</strong>
              </td>
              {keys.map((key) => (
                <td key={key} data-label={criteria[key]}>
                  <strong>{summary.averages[key].toFixed(2)}</strong>
                </td>
              ))}
              <td data-label="Average">
                <strong>{summary.overall.toFixed(2)}</strong>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {evaluations.some((e) => e.remarks) && (
        <div className="card-pad">
          <h3 className="remarks-title">Remarks</h3>
          <ul className="remarks-list">
            {evaluations
              .filter((e) => e.remarks)
              .map((e) => (
                <li key={e.id}>
                  <strong>{e.panelist_name}</strong>
                  <p className="prose">{e.remarks}</p>
                </li>
              ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export default function DefenseDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useApi(() => api.getDefense(id), [id]);

  if (!data) return <LoadState loading={loading} error={error} onRetry={reload} />;
  const {
    defense,
    criteria,
    verdicts,
    started,
    isPanelist,
    myEvaluation,
    evaluations,
    summary,
    panelSize,
    submittedCount,
    verdict,
    canEvaluate,
    canRecordVerdict,
  } = data;
  const isAdmin = user.role === 'admin';
  const cancelled = defense.status === 'cancelled';

  return (
    <>
      <p className="print-only print-heading">
        ThesisTrack · Defense result · printed {formatDate(new Date().toISOString())}
      </p>

      <PageHeader
        eyebrow={
          <Link to="/schedule" className="back-link no-print">
            <ChevronLeft size={16} />
            Schedule
          </Link>
        }
        title={defense.title}
        subtitle={
          <span className="header-meta">
            <ScheduleTypeBadge type={defense.type} />
            <span>
              {formatDate(defense.starts_at)} · {formatTime(defense.starts_at)}
            </span>
            <span className="clamp-1">{defense.thesis_title}</span>
          </span>
        }
        actions={
          verdict && (
            <button type="button" className="btn btn-secondary no-print" onClick={() => window.print()}>
              <Printer size={16} />
              Print result sheet
            </button>
          )
        }
      />

      <div className="detail-layout">
        <div className="stack stagger">
          {verdict && <VerdictBanner verdict={verdict} verdicts={verdicts} summary={summary} />}

          {cancelled && <Alert tone="warning" title="This defense was cancelled" />}

          {!cancelled && !started && !verdict && (
            <Alert tone="info" title="This defense hasn't started yet">
              {isPanelist
                ? `You can enter scores from ${formatDateTime(defense.starts_at)}.`
                : `Scores and the verdict will be recorded here after ${formatDateTime(defense.starts_at)}.`}
            </Alert>
          )}

          {canEvaluate && (
            <EvaluationForm
              key={myEvaluation?.updated_at ?? 'new'}
              defenseId={defense.id}
              criteria={criteria}
              initial={myEvaluation}
              onSaved={async (updated) => {
                toast.success(updated ? 'Scores updated' : 'Scores saved');
                await reload();
              }}
            />
          )}

          {canRecordVerdict && (
            <VerdictForm
              defenseId={defense.id}
              verdicts={verdicts}
              submittedCount={submittedCount}
              panelSize={panelSize}
              onRecorded={async () => {
                toast.success('Verdict recorded');
                await reload();
              }}
            />
          )}

          {isAdmin && started && !verdict && !cancelled && submittedCount === 0 && (
            <Alert tone="info" title="Waiting for the panel">
              No panelist has submitted scores yet (0 of {panelSize}). The verdict can be recorded once at least one has.
            </Alert>
          )}

          {!isAdmin && !isPanelist && started && !verdict && !cancelled && (
            <Alert tone="info" title="The result isn't in yet">
              The verdict, scores, and the panel&apos;s remarks will appear here once the verdict is recorded.
            </Alert>
          )}

          {summary && evaluations.length > 0 && <ScoresCard criteria={criteria} evaluations={evaluations} summary={summary} />}
        </div>

        <aside className="stack stagger">
          <section className="card">
            <div className="card-header">
              <h2>Details</h2>
            </div>
            <dl className="details">
              <div>
                <dt>Thesis</dt>
                <dd>{defense.thesis_title}</dd>
              </div>
              <div>
                <dt>Students</dt>
                <dd>{defense.student_name}</dd>
              </div>
              <div>
                <dt>Adviser</dt>
                <dd>{defense.adviser_name ?? 'Not assigned'}</dd>
              </div>
              <div>
                <dt>Panel</dt>
                <dd>{defense.panelists.length ? defense.panelists.map((p) => p.name).join(', ') : 'No panelists assigned'}</dd>
              </div>
              <div>
                <dt>When</dt>
                <dd>
                  {formatDate(defense.starts_at)}, {formatTime(defense.starts_at)}–{formatTime(defense.ends_at)}
                </dd>
              </div>
              <div>
                <dt>Where</dt>
                <dd>{defense.location || MEETING_MODES[defense.mode]}</dd>
              </div>
              {submittedCount !== null && !verdict && (
                <div>
                  <dt>Scores in</dt>
                  <dd>
                    {submittedCount} of {panelSize}
                  </dd>
                </div>
              )}
            </dl>
          </section>
        </aside>
      </div>
    </>
  );
}
