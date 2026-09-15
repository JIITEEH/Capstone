import { Check } from 'lucide-react';
import { STAGES } from '../../utils/constants.js';

export default function StageTracker({ approvedKeys = [] }) {
  const approved = new Set(approvedKeys);
  // The first stage that isn't approved yet is the one the student is working on
  const currentKey = STAGES.find((stage) => !approved.has(stage.key))?.key;

  return (
    <ol className="stages">
      {STAGES.map((stage, index) => {
        const state = approved.has(stage.key) ? 'done' : stage.key === currentKey ? 'current' : 'upcoming';
        return (
          <li key={stage.key} className={`stage stage-${state}`} style={{ '--stage-delay': `${index * 120}ms` }}>
            <span className="stage-dot">{state === 'done' ? <Check size={14} strokeWidth={3} /> : index + 1}</span>
            <span className="stage-label">{stage.label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ProgressBar({ value, max, label }) {
  const percent = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="progress" title={label ?? `${percent}%`}>
      <div className="progress-track">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <span className="progress-text">{label ?? `${value}/${max}`}</span>
    </div>
  );
}

export function ProgressRing({ percent, size = 72, stroke = 7 }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={`${percent}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={center} cy={center} r={radius} strokeWidth={stroke} fill="none" />
        <circle
          className="ring-fill"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ '--ring-length': circumference, '--ring-offset': circumference * (1 - percent / 100) }}
        />
      </svg>
      <span className="ring-label">{percent}%</span>
    </div>
  );
}
