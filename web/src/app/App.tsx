import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { useAuth } from '@/features/auth/auth-context';
import { roleFromId, type UserRole } from '@/features/auth/auth-types';
import { PasswordPage } from '@/features/auth/PasswordPage';
import { RecordDetailPage } from '@/features/medical-records/RecordDetailPage';
import { RecordsPage } from '@/features/medical-records/RecordsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { ModuleUnavailablePage } from '@/features/modules/ModuleUnavailablePage';

function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();
  return session ? <AppShell /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function RoleRoute({ allow, children }: { allow: UserRole[]; children: ReactNode }) {
  const { session } = useAuth();
  const role = session ? roleFromId(session.user.role_id) : null;
  return role && allow.includes(role) ? children : <Navigate to="/app" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/app" element={<ProtectedRoute />}>
        <Route index element={<DashboardPage />} />
        <Route path="records" element={<RecordsPage />} />
        <Route path="records/:id" element={<RecordDetailPage />} />
        <Route path="patients" element={<RoleRoute allow={['doctor']}><ModuleUnavailablePage moduleKey="patients" /></RoleRoute>} />
        <Route path="users" element={<RoleRoute allow={['admin']}><ModuleUnavailablePage moduleKey="users" /></RoleRoute>} />
        <Route path="facilities" element={<RoleRoute allow={['admin']}><ModuleUnavailablePage moduleKey="facilities" /></RoleRoute>} />
        <Route path="templates" element={<RoleRoute allow={['admin']}><ModuleUnavailablePage moduleKey="templates" /></RoleRoute>} />
        <Route path="access" element={<RoleRoute allow={['admin']}><ModuleUnavailablePage moduleKey="access" /></RoleRoute>} />
        <Route path="labs" element={<RoleRoute allow={['doctor', 'admin']}><ModuleUnavailablePage moduleKey="labs" /></RoleRoute>} />
        <Route path="prescriptions" element={<RoleRoute allow={['doctor', 'admin']}><ModuleUnavailablePage moduleKey="prescriptions" /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/password" element={<PasswordPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
