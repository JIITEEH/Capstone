import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Bell } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { api } from '../../api-client/api.js';
import { parseDate, plural } from '../../helpers/format.js';
import ReminderList from '../dashboard/ReminderCard.jsx';
import { Spinner } from '../basics/Feedback.jsx';

const SOON_MS = 24 * 60 * 60 * 1000;
const REFRESH_MS = 60 * 1000;
const MAX_SHOWN = 5;

const EMPTY_TEXT = {
  student: 'No upcoming meetings. Your adviser will schedule consultations here.',
  adviser: 'Nothing scheduled. Plan a consultation from the Schedule page.',
  admin: 'Nothing scheduled. Set up defenses from the Schedule page.',
};

// Bell button with a popover of upcoming consultations and defenses.
// The badge counts events starting within the next 24 hours.
export default function Notifications() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      setEvents(await api.listSchedules({ range: 'upcoming' }));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  // Keep the badge current in the background
  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') load();
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    load();

    const onPointerDown = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, load]);

  const soonCount = (events ?? []).filter((event) => parseDate(event.starts_at).getTime() - Date.now() < SOON_MS).length;
  const buttonLabel = soonCount ? `Reminders, ${plural(soonCount, 'event')} within 24 hours` : 'Reminders';

  return (
    <div className="notif" ref={ref}>
      <button
        type="button"
        className="round-btn"
        aria-label={buttonLabel}
        title={buttonLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={21} />
        {soonCount > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {soonCount}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Reminders">
          <div className="notif-head">
            <h3>Reminders</h3>
            {events?.length > 0 && <span className="notif-count">{plural(events.length, 'upcoming event')}</span>}
          </div>
          {error && !events ? (
            <p className="form-error">{error}</p>
          ) : events ? (
            <>
              <ReminderList
                events={events.slice(0, MAX_SHOWN)}
                emptyText={EMPTY_TEXT[user.role]}
                showStudent={user.role !== 'student'}
              />
              {events.length > 0 && (
                <Link to="/schedule" className="notif-footer">
                  {events.length > MAX_SHOWN ? `View all ${events.length} events` : 'View full schedule'}
                </Link>
              )}
            </>
          ) : (
            <div className="notif-loading">
              <Spinner />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
