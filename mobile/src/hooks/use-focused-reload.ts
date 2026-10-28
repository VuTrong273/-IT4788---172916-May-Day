import { useCallback, useRef } from "react";
import { useFocusEffect } from "expo-router";

/** Reload on focus or on demand; ignore responses after blur or a newer request. */
export function useFocusedReload(
  load: (isCurrent: () => boolean) => Promise<void>,
) {
  const generation = useRef(0);
  const reload = useCallback(() => {
    const request = ++generation.current;
    void load(() => generation.current === request);
  }, [load]);
  useFocusEffect(
    useCallback(() => {
      reload();
      return () => {
        generation.current += 1;
      };
    }, [reload]),
  );
  return reload;
}
