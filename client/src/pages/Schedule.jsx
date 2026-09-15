import { useState } from 'react';
import { CalendarPlus } from 'lucide-react';
import ScheduleForm from '../components/schedule/ScheduleForm.jsx';
import ScheduleList from '../components/schedule/ScheduleList.jsx';
import { LoadState, Spinner } from '../components/ui/Feedback.jsx';
import Modal from '../components/ui/Modal.jsx';
import PageHeader from '../components/ui/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import useApi from '../hooks/useApi.js';
import { api } from '../services/api.js';

const COPY = {
  student: {
    subtitle: 'Consultations and defenses for your thesis.',
    empty: 'Your adviser will schedule consultations here, and an admin will schedule your defenses.',
  },
  adviser: {
    subtitle: "Consultations with your advisees and defenses where you're on the panel.",
    empty: 'Schedule a consultation with one of your advisees to get started.',
  },
  admin: {
    subtitle: 'Every consultation and defense across all theses.',
    empty: 'Schedule a proposal or final defense to get started.',
  },
};

const RANGES = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past & cancelled' },
];

export default function Schedule() {
  const { user } = useAuth();
  const toast = useToast();
  const canCreate = user.role !== 'student';
  const [range, setRange] = useState('upcoming');
  const [creating, setCreating] = useState(false);
  const { data: events, loading, error, reload } = useApi(() => api.listSchedules({ range }), [range], {
    refreshInterval: 60000,
  });

  return (
    <>
      <PageHeader
        title="Schedule"
        subtitle={COPY[user.role].subtitle}
        actions={
          canCreate && (
            <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
              <CalendarPlus size={16} />
              {user.role === 'admin' ? 'New event' : 'Schedule consultation'}
            </button>
          )
        }
      />

      <section className="card card-flush">
        <div className="toolbar">
          <div className="segmented" role="tablist" aria-label="Which events to show">
            {RANGES.map((option) => (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={range === option.value}
                className={range === option.value ? 'active' : ''}
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {loading && events && <Spinner size={18} />}
        </div>
        <div className="card-pad">
          {!events ? (
            <LoadState loading={loading} error={error} onRetry={reload} />
          ) : (
            <ScheduleList
              key={range}
              items={events}
              onChanged={reload}
              emptyTitle={range === 'upcoming' ? 'No upcoming events' : 'No past events'}
              emptyMessage={range === 'upcoming' ? COPY[user.role].empty : undefined}
            />
          )}
        </div>
      </section>

      <Modal
        open={creating}
        title={user.role === 'admin' ? 'New event' : 'Schedule a consultation'}
        onClose={() => setCreating(false)}
        size="lg"
      >
        {creating && (
          <ScheduleForm
            onCancel={() => setCreating(false)}
            onSaved={async () => {
              setCreating(false);
              toast.success('Event scheduled');
              if (range === 'upcoming') await reload();
              else setRange('upcoming');
            }}
          />
        )}
      </Modal>
    </>
  );
}
