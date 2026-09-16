import { useId } from 'react';

// Upper half of a circle centred at (150, 152)
const ARC = 'M 38 152 A 112 112 0 0 1 262 152';

// Groups thesis status counts into the gauge's three segments
export function groupStatuses(counts) {
  return {
    done: counts.completed ?? 0,
    active: (counts.in_progress ?? 0) + (counts.under_review ?? 0) + (counts.revisions_required ?? 0),
    pending: counts.draft ?? 0,
  };
}

export default function ProgressGauge({ title, done, active, pending, caption, labels = ['Completed', 'In Progress', 'Pending'] }) {
  const patternId = `gauge-stripes-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const total = done + active + pending;
  const doneEnd = total ? (done / total) * 100 : 0;
  const activeEnd = total ? ((done + active) / total) * 100 : 0;
  const percent = Math.round(doneEnd);
  const [doneLabel, activeLabel, pendingLabel] = labels;

  return (
    <section className="dash-card gauge">
      <div className="dash-card-head">
        <h3>{title}</h3>
      </div>
      <div
        className="gauge-figure"
        role="img"
        aria-label={`${percent}% ${caption.toLowerCase()}. ${doneLabel}: ${done}, ${activeLabel}: ${active}, ${pendingLabel}: ${pending}`}
      >
        <svg viewBox="0 0 300 176" aria-hidden="true">
          <defs>
            <pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <rect width="7" height="7" fill="#fff" />
              <rect width="2.4" height="7" fill="#7a849c" />
            </pattern>
          </defs>
          <path d={ARC} className="gauge-track" stroke={`url(#${patternId})`} />
          {activeEnd > 0 && (
            <path d={ARC} pathLength="100" className="gauge-seg gauge-active" strokeDasharray={`${activeEnd} 100`} />
          )}
          {doneEnd > 0 && <path d={ARC} pathLength="100" className="gauge-seg gauge-done" strokeDasharray={`${doneEnd} 100`} />}
        </svg>
        <div className="gauge-center">
          <strong>{percent}%</strong>
          <span>{caption}</span>
        </div>
      </div>
      <ul className="gauge-legend">
        <li>
          <span className="legend-dot legend-done" aria-hidden="true" />
          {doneLabel}
        </li>
        <li>
          <span className="legend-dot legend-active" aria-hidden="true" />
          {activeLabel}
        </li>
        <li>
          <span className="legend-dot legend-pending" aria-hidden="true" />
          {pendingLabel}
        </li>
      </ul>
    </section>
  );
}
