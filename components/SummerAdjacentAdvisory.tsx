"use client";

// Encart advisory « quinzaines de juin / septembre » (#39) — purement
// informatif, JAMAIS bloquant. Réutilisé par NewBookingForm (vue demandeur) et
// BookingDetailModal (vue validateur), comme PontAdvisory pour #38.
//
// Emoji : 🌷 pour la fenêtre juin, 🍂 pour la fenêtre septembre — l'emoji porte
// la saison, le message s'identifie d'un coup d'œil (même convention dans
// components/profil/PriorityCard.tsx).
//
// ⚠️ La règle ne désigne aucune famille prioritaire sur ces quinzaines : la
// copie dit « tu n'es pas prioritaire », jamais « attends que X choisisse ».

import type { AdjacentAdvisory } from "@/lib/summer-adjacent";
import { AdvisoryCard } from "./AdvisoryCard";

const EMOJI = { pre: "🌷", post: "🍂" } as const;

/** Vue demandeur — s'affiche seulement à la famille détentrice de la période. */
export function SummerAdjacentAdvisoryForm({
  advisory,
}: {
  advisory: AdjacentAdvisory | null;
}) {
  if (!advisory) return null;
  const { window } = advisory;

  // Fragments variables sortis en chaînes complètes : une expression JSX suivie
  // de texte sur la même ligne perd son espace de séparation au rendu.
  const qui = window.kind === "pre" ? "qui précèdent" : "qui suivent";

  return (
    <AdvisoryCard>
      <p className="leading-relaxed">
        {EMOJI[window.kind]}{" "}Ta famille occupe la{" "}
        <strong>{window.periodLabel}</strong> ({window.periodRange}). Ces dates
        couvrent les <strong>2 semaines</strong> {qui}{" "}ta période : tu n&apos;es
        pas prioritaire dessus, pour éviter d&apos;enchaîner 5 semaines
        d&apos;affilée. Ta demande reste possible — elle sera soumise à
        validation comme d&apos;habitude.
      </p>
    </AdvisoryCard>
  );
}

/** Vue validateur — faits bruts, aucune reco d'accepter/refuser. */
export function SummerAdjacentAdvisoryValidator({
  advisory,
}: {
  advisory: AdjacentAdvisory | null;
}) {
  if (!advisory) return null;
  const { window, familyName } = advisory;

  const precedantSuivant = window.kind === "pre" ? "précédant" : "suivant";

  return (
    <AdvisoryCard>
      <p className="leading-relaxed">
        {EMOJI[window.kind]}{" "}Ce séjour couvre les 2 semaines{" "}
        {precedantSuivant}{" "}la <strong>{window.periodLabel}</strong> (
        {window.periodRange}), occupée par <strong>{familyName}</strong> — qui
        n&apos;est pas prioritaire sur cette quinzaine.
      </p>
    </AdvisoryCard>
  );
}
