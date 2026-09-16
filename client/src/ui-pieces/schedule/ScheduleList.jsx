import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, CalendarX2, Check, Clock, MapPin, Pencil, Trash2, Users, Video } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { useToast } from '../../shared-state/ToastContext.jsx';
import { api } from '../../api-client/api.js';
import { MEETING_MODES } from '../../helpers/constants.js';
import { dayParts, formatDate, formatTime, parseDate, timeUntil } from '../../helpers/format.js';
import { Badge, ScheduleStatusBadge, ScheduleTypeBadge } from '../basics/Badge.jsx';
import { EmptyState } from '../basics/Feedback.jsx';
import Modal, { ConfirmDialog } from '../basics/Modal.jsx';
import ScheduleForm from './ScheduleForm.jsx';

function EventLocation({ event }) {
  const Icon = event.mode === 'online' ? Video : MapPin;
  const isLink = /^https?:\/\//i.test(event.location);
  return (
    <span className="event-meta-item">
      <Icon size={14} />
      {isLink ? (
        <a href={event.location} target="_blank" rel="noreferrer">
          Join meeting
        </a>
      ) : (
        event.location || MEETING_MODES[event.mode]
      )}
    </span>
  );
}

// Panelists can see a defense but not the thesis workspace, so they get no link
function thesisLink(user, event) {
  if (user.role === 'student') return '/thesis';
  if (user.role === 'admin' || event.adviser_id === user.id) return `/theses/${event.thesis_id}`;
  return null;
}

export default function ScheduleList({
  items,
  compact = false,
  showThesis = true,
  emptyTitle = 'Nothing scheduled',
  emptyMessage,
  onChanged,
}) {
  const { user } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [confirm, setConfirm] = useState(null); // { event, action: 'cancel' | 'delete' }
  const [busy, setBusy] = useState(false);
  const [confirmError, setConfirmError] = useState('');

  if (!items.length) {
    return <EmptyState compact icon={CalendarDays} title={emptyTitle} message={emptyMessage} />;
  }

  async function run(action, successMessage) {
    setBusy(true);
    setConfirmError('');
    try {
      await action();
      setConfirm(null);
      toast.success(successMessage);
      await onChanged?.();
    } catch (err) {
      if (confirm) setConfirmError(err.message);
      else toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <ul className={`event-list stagger${compact ? ' compact' : ''}`}>
        {items.map((event) => {
          const { month, day, weekday } = dayParts(event.starts_at);
          const link = showThesis ? thesisLink(user, event) : null;
          const onPanel = event.panelists.some((panelist) => panelist.id === user.id);
          const active = event.status === 'scheduled';
          const upcoming = active && parseDate(event.ends_at).getTime() > Date.now();

          return (
            <li key={event.id} className={`event${upcoming ? '' : ' event-inactive'}`}>
              <div className="event-date" aria-hidden="true">
                <span>{month}</span>
                <strong>{day}</strong>
                <span>{weekday}</span>
              </div>

              <div className="event-main">
                <div className="event-badges">
                  <ScheduleTypeBadge type={event.type} />
                  {!active && <ScheduleStatusBadge status={event.status} />}
                  {onPanel && <Badge tone="neutral">You're on the panel</Badge>}
                  {upcoming && <span className="event-when">{timeUntil(event.starts_at)}</span>}
                </div>
                <strong className="event-title">{event.title}</strong>
                <div className="event-meta">
                  <span className="event-meta-item">
                    <Clock size={14} />
                    {formatDate(event.starts_at)} · {formatTime(event.starts_at)}–{formatTime(event.ends_at)}
                  </span>
                  <EventLocation event={event} />
                </div>
                {showThesis && (
                  <span className="event-thesis clamp-1">
                    {link ? <Link to={link}>{event.student_name}</Link> : <strong>{event.student_name}</strong>}
                    <span className="muted"> · {event.thesis_title}</span>
                  </span>
                )}
                {!compact && (
                  <span className="event-people muted">
                    <Users size={14} />
                    <span>
                      Adviser: {event.adviser_name ?? 'Not assigned'}
                      {event.panelists.length > 0 && ` · Panel: ${event.panelists.map((p) => p.name).join(', ')}`}
                    </span>
                  </span>
                )}
                {!compact && event.notes && <p className="event-notes">{event.notes}</p>}
                {!compact && event.type !== 'consultation' && event.status !== 'cancelled' && (
                  <Link to={`/defenses/${event.id}`} className="event-defense-link">
                    {onPanel && event.status === 'scheduled' ? 'Score this defense' : 'Scores and verdict'}
                  </Link>
                )}
              </div>

              {!compact && (event.can_manage || event.can_delete) && (
                <div className="event-actions">
                  {event.can_manage && active && (
                    <>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(event)}>
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        disabled={busy}
                        onClick={() => run(() => api.updateSchedule(event.id, { status: 'completed' }), 'Marked as completed')}
                      >
                        <Check size={14} />
                        Mark done
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => {
                          setConfirmError('');
                          setConfirm({ event, action: 'cancel' });
                        }}
                      >
                        <CalendarX2 size={14} />
                        Cancel
                      </button>
                    </>
                  )}
                  {event.can_delete && (
                    <button
                      type="button"
                      className="icon-btn icon-btn-danger"
                      aria-label={`Delete ${event.title}`}
                      onClick={() => {
                        setConfirmError('');
                        setConfirm({ event, action: 'delete' });
                      }}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Modal open={Boolean(editing)} title="Edit event" onClose={() => setEditing(null)} size="lg">
        {editing && (
          <ScheduleForm
            event={editing}
            onCancel={() => setEditing(null)}
            onSaved={async () => {
              setEditing(null);
              toast.success('Event updated');
              await onChanged?.();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.action === 'delete' ? 'Delete this event?' : 'Cancel this event?'}
        message={
          confirm?.action === 'delete'
            ? `"${confirm?.event.title}" will be permanently removed for everyone.`
            : `"${confirm?.event.title}" will be marked as cancelled and moved to past events.`
        }
        confirmLabel={confirm?.action === 'delete' ? 'Delete event' : 'Cancel event'}
        cancelLabel="Keep event"
        busy={busy}
        error={confirmError}
        onClose={() => setConfirm(null)}
        onConfirm={() =>
          confirm.action === 'delete'
            ? run(() => api.deleteSchedule(confirm.event.id), 'Event deleted')
            : run(() => api.updateSchedule(confirm.event.id, { status: 'cancelled' }), 'Event cancelled')
        }
      />
    </>
  );
}
