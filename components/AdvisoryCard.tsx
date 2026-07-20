"use client";

// Coquille visuelle partagée des encarts advisory (#38 ponts de mai,
// #39 quinzaines juin/septembre) — ambre, alignée sur l'encart période d'été.
// Purement informatif : ces encarts ne bloquent JAMAIS l'envoi d'une demande.
//
// Seul le style est partagé : chaque règle garde son composant, sa copie et ses
// props (les fusionner reviendrait à mélanger deux règles distinctes, qui
// peuvent d'ailleurs s'afficher en même temps).
//
// ⚠️ En écrivant la copie : une expression JSX suivie d'un espace puis de texte
// sur la même ligne PERD son espace au rendu (« qui suiventta période »).
// Utiliser {" "} à chaque jonction expression→texte.
// Détails et autres pièges : docs/guides/pieges-connus.md

import type { ReactNode } from "react";

export const ADVISORY_CARD_CLASS =
  "bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1.5 text-xs text-amber-900";

export function AdvisoryCard({ children }: { children: ReactNode }) {
  return <div className={ADVISORY_CARD_CLASS}>{children}</div>;
}
