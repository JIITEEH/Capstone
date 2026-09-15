import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth, RequireRole } from './components/auth/Guards.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import NotFound from './pages/NotFound.jsx';
import Login from './pages/auth/Login.jsx';
import Register from './pages/auth/Register.jsx';
import ForgotPassword from './pages/auth/ForgotPassword.jsx';
import ResetPassword from './pages/auth/ResetPassword.jsx';

// Pages load on demand, so each role's browser only downloads the screens that role can use
const MyThesis = lazy(() => import('./pages/student/MyThesis.jsx'));
const ThesesList = lazy(() => import('./pages/ThesesList.jsx'));
const Users = lazy(() => import('./pages/admin/Users.jsx'));
const ThesisDetail = lazy(() => import('./pages/ThesisDetail.jsx'));
const SubmissionDetail = lazy(() => import('./pages/SubmissionDetail.jsx'));
const Schedule = lazy(() => import('./pages/Schedule.jsx'));
const Profile = lazy(() => import('./pages/Profile.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="thesis" element={<RequireRole roles={['student']}><MyThesis /></RequireRole>} />
        <Route path="theses" element={<RequireRole roles={['adviser', 'admin']}><ThesesList /></RequireRole>} />
        <Route path="theses/:id" element={<RequireRole roles={['adviser', 'admin']}><ThesisDetail /></RequireRole>} />
        <Route path="submissions/:id" element={<SubmissionDetail />} />
        <Route path="schedule" element={<Schedule />} />
        <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
