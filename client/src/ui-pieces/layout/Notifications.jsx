import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Bell } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { api } from '../../api-client/api.js';
import { plural, timeAgo } from '../../helpers/format.js';
import ReminderList from '../dashboard/ReminderCard.jsx';
import { Spinner } from '../basics/Feedback.jsx';

const REFRESH_MS = 60 * 1000;
const UPCOMING_SHOWN = 3;

const EMPTY_UPCOMING = {
  student: 'No upcoming meetings.',
  adviser: 'Nothing scheduled.',
  admin: 'Nothing scheduled.',
};

// Bell button with a popover. The badge counts unread notifications: reviews, comments, new
// submissions, adviser assignments, and scheduled events. Upcoming events are listed beneath.
export default function Notifications() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [feed, setFeed] = useState(null);
  const [events, setEvents] = useState(null);
  const [error, setError] = useState('');
  const ref = useRef(null);

  const load = useCallback(async () => {
    try {
      const [notifications, upcoming] = await Promise.all([
        api.listNotifications(),
        api.listSchedules({ range: 'upcoming' }),
      ]);
      setFeed(notifications);
      setEvents(upcoming);
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

  // Marks it read as you follow it, so opening the thing is enough to dismiss it
  function follow(notification) {
    if (notification.read_at) return;
    setFeed((prev) => ({
      unread: Math.max(0, prev.unread - 1),
      notifications: prev.notifications.map((n) => (n.id === notification.id ? { ...n, read_at: 'now' } : n)),
    }));
    api.markNotificationRead(notification.id).catch(() => load());
  }

  async function markAllRead() {
    setFeed((prev) => ({ unread: 0, notifications: prev.notifications.map((n) => ({ ...n, read_at: n.read_at ?? 'now' })) }));
    try {
      await api.markAllNotificationsRead();
    } catch {
      load();
    }
  }

  const unread = feed?.unread ?? 0;
  const buttonLabel = unread ? `Notifications, ${plural(unread, 'unread')}` : 'Notifications';

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
        {unread > 0 && (
          <span className="notif-badge" aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="Notifications">
          <div className="notif-head">
            <h2>Notifications</h2>
            {unread > 0 && (
              <button type="button" className="notif-mark-all" onClick={markAllRead}>
                Mark all as read
              </button>
            )}
          </div>

          {error && !feed ? (
            <p className="form-error">{error}</p>
          ) : !feed ? (
            <div className="notif-loading">
              <Spinner />
            </div>
          ) : (
            <>
              {feed.notifications.length === 0 ? (
                <p className="notif-empty">You're all caught up.</p>
              ) : (
                <ul className="notif-list">
                  {feed.notifications.map((n) => (
                    <li key={n.id} className={`notif-item${n.read_at ? '' : ' unread'}`}>
                      <Link to={n.link || '/'} onClick={() => follow(n)}>
                        <span className="notif-dot" aria-hidden="true" />
                        <span className="notif-item-title">
                          {!n.read_at && <span className="sr-only">Unread: </span>}
                          {n.title}
                        </span>
                        {n.body && <span className="notif-item-body">{n.body}</span>}
                        <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="notif-section">
                <h3 className="notif-section-title">Coming up</h3>
                <ReminderList
                  events={(events ?? []).slice(0, UPCOMING_SHOWN)}
                  emptyText={EMPTY_UPCOMING[user.role]}
                  showStudent={user.role !== 'student'}
                />
                <Link to="/schedule" className="notif-footer">
                  {events?.length > UPCOMING_SHOWN ? `View all ${events.length} events` : 'View full schedule'}
                </Link>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
