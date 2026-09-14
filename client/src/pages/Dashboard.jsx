import { useAuth } from '../context/AuthContext.jsx';
import AdminDashboard from './admin/AdminDashboard.jsx';
import AdviserDashboard from './adviser/AdviserDashboard.jsx';
import StudentDashboard from './student/StudentDashboard.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  if (user.role === 'admin') return <AdminDashboard />;
  if (user.role === 'adviser') return <AdviserDashboard />;
  return <StudentDashboard />;
}
