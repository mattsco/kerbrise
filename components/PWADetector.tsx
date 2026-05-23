"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Détecte si l'app tourne en mode PWA installée (standalone) ou via navigateur classique
 * et envoie l'info à Supabase pour analytics.
 *
 * Monté dans le dashboard. Track une fois par session.
 */
export default function PWADetector() {
  useEffect(() => {
    async function detectAndSend() {
      try {
        // Détection PWA standalone (Android Chrome + Edge + Firefox)
        const isStandalone =
          window.matchMedia("(display-mode: standalone)").matches ||
          // iOS Safari
          // @ts-ignore - iOS-specific
          window.navigator.standalone === true;

        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) return;

        await supabase
          .from("users")
          .update({ last_is_pwa: isStandalone })
          .eq("id", user.id);
      } catch {
        // Silencieux
      }
    }

    // Petit délai pour ne pas bloquer le render
    const timer = setTimeout(detectAndSend, 1000);
    return () => clearTimeout(timer);
  }, []);

  return null;
}