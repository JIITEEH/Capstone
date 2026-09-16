import { Suspense, useEffect, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router';
import { CalendarDays, Menu } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import Avatar from '../basics/Avatar.jsx';
import ErrorBoundary from '../basics/ErrorBoundary.jsx';
import { SkeletonPage } from '../basics/Feedback.jsx';
import Notifications from './Notifications.jsx';
import Sidebar from './Sidebar.jsx';
import TopbarSearch from './TopbarSearch.jsx';

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
            <Menu size={22} />
          </button>
          <TopbarSearch />
          <div className="topbar-spacer" />
          <Link to="/schedule" className="round-btn" aria-label="Schedule" title="Schedule">
            <CalendarDays size={21} />
          </Link>
          <Notifications />
          <Link to="/profile" className="user-chip">
            <Avatar name={user.name} />
            <span className="user-chip-text">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </span>
          </Link>
        </header>

        <main className="page">
          {/* Keyed by path so each page plays its entrance animation, and so moving to
              another page clears a crash instead of keeping the error screen */}
          <ErrorBoundary key={location.pathname}>
            <Suspense fallback={<SkeletonPage />}>
              <div className="page-enter">
                <Outlet />
              </div>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
