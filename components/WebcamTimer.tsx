"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Composant invisible qui tracke le temps passé sur la page webcam.
 * - Sur navigation Next.js (route change) → insert Supabase classique
 * - Sur fermeture d'onglet / app en background → sendBeacon vers /api/webcam-session
 *   (navigator.sendBeacon survit à l'unload, contrairement à un fetch normal)
 */
export default function WebcamTimer() {
  const startedRef = useRef<number>(Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    startedRef.current = Date.now();
    sentRef.current = false;

    function getDuration() {
      return Math.round((Date.now() - startedRef.current) / 1000);
    }

    // Cas 1 : navigation interne (route change Next.js) → on a le temps
    async function logSessionAsync() {
      if (sentRef.current) return;
      const duration = getDuration();
      if (duration < 3) return;
      sentRef.current = true;

      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase.from("webcam_sessions").insert({
          user_id: user.id,
          duration_seconds: duration,
        });
      } catch {
        // silencieux : ne pas perturber la nav
      }
    }

    // Cas 2 : fermeture d'onglet ou mise en arrière-plan
    function logSessionBeacon() {
      if (sentRef.current) return;
      const duration = getDuration();
      if (duration < 3) return;
      sentRef.current = true;

      const data = JSON.stringify({ duration_seconds: duration });
      const blob = new Blob([data], { type: "application/json" });
      navigator.sendBeacon("/api/webcam-session", blob);
    }

    // `pagehide` est plus fiable que `beforeunload` sur mobile/PWA
    // (beforeunload est souvent silencé sur iOS Safari notamment)
    window.addEventListener("pagehide", logSessionBeacon);

    return () => {
      window.removeEventListener("pagehide", logSessionBeacon);
      logSessionAsync();
    };
  }, []);

  return null;
}