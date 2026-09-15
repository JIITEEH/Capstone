import { Link } from 'react-router';
import { CalendarDays, Clock, MapPin, Video } from 'lucide-react';
import { SCHEDULE_TYPES } from '../../utils/constants.js';
import { formatDate, formatTime, timeUntil } from '../../utils/format.js';

function meetingLinkFor(event) {
  return /^https?:\/\//i.test(event.location ?? '') ? event.location : null;
}

// Upcoming consultations and defenses, soonest first.
// The next event gets the full reminder with a join or details button; later ones are compact rows.
export default function ReminderList({ events, emptyText = 'Nothing scheduled yet.', showStudent = true }) {
  if (!events.length) {
    return (
      <div className="reminder-empty-state">
        <p className="reminder-empty">{emptyText}</p>
        <Link to="/schedule" className="btn btn-primary reminder-btn">
          <CalendarDays size={18} />
          Open Schedule
        </Link>
      </div>
    );
  }

  const [next, ...later] = events;
  const meetingLink = meetingLinkFor(next);

  return (
    <div className="reminders">
      <div className="reminder-next">
        <span className="reminder-when">{timeUntil(next.starts_at)}</span>
        <strong className="reminder-title clamp-2">{next.title}</strong>
        <span className="reminder-time">
          {SCHEDULE_TYPES[next.type].label}
          {showStudent && ` · ${next.student_name}`}
        </span>
        <span className="reminder-time">
          <Clock size={14} />
          {formatDate(next.starts_at)} · {formatTime(next.starts_at)} - {formatTime(next.ends_at)}
        </span>
        {!meetingLink && next.location && (
          <span className="reminder-time">
            <MapPin size={14} />
            {next.location}
          </span>
        )}
        {meetingLink ? (
          <a href={meetingLink} target="_blank" rel="noreferrer" className="btn btn-primary reminder-btn">
            <Video size={18} fill="currentColor" />
            Start Meeting
          </a>
        ) : (
          <Link to="/schedule" className="btn btn-primary reminder-btn">
            <CalendarDays size={18} />
            View Details
          </Link>
        )}
      </div>

      {later.length > 0 && (
        <ul className="reminder-later">
          {later.map((event) => (
            <li key={event.id}>
              <Link to="/schedule" className="reminder-row">
                <span className="reminder-row-main">
                  <strong className="clamp-1">{event.title}</strong>
                  <span className="muted">
                    <Clock size={12} />
                    {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
                  </span>
                </span>
                <span className="reminder-row-when">{timeUntil(event.starts_at)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
