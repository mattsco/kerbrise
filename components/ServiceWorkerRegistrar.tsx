"use client";

import { useEffect } from "react";

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

    // Après le premier rendu : l'enregistrement du SW ne doit pas entrer en
    // concurrence avec le chargement de la page.
    const timer = setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch((err) => {
        // Échec non bloquant : sans SW, l'app fonctionne exactement comme
        // avant #37. On ne dérange pas l'utilisateur avec ça.
        console.error("[sw] enregistrement échoué:", err);
      });
    }, 2000);

    return () => clearTimeout(timer);
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

    // Posé à l'étape 3 (snapshot calendrier). Le retirer dès maintenant évite
    // d'avoir à se souvenir de revenir ici quand l'étape 3 arrivera.
    localStorage.removeItem("kerbrise-offline-snapshot");

    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
    }
  } catch (err) {
    console.error("[sw] purge échouée:", err);
  }
}
