import { Badge } from '../basics/Badge.jsx';
import { STAGE_LABELS } from '../../helpers/constants.js';
import { dueLabel, dueTone, formatDay } from '../../helpers/format.js';

// The next deadline a thesis still has to meet, such as "Chapters 1–3 · Due in 5 days".
// Renders nothing when the thesis has no term, no due dates left, or is completed.
// The same, as one line of small text for tight table cells: "Proposal overdue by 2 days"
export function DueNote({ thesis }) {
  if (!thesis.next_due_on) return null;
  const days = thesis.next_due_days_left;
  const text = dueLabel(days).replace(/^(Due|Overdue)/, (word) => word.toLowerCase());
  return (
    <span className={`cell-sub due-note due-${dueTone(days)}`} title={`Due ${formatDay(thesis.next_due_on)}`}>
      {STAGE_LABELS[thesis.next_due_stage]} {text}
    </span>
  );
}

export default function DueBadge({ thesis, withStage = true }) {
  if (!thesis.next_due_on) return null;
  const text = dueLabel(thesis.next_due_days_left);
  return (
    <span title={`${STAGE_LABELS[thesis.next_due_stage]} due ${formatDay(thesis.next_due_on)}`}>
      <Badge tone={dueTone(thesis.next_due_days_left)}>
        {withStage ? `${STAGE_LABELS[thesis.next_due_stage]} · ${text}` : text}
      </Badge>
    </span>
  );
}
