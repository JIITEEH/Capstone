import { lazy } from 'react';
import { Route, Routes } from 'react-router';
import { GuestOnly, RequireAuth, RequireRole } from './ui-pieces/auth/Guards.jsx';
import AppLayout from './ui-pieces/layout/AppLayout.jsx';
import Dashboard from './screens/Dashboard.jsx';
import NotFound from './screens/NotFound.jsx';
import Login from './screens/auth/Login.jsx';
import Register from './screens/auth/Register.jsx';
import ForgotPassword from './screens/auth/ForgotPassword.jsx';
import ResetPassword from './screens/auth/ResetPassword.jsx';
import VerifyEmail from './screens/auth/VerifyEmail.jsx';

// Pages load on demand, so each role's browser only downloads the screens that role can use
const MyThesis = lazy(() => import('./screens/student/MyThesis.jsx'));
const ThesesList = lazy(() => import('./screens/ThesesList.jsx'));
const Users = lazy(() => import('./screens/admin/Users.jsx'));
const AuditLog = lazy(() => import('./screens/admin/AuditLog.jsx'));
const DefenseDetail = lazy(() => import('./screens/DefenseDetail.jsx'));
const ThesisDetail = lazy(() => import('./screens/ThesisDetail.jsx'));
const SubmissionDetail = lazy(() => import('./screens/SubmissionDetail.jsx'));
const Schedule = lazy(() => import('./screens/Schedule.jsx'));
const Profile = lazy(() => import('./screens/Profile.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
      <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
      <Route path="/forgot-password" element={<GuestOnly><ForgotPassword /></GuestOnly>} />
      <Route path="/reset-password" element={<GuestOnly><ResetPassword /></GuestOnly>} />
      {/* Not guest-only: a student often opens the email link while already signed in */}
      <Route path="/verify-email" element={<VerifyEmail />} />

      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="thesis" element={<RequireRole roles={['student']}><MyThesis /></RequireRole>} />
        <Route path="theses" element={<RequireRole roles={['adviser', 'admin']}><ThesesList /></RequireRole>} />
        <Route path="theses/:id" element={<RequireRole roles={['adviser', 'admin']}><ThesisDetail /></RequireRole>} />
        <Route path="submissions/:id" element={<SubmissionDetail />} />
        <Route path="schedule" element={<Schedule />} />
        {/* Every role can open a defense it can see; the server decides what each one is shown */}
        <Route path="defenses/:id" element={<DefenseDetail />} />
        <Route path="users" element={<RequireRole roles={['admin']}><Users /></RequireRole>} />
        <Route path="audit" element={<RequireRole roles={['admin']}><AuditLog /></RequireRole>} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
