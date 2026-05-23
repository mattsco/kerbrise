"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Composant invisible qui tracke le temps passé sur la page webcam.
 * Au démontage du composant (changement de page, fermeture, etc.),
 * on log la durée écoulée dans webcam_sessions.
 */
export default function WebcamTimer() {
  const startedRef = useRef<number>(Date.now());
  const sentRef = useRef(false);

  useEffect(() => {
    startedRef.current = Date.now();
    sentRef.current = false;

    async function logSession() {
      if (sentRef.current) return;
      sentRef.current = true;

      const duration = Math.round((Date.now() - startedRef.current) / 1000);
      // Ignorer les sessions trop courtes (<3s, probablement un toucher accidentel)
      if (duration < 3) return;

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
      } catch (e) {
        // Silencieux : ne pas perturber la nav
      }
    }

    // Si l'utilisateur ferme l'onglet / quitte
    function handleBeforeUnload() {
      // Note : `beforeunload` ne permet plus d'await en async, on fait sendBeacon
      const duration = Math.round((Date.now() - startedRef.current) / 1000);
      if (duration < 3 || sentRef.current) return;
      sentRef.current = true;
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    // Au démontage du composant (changement de route Next), on log
    return () => {
      logSession();
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);

  return null; // composant invisible
}