import { useState, useEffect } from "react";

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