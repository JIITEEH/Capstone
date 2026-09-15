import { Link } from 'react-router';
import { CalendarDays } from 'lucide-react';
import { SCHEDULE_TYPES } from '../../utils/constants.js';
import { formatDate, formatTime, timeUntil } from '../../utils/format.js';

export default function WelcomeBanner({ eyebrow, title, subtitle, children, aside }) {
  return (
    <section className="welcome">
      <div className="welcome-glow welcome-glow-1" aria-hidden="true" />
      <div className="welcome-glow welcome-glow-2" aria-hidden="true" />
      <div className="welcome-body">
        {eyebrow && <span className="welcome-eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
        {children && <div className="welcome-actions">{children}</div>}
      </div>
      {aside && <div className="welcome-aside">{aside}</div>}
    </section>
  );
}

export function NextEventCard({ event, emptyText = 'Nothing scheduled yet' }) {
  if (!event) {
    return (
      <Link to="/schedule" className="next-event next-event-empty">
        <CalendarDays size={20} />
        <span>{emptyText}</span>
      </Link>
    );
  }

  return (
    <Link to="/schedule" className="next-event">
      <span className="next-event-label">
        <span className="live-dot" aria-hidden="true" />
        Up next · {timeUntil(event.starts_at)}
      </span>
      <strong className="clamp-2">{event.title}</strong>
      <span>
        {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
      </span>
      <span className="clamp-1">
        {SCHEDULE_TYPES[event.type].label} · {event.student_name}
      </span>
    </Link>
  );
}
