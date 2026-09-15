import { GraduationCap } from 'lucide-react';

// Decorative people on the right panel; initials stand in for photos
const PEOPLE = [
  { initials: 'MS', className: 'auth-person-1' },
  { initials: 'AC', className: 'auth-person-2' },
  { initials: 'JR', className: 'auth-person-3' },
];

const STACK = ['AC', 'MS', 'LM', 'BL'];

export default function AuthLayout({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <main className="auth-panel">
          <div className="auth-logo">
            <GraduationCap size={20} />
            ThesisTrack
          </div>
          <div className="auth-card">{children}</div>
          <footer className="auth-foot">
            <span>Thesis Management System</span>
            <span>© {new Date().getFullYear()} ThesisTrack</span>
          </footer>
        </main>

        <aside className="auth-visual" aria-hidden="true">
          <div className="auth-orb auth-orb-1" />
          <div className="auth-orb auth-orb-2" />

          <div className="auth-event">
            <div className="auth-event-card">
              <strong>Proposal Defense</strong>
              <span>09:30am – 10:00am</span>
              <i className="auth-dot" />
            </div>
            <div className="auth-event-ghost">
              <span>09:30am – 10:00am</span>
              <i className="auth-dot auth-dot-light" />
            </div>
          </div>

          <div className="auth-visual-row">
            <div className="auth-meeting">
              <strong>Adviser Consultation</strong>
              <span>12:00pm – 01:00pm</span>
              <i className="auth-dot" />
              <div className="auth-stack">
                {STACK.map((initials) => (
                  <span key={initials}>{initials}</span>
                ))}
              </div>
            </div>
            <div className="auth-people">
              {PEOPLE.map(({ initials, className }) => (
                <span key={initials} className={`auth-person ${className}`}>
                  {initials}
                </span>
              ))}
            </div>
          </div>

          <div className="auth-visual-copy">
            <h1>Your thesis, from proposal to final defense.</h1>
            <p>Submit manuscripts, get adviser feedback, and track every stage in one place.</p>
          </div>
        </aside>
      </div>
    </div>
  );
}
