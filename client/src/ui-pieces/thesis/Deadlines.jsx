import { Badge } from '../basics/Badge.jsx';
import { dueLabel, dueTone, formatDay } from '../../helpers/format.js';

const DONE = {
  met: { tone: 'success', label: 'Submitted on time' },
  late: { tone: 'warning', label: 'Submitted late' },
  missed: { tone: 'danger', label: 'Missed' },
};

// Each stage's due date in the thesis's term, and how the group did against it
export default function Deadlines({ termName, deadlines }) {
  if (!deadlines.length) return null;
  return (
    <div className="deadlines">
      <div className="group-members-head">
        <span className="person-label">Deadlines</span>
        <span className="field-hint">{termName}</span>
      </div>
      <ul className="deadline-list">
        {deadlines.map((deadline) => {
          const shown =
            deadline.state === 'upcoming'
              ? { tone: dueTone(deadline.days_left), label: dueLabel(deadline.days_left) }
              : DONE[deadline.state];
          return (
            <li key={deadline.stage} className="deadline-row">
              <span className="deadline-stage">{deadline.label}</span>
              <span className="muted nowrap">{formatDay(deadline.due_on)}</span>
              <Badge tone={shown.tone}>{shown.label}</Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
