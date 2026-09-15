import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ArrowUpRight, ChevronUp } from 'lucide-react';

// Counts up from the previously shown value to `value`
function CountUp({ value, duration = 800 }) {
  const [shown, setShown] = useState(0);
  const current = useRef(0);

  useEffect(() => {
    const from = current.current;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion || from === value) {
      current.current = value;
      setShown(value);
      return undefined;
    }

    let frame;
    const start = performance.now();
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Math.round(from + (value - from) * eased);
      current.current = next;
      setShown(next);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

// `chip` is a small figure shown before the note; `trend` marks it as an increase
export default function StatCard({ label, value, suffix, to, chip, trend = false, note, featured = false }) {
  return (
    <div className={`kpi${featured ? ' kpi-featured' : ''}`}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        {to && (
          <Link to={to} className="kpi-arrow" aria-label={`Open ${label.toLowerCase()}`}>
            <ArrowUpRight size={20} />
          </Link>
        )}
      </div>
      <div className="kpi-value">
        {typeof value === 'number' ? <CountUp value={value} /> : value}
        {suffix && <span className="kpi-suffix">{suffix}</span>}
      </div>
      {note && (
        <div className="kpi-note">
          {chip != null && (
            <span className="kpi-chip">
              {chip}
              {trend && <ChevronUp size={10} strokeWidth={3} />}
            </span>
          )}
          <span className="kpi-note-text">{note}</span>
        </div>
      )}
    </div>
  );
}
