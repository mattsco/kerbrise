import { useState, useEffect, useRef } from "react";


/**
 * Comme useState, mais resync avec la prop quand celle-ci change.
 * Utile pour les Client Components qui reçoivent un état initial du serveur
 * et veulent rester en phase après un router.refresh().
 */
export function useSyncedState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);
  return [value, setValue] as const;
}


/**
 * Renvoie une valeur calculée qui se recalcule automatiquement à minuit local.
 * Pratique pour des labels "demain / dans 3 jours" qui ne changent qu'au passage
 * du jour, sans avoir besoin de polling toutes les minutes.
 *
 * La fonction `compute` est lue en live via ref → même si elle change entre 2
 * renders, on n'a pas besoin de re-setup le timer.
 */
export function useDailyValue<T>(compute: () => T): T {
  const [value, setValue] = useState<T>(compute);
  const computeRef = useRef(compute);
  computeRef.current = compute;

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function scheduleNext() {
      const now = new Date();
      const tomorrow = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1, // +1s après minuit pour être sûr d'être passé le cap
        0
      );
      const msUntilMidnight = tomorrow.getTime() - now.getTime();

      timeoutId = setTimeout(() => {
        setValue(computeRef.current());
        scheduleNext();
      }, msUntilMidnight);
    }

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, []);

  return value;
}

