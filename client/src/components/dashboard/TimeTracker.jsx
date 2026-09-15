import { useEffect, useState } from 'react';
import { Pause, Play, Square } from 'lucide-react';

const IDLE = { elapsed: 0, startedAt: null };

// The timer lives in this browser only, so it survives reloads and page changes
function loadTimer(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? IDLE;
  } catch {
    return IDLE;
  }
}

function formatClock(ms) {
  const seconds = Math.floor(ms / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}:${pad(seconds % 60)}`;
}

export default function TimeTracker({ userId, title = 'Time Tracker' }) {
  const key = `tms_timer_${userId}`;
  const [timer, setTimer] = useState(() => loadTimer(key));
  const [, setTick] = useState(0);
  const running = timer.startedAt !== null;

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(timer));
    } catch {
      // Storage can be unavailable (private mode); the timer still works for this visit
    }
  }, [key, timer]);

  useEffect(() => {
    if (!running) return undefined;
    const interval = setInterval(() => setTick((tick) => tick + 1), 1000);
    return () => clearInterval(interval);
  }, [running]);

  const total = timer.elapsed + (running ? Date.now() - timer.startedAt : 0);

  function toggle() {
    setTimer((current) =>
      current.startedAt === null
        ? { ...current, startedAt: Date.now() }
        : { elapsed: current.elapsed + Date.now() - current.startedAt, startedAt: null },
    );
  }

  return (
    <section className={`tracker${running ? ' is-running' : ''}`}>
      <h3>{title}</h3>
      <div className="tracker-time" role="timer">
        {formatClock(total)}
      </div>
      <div className="tracker-controls">
        <button
          type="button"
          className="tracker-btn tracker-toggle"
          onClick={toggle}
          aria-label={running ? 'Pause timer' : 'Start timer'}
        >
          {running ? <Pause size={22} fill="currentColor" /> : <Play size={22} fill="currentColor" />}
        </button>
        <button
          type="button"
          className="tracker-btn tracker-stop"
          onClick={() => setTimer(IDLE)}
          disabled={total === 0}
          aria-label="Stop and reset timer"
        >
          <Square size={16} fill="currentColor" />
        </button>
      </div>
    </section>
  );
}
