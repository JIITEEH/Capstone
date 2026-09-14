import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { Menu } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { ROLES } from '../../utils/constants.js';
import Avatar from '../ui/Avatar.jsx';
import Sidebar from './Sidebar.jsx';

export default function AppLayout() {
  const { user } = useAuth();
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app${navOpen ? ' nav-open' : ''}`}>
      <Sidebar onClose={() => setNavOpen(false)} />
      <div className="nav-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="app-main">
        <header className="topbar">
          <button type="button" className="icon-btn topbar-menu" onClick={() => setNavOpen(true)} aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-spacer" />
          <Link to="/profile" className="user-chip">
            <Avatar name={user.name} size="sm" />
            <span className="user-chip-text">
              <strong>{user.name}</strong>
              <span>{ROLES[user.role].label}</span>
            </span>
          </Link>
        </header>

        <main className="page">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
