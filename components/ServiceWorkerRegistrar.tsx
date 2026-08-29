"use client";

import { useEffect } from "react";
import { runWhenIdle } from "@/lib/idle";
import { PROFIL_KEY, SNAPSHOT_KEY } from "@/lib/offline-snapshot";
import { PWA_MODE_KEY } from "./PWADetector";

/**
 * Enregistre le service worker — uniquement depuis le dashboard, donc
 * uniquement une fois l'utilisateur authentifié (spec #37, décision 6).
 *
 * Conséquence assumée : un appareil qui ne s'est jamais connecté n'a pas
 * d'offline. C'est le bon défaut — il n'y aurait de toute façon rien de local
 * à lui montrer.
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    // Après le `load` ET une fois le navigateur inactif : le précache (~800 Ko)
    // ne doit jamais concurrencer l'affichage des pages en ligne, qui restent
    // prioritaires. Un simple setTimeout se serait déclenché en plein
    // chargement sur une connexion lente.
    return runWhenIdle(() => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Échec non bloquant : sans SW, l'app fonctionne exactement comme
        // avant #37. On ne dérange pas l'utilisateur avec ça.
        console.error("[sw] enregistrement échoué:", err);
      });
    });
  }, []);

  return null;
}

/**
 * Efface tout ce que l'offline a laissé sur l'appareil : caches du SW,
 * snapshot applicatif, et le SW lui-même.
 *
 * Appelé à la déconnexion. Sans ça, un appareil déconnecté garderait le mot
 * de passe wifi et les dates de séjours consultables hors ligne — la
 * décision n°1 accepte ce contenu en clair sur un appareil *authentifié*,
 * pas au-delà.
 */
export async function purgeOfflineData() {
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("kerbrise-offline-"))
          .map((k) => caches.delete(k))
      );
    }

    // Les deux snapshots applicatifs : calendrier et profil. Sans ça, un
    // appareil déconnecté garderait les dates de séjours ET le prénom, l'email
    // et les rôles du dernier utilisateur.
    localStorage.removeItem(SNAPSHOT_KEY);
    localStorage.removeItem(PROFIL_KEY);

    // Le cache anti-réécriture de PWADetector contient l'id du dernier
    // utilisateur : même traitement que le reste, il ne survit pas à la
    // déconnexion.
    localStorage.removeItem(PWA_MODE_KEY);

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (err) {
    console.error("[sw] purge échouée:", err);
  }
}
