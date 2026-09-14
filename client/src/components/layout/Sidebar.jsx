import { NavLink } from 'react-router';
import { BookOpen, GraduationCap, LayoutDashboard, Library, LogOut, UserRound, Users, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

const NAV_BY_ROLE = {
  student: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/thesis', label: 'My Thesis', icon: BookOpen },
  ],
  adviser: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/theses', label: 'My Advisees', icon: Library },
  ],
  admin: [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
    { to: '/theses', label: 'All Theses', icon: Library },
    { to: '/users', label: 'Users', icon: Users },
  ],
};

const WORKSPACE_LABEL = {
  student: 'Student workspace',
  adviser: 'Adviser workspace',
  admin: 'Administration',
};

function navClass({ isActive }) {
  return `nav-link${isActive ? ' active' : ''}`;
}

export default function Sidebar({ onClose }) {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar" aria-label="Main navigation">
      <div className="sidebar-brand">
        <div className="brand-mark">
          <GraduationCap size={20} />
        </div>
        <div className="brand-text">
          <strong>ThesisTrack</strong>
          <span>Thesis Management System</span>
        </div>
        <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
          <X size={18} />
        </button>
      </div>

      <nav className="sidebar-nav">
        <span className="nav-label">{WORKSPACE_LABEL[user.role]}</span>
        {NAV_BY_ROLE[user.role].map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navClass}>
            <Icon size={18} />
            {label}
          </NavLink>
        ))}

        <span className="nav-label">Account</span>
        <NavLink to="/profile" className={navClass}>
          <UserRound size={18} />
          Profile
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <button type="button" className="nav-link" onClick={logout}>
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
