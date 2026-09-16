import { Navigate, useLocation } from 'react-router';
import { useAuth } from '../../shared-state/AuthContext.jsx';
import { PageLoader } from '../basics/Feedback.jsx';

export function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader fullscreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}

// UI-level guard only; the API enforces the same permissions
export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

export function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <PageLoader fullscreen />;
  if (user) return <Navigate to="/" replace />;
  return children;
}
