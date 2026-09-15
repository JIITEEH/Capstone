import { lazy } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

// Each role only downloads its own dashboard
const AdminDashboard = lazy(() => import('./admin/AdminDashboard.jsx'));
const AdviserDashboard = lazy(() => import('./adviser/AdviserDashboard.jsx'));
const StudentDashboard = lazy(() => import('./student/StudentDashboard.jsx'));

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'adviser') return <AdviserDashboard />;
  return <StudentDashboard />;
}
