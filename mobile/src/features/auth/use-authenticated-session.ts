import { useCallback, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';

import { getSession, type Session } from './session';

export function useAuthenticatedSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getSession()
        .then((saved) => {
          if (!active) return;
          if (saved) setSession(saved);
          else router.dismissTo('/');
        })
        .catch(() => {
          if (active) router.dismissTo('/');
        });

      return () => { active = false; };
    }, []),
  );

  return session;
}
