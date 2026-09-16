import { Suspense, useEffect, useRef, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router';
import { CalendarDays, Menu, Search } from 'lucide-react';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import Avatar from '../basics/Avatar.jsx';
import ErrorBoundary from '../basics/ErrorBoundary.jsx';
import { SkeletonPage } from '../basics/Feedback.jsx';
import Notifications from './Notifications.jsx';
import Sidebar from './Sidebar.jsx';

const IS_MAC = /Mac|iPhone|iPad/.test(navigator.userAgent);

// Searches the theses list; Cmd/Ctrl+K focuses it from anywhere
function TopbarSearch() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function submit(event) {
    event.preventDefault();
    const trimmed = query.trim();
    navigate(trimmed ? `/theses?q=${encodeURIComponent(trimmed)}` : '/theses');
    inputRef.current?.blur();
  }

  return (
    <form className="topbar-search" role="search" onSubmit={submit}>
      <Search size={22} aria-hidden="true" />
      <input
        ref={inputRef}
        type="search"
        placeholder="Search theses"
        aria-label="Search theses"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <kbd className="kbd">{IS_MAC ? '⌘ K' : 'Ctrl K'}</kbd>
    </form>
  );
}

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
          {user.role !== 'student' && <TopbarSearch />}
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
