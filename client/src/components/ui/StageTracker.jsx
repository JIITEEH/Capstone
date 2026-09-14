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
          <li key={stage.key} className={`stage stage-${state}`}>
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
