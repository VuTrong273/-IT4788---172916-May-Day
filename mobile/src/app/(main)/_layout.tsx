import { Stack } from 'expo-router';

import { WorkspaceLoading, WorkspaceShell } from '@/components/workspace-shell';
import { useAuthenticatedSession } from '@/features/auth/use-authenticated-session';
import { getDemoRole } from '@/features/navigation/feature-routes';

export default function MainLayout() {
  const session = useAuthenticatedSession();
  if (!session) return <WorkspaceLoading />;
  const role = getDemoRole(session.user.role_id);

  return <WorkspaceShell session={session} role={role}>
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F0F5FA' } }} />
  </WorkspaceShell>;
}
