"use client";

import { useEffect, useState } from "react";

/**
 * Ramène l'utilisateur dans l'app dès que le réseau revient (#37).
 *
 * Sans ça, on reste coincé : `/hors-ligne` existe AUSSI côté serveur, donc
 * actualiser la page une fois reconnecté la resert à l'identique. Rien
 * n'indiquait comment en sortir, sinon retaper l'URL du dashboard.
 *
 * On ne se fie pas à `navigator.onLine` seul : il est `true` dès qu'une
 * interface réseau est active, y compris sur un wifi sans internet — c'est
 * précisément la panne de box qu'on cherche à couvrir. On sonde donc le
 * serveur pour de vrai avant de basculer.
 *
 * Chaque page hors ligne renvoie vers son équivalent en ligne : on reprend là
 * où on était, pas au dashboard.
 */
export default function OfflineAutoExit() {
  const [reconnecting, setReconnecting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function isReallyOnline(): Promise<boolean> {
      try {
        // `/sw.js` est servi en no-store : la réponse ne peut pas venir d'un
        // cache, donc un succès prouve que le serveur est joignable.
        const res = await fetch("/sw.js", {
          method: "HEAD",
          cache: "no-store",
        });
        return res.ok;
      } catch {
        return false;
      }
    }

    async function tryExit() {
      if (cancelled || !navigator.onLine) return;
      if (!(await isReallyOnline()) || cancelled) return;

      setReconnecting(true);
      // `replace` et non `assign` : la page hors ligne ne doit pas rester
      // dans l'historique, sinon « retour » y ramène.
      window.location.replace(
        window.location.pathname.replace(/^\/hors-ligne/, "/dashboard")
      );
    }

    // Au montage : on a pu arriver ici en ligne (marque-page, lien partagé).
    tryExit();

    window.addEventListener("online", tryExit);
    // `online` ne se déclenche pas quand le wifi reste connecté mais que la
    // box a repris : on resonde périodiquement, sans agressivité.
    const interval = setInterval(tryExit, 15000);

    return () => {
      cancelled = true;
      window.removeEventListener("online", tryExit);
      clearInterval(interval);
    };
  }, []);

  if (!reconnecting) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-emerald-600 text-white text-sm text-center py-2.5">
      Réseau retrouvé, retour à Kerbrise…
    </div>
  );
}
