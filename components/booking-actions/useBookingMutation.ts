// components/booking-actions/useBookingMutation.ts
//
// Every booking-action sub-component (Edit, Cancel, Delete) and ApprovalButtons
// repeats the same client-mutation boilerplate:
//   setSubmitting(true); setError(""); ...await; on error setError+return;
//   router.refresh(); onComplete().
//
// This hook centralises that flow. It does NOT change behaviour — it just
// removes ~10 duplicated lines per component and guarantees they all handle
// errors the same way.

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type MutationResult = { ok: true } | { ok: false; error: string };

export function useBookingMutation() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  /**
   * Runs `fn`, manages submitting/error state, and on success refreshes the
   * route and calls onComplete. Returns true on success.
   *
   * `fn` should return { ok: false, error } rather than throwing; thrown
   * errors are caught and surfaced too, so server-action callers are safe.
   */
  const run = useCallback(
    async (
      fn: () => Promise<MutationResult>,
      onComplete?: () => void
    ): Promise<boolean> => {
      setSubmitting(true);
      setError("");
      try {
        const result = await fn();
        if (!result.ok) {
          setError("Erreur : " + result.error);
          setSubmitting(false);
          return false;
        }
        router.refresh();
        onComplete?.();
        return true;
      } catch (e: any) {
        setError("Erreur : " + (e?.message ?? "inconnue"));
        setSubmitting(false);
        return false;
      }
    },
    [router]
  );

  return { submitting, error, setError, run };
}
