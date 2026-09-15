import { Link } from 'react-router';
import { BookOpen, FileText, GraduationCap, ScrollText } from 'lucide-react';
import { EmptyState } from '../ui/Feedback.jsx';

export const STAGE_GLYPHS = {
  proposal: { icon: ScrollText, tone: 'blue' },
  chapters_1_3: { icon: BookOpen, tone: 'teal' },
  chapters_4_5: { icon: FileText, tone: 'amber' },
  final: { icon: GraduationCap, tone: 'violet' },
};

// items: [{ key, icon, tone, title, meta, to }]
export default function TaskListCard({ title, action, items, emptyIcon, emptyTitle, emptyMessage }) {
  return (
    <section className="dash-card tasks">
      <div className="dash-card-head">
        <h3>{title}</h3>
        {action}
      </div>
      {items.length ? (
        <ul className="task-list">
          {items.map(({ key, icon: Icon, tone, title: itemTitle, meta, to }) => (
            <li key={key}>
              <Link to={to} className="task-item">
                <span className={`task-icon glyph-${tone}`}>
                  <Icon size={24} strokeWidth={2.4} />
                </span>
                <span className="task-text">
                  <strong className="clamp-1">{itemTitle}</strong>
                  <span className="clamp-1">{meta}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
      )}
    </section>
  );
}
