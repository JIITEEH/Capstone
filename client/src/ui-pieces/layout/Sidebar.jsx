import { Link, NavLink } from 'react-router';
import {
  BookOpen,
  CalendarDays,
  CalendarPlus,
  CalendarRange,
  LayoutDashboard,
  Library,
  LogOut,
  ScrollText,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';

// Each role only sees the features it can use
const NAV_BY_ROLE = {
  student: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/thesis', label: 'My Thesis', icon: BookOpen },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
  adviser: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/theses', label: 'My Advisees', icon: Library },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/theses', label: 'All Theses', icon: Library },
    { to: '/schedule', label: 'Schedule', icon: CalendarDays },
    { to: '/users', label: 'Users', icon: Users },
    { to: '/terms', label: 'Terms', icon: CalendarRange },
    { to: '/audit', label: 'Audit log', icon: ScrollText },
  ],
};

const PROMO_BY_ROLE = {
  // Students can't schedule anything, so this points them at the list instead of a booking form
  student: { lead: 'See', rest: 'your consultations', text: 'Your adviser sets these before each stage' },
  adviser: { lead: 'Plan', rest: 'your consultations', text: 'Keep every advisee meeting on track' },
  admin: { lead: 'Schedule', rest: 'the next defense', text: 'Set dates and panels in one place' },
};

function navClass({ isActive }) {
  return `nav-link${isActive ? ' active' : ''}`;
}

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();
  const promo = PROMO_BY_ROLE[user.role];

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <span className="brand-mark" aria-hidden="true" />
        <strong className="brand-name">ThesisTrack</strong>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-label">Menu</span>
        {NAV_BY_ROLE[user.role].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <Icon size={21} />
            {label}
          </NavLink>
        ))}

        <span className="nav-label">General</span>
        <NavLink to="/profile" className={navClass}>
          <UserRound size={21} />
          Profile
        </NavLink>
        <button type="button" className="nav-link" onClick={logout}>
          <LogOut size={21} />
          Logout
        </button>
      </nav>

      <div className="sidebar-promo">
        <span className="promo-icon" aria-hidden="true">
          <CalendarPlus size={15} />
        </span>
        <strong className="promo-title">
          <span>{promo.lead}</span> {promo.rest}
        </strong>
        <p>{promo.text}</p>
        <Link to="/schedule" className="promo-btn">
          Open Schedule
        </Link>
      </div>
    </aside>
  );
}
