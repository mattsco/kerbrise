"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Mémorise ce qu'on a déjà écrit pour cet appareil, sous la forme
 * `<userId>:<true|false>`.
 *
 * L'id est DANS la valeur et pas dans la clé pour que la purge de
 * déconnexion reste un `removeItem` d'une clé connue (cf. purgeOfflineData) :
 * une clé par utilisateur obligerait à balayer tout le localStorage. Effet de
 * bord voulu — si quelqu'un d'autre se connecte sur le même téléphone, la
 * valeur ne correspond plus et on réécrit, ce qui est le comportement correct.
 */
export const PWA_MODE_KEY = "kerbrise-pwa-mode";

/**
 * Détecte si l'app tourne en mode PWA installée (standalone) ou via navigateur
 * classique, et envoie l'info à Supabase pour les analytics.
 *
 * Monté dans le dashboard.
 *
 * ⚠️ HISTORIQUE — pourquoi ce composant a deux garde-fous
 *
 * La première version appelait `supabase.auth.getUser()` à CHAQUE montage,
 * puis écrivait systématiquement. Deux problèmes mesurés sur 98 jours de
 * production (25 août 2026) :
 *
 *   1. `getUser()` est un ALLER-RETOUR RÉSEAU vers le serveur Auth. C'est
 *      exactement le round-trip que le middleware a été réécrit pour
 *      supprimer (getClaims + vérification ES256 locale, ~40 ms → ~5 ms) —
 *      il revenait ici par la porte du client. L'id vient désormais du
 *      serveur, qui l'a déjà : zéro appel d'auth.
 *   2. 1 085 UPDATE pour stocker un booléen qui ne change quasiment jamais.
 *      Avec les écritures du middleware, la télémétrie de présence pesait
 *      62 % du temps base de données de toute l'app.
 *
 * On n'écrit donc plus que si la valeur DIFFÈRE de la dernière écrite.
 */
export default function PWADetector({ userId }: { userId: string }) {
  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // iOS Safari
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true;

    const current = `${userId}:${isStandalone}`;

    // Safari en navigation privée jette sur localStorage : on ne veut pas
    // perdre la détection pour autant, juste le cache. Sans cache on retombe
    // sur l'ancien comportement (une écriture par montage), pas sur une panne.
    let cached: string | null = null;
    try {
      cached = window.localStorage.getItem(PWA_MODE_KEY);
    } catch {
      /* stockage indisponible */
    }
    if (cached === current) return;

    // Petit délai pour ne pas concurrencer le rendu.
    const timer = setTimeout(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from("users")
          .update({ last_is_pwa: isStandalone })
          .eq("id", userId)
          .select("id");

        // `.select()` n'est pas décoratif : sans lui, un UPDATE qui ne touche
        // AUCUNE ligne (session expirée → la RLS ne matche rien) revient sans
        // erreur. On mémoriserait alors une écriture qui n'a pas eu lieu, et
        // on ne réessaierait plus jamais. On exige donc une ligne en retour.
        if (!error && data && data.length > 0) {
          try {
            window.localStorage.setItem(PWA_MODE_KEY, current);
          } catch {
            /* stockage indisponible */
          }
        }
      } catch {
        // Silencieux : c'est de l'analytics, jamais un motif d'erreur visible.
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [userId]);

  return null;
}
