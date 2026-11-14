import { authApi } from './auth-api';
import { clearSession, type Session } from './session';

export async function clearAuthenticatedSession(session: Session): Promise<boolean> {
  let serverConfirmed = true;
  try {
    await authApi.logout(session.token);
  } catch {
    serverConfirmed = false;
  }

  await clearSession();
  return serverConfirmed;
}
