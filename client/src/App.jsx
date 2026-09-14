import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth, RequireRole } from './components/auth/Guards.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import Profile from './pages/Profile.jsx';
import SubmissionDetail from './pages/SubmissionDetail.jsx';
import ThesesList from './pages/ThesesList.jsx';
import ThesisDetail from './pages/ThesisDetail.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import Users from './pages/admin/Users.jsx';
import MyThesis from './pages/student/MyThesis.jsx';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="thesis" element={<RequireRole roles={['student']}><MyThesis /></RequireRole>} />
        <Route path="theses" element={<RequireRole roles={['adviser', 'admin']}><ThesesList /></RequireRole>} />
        <Route path="theses/:id" element={<ThesisDetail />} />
        <Route path="submissions/:id" element={<SubmissionDetail />} />
        <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
