import { useCallback, useEffect, useState } from "react";
import { router, useFocusEffect } from "expo-router";

import { getSession, type Session } from "./session";
import { refreshSessionAccess } from "./access-api";
import {
  subscribeAccess,
  subscribeAccessInvalidation,
  publishAccess,
} from "./access-events";

export function useAuthenticatedSession(): Session | null {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(
    () =>
      subscribeAccess((updated) =>
        setSession((current) =>
          current?.token === updated.token &&
          JSON.stringify(current) !== JSON.stringify(updated)
            ? updated
            : current,
        ),
      ),
    [],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const reload = () =>
        getSession()
          .then(async (saved) => {
            if (!saved) return null;
            try {
              return await refreshSessionAccess(saved);
            } catch (reason) {
              const failed = {
                ...saved,
                access: undefined,
                accessError:
                  reason instanceof Error
                    ? reason.message
                    : "Không tải được quyền truy cập.",
              };
              publishAccess(failed);
              return failed;
            }
          })
          .then((saved) => {
            if (!active) return;
            if (saved) setSession(saved);
            else router.dismissTo("/");
          })
          .catch(() => {
            if (active) router.dismissTo("/");
          });
      void reload();
      const timer = setInterval(reload, 60000);
      const unsubscribe = subscribeAccessInvalidation(() => {
        void reload();
      });

      return () => {
        active = false;
        clearInterval(timer);
        unsubscribe();
      };
    }, []),
  );

  return session;
}
