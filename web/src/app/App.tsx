import type { ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';

import { AppShell } from '@/components/layout/AppShell';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { useAuth } from '@/features/auth/auth-context';
import type { UserRole } from '@/features/auth/auth-types';
import { PasswordPage } from '@/features/auth/PasswordPage';
import { RecordDetailPage } from '@/features/medical-records/RecordDetailPage';
import { RecordsPage } from '@/features/medical-records/RecordsPage';
import { ProfilePage } from '@/features/profile/ProfilePage';
import { PatientsPage } from '@/features/operations/PatientsPage';
import { UsersPage } from '@/features/operations/UsersPage';
import { FacilitiesPage } from '@/features/operations/FacilitiesPage';
import { TemplatesPage } from '@/features/operations/TemplatesPage';
import { AccessPage } from '@/features/operations/AccessPage';
import { ClinicalPage } from '@/features/operations/ClinicalPage';

function ProtectedRoute() {
  const { session } = useAuth();
  const location = useLocation();
  return session ? <AppShell /> : <Navigate to="/login" replace state={{ from: location.pathname }} />;
}

function RoleRoute({ allow, children }: { allow: UserRole[]; children: ReactNode }) {
  // Endpoint permissions in AppShell protect the page. Roles choose clinical
  // ownership rules on the server, rather than limiting navigation here.
  void allow;
  return children;
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
        <Route path="patients" element={<RoleRoute allow={['doctor']}><PatientsPage /></RoleRoute>} />
        <Route path="users" element={<RoleRoute allow={['admin']}><UsersPage /></RoleRoute>} />
        <Route path="facilities" element={<RoleRoute allow={['admin']}><FacilitiesPage /></RoleRoute>} />
        <Route path="templates" element={<RoleRoute allow={['admin']}><TemplatesPage /></RoleRoute>} />
        <Route path="access" element={<RoleRoute allow={['admin']}><AccessPage /></RoleRoute>} />
        <Route path="labs" element={<RoleRoute allow={['doctor', 'admin']}><ClinicalPage key="labs" mode="labs" /></RoleRoute>} />
        <Route path="prescriptions" element={<RoleRoute allow={['doctor', 'admin']}><ClinicalPage key="prescriptions" mode="prescriptions" /></RoleRoute>} />
        <Route path="profile" element={<ProfilePage />} />
        <Route path="profile/password" element={<PasswordPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
