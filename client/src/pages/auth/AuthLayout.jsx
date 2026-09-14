import { CircleCheck, GraduationCap } from 'lucide-react';

const HIGHLIGHTS = [
  'Submit your proposal, chapters, and final manuscript in one place',
  'Get feedback from your adviser on every submission',
  'Track your progress through each stage of your thesis',
];

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <aside className="auth-brand">
        <div className="auth-brand-logo">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <strong>ThesisTrack</strong>
        </div>
        <div>
          <h1>Your thesis, from proposal to final defense.</h1>
          <ul className="auth-highlights">
            {HIGHLIGHTS.map((text) => (
              <li key={text}>
                <CircleCheck size={18} />
                {text}
              </li>
            ))}
          </ul>
        </div>
        <span className="auth-brand-foot">Thesis Management System</span>
      </aside>
      <main className="auth-panel">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
