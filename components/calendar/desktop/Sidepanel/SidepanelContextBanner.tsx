"use client";

import {
  type BannerContext,
  formatEndDate,
  getDaysRemaining,
  getRelayPhrase,
  getRelativeFromNow,
} from "@/lib/dashboard-banner";


type Props = {
  context: BannerContext;
  onNewBooking: () => void;
};

/**
 * Bannière contextuelle compacte (#31, block 4).
 *
 * Réutilise la LOGIQUE du dashboard (`computeBannerContext`), pas son
 * composant : ici pas de displayName, espace réduit, ton télégraphique.
 *
 *   A — ma famille est sur place      → jours restants + relais éventuel
 *   B — une autre famille est sur place → qui + jusqu'à quand
 *   C — personne sur place, j'ai un prochain séjour → rien
 *       ("Mes prochains séjours" juste en dessous couvre déjà ce cas)
 *   D — personne sur place, aucun séjour à moi → invite à réserver
 */
export default function SidepanelContextBanner({
  context,
  onNewBooking,
}: Props) {
  const { bannerCase, currentlyAt, myFamilyNextStay, relayBooking, relayDiffDays } =
    context;

  if (bannerCase === "C") return null;

  // ── Cas A : ta famille est à Kerbrise ────────────────────────────
  if (bannerCase === "A" && currentlyAt) {
    const remaining = getDaysRemaining(currentlyAt.end_date);
    return (
      <section className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-sm">
        <p className="font-semibold text-blue-900">
          🌊 Ta famille est à Kerbrise
        </p>
        <p className="mt-1 text-blue-800">
          Jusqu&apos;au {formatEndDate(currentlyAt.end_date)}
          {remaining > 0 && (
            <span className="text-blue-600">
              {" "}
              · {remaining} jour{remaining > 1 ? "s" : ""} restant
              {remaining > 1 ? "s" : ""}
            </span>
          )}
        </p>
        {relayBooking && (
          <p className="mt-1 text-xs text-blue-700">
            {getRelayPhrase(relayDiffDays, relayBooking.family_name)}
          </p>
        )}
      </section>
    );
  }

  // ── Cas B : une autre famille est sur place ──────────────────────
  if (bannerCase === "B" && currentlyAt) {
    return (
      <section className="bg-slate-50/80 border border-slate-100 rounded-xl p-3 text-sm">
        <p className="font-semibold text-slate-900 flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: currentlyAt.family_color }}
          />
          {currentlyAt.family_name} est à Kerbrise
        </p>
        <p className="mt-1 text-slate-600">
          Jusqu&apos;au {formatEndDate(currentlyAt.end_date)}
        </p>
        {myFamilyNextStay && (
          <p className="mt-1 text-xs text-slate-500">
            Ton prochain séjour :{" "}
            {getRelativeFromNow(myFamilyNextStay.start_date)}
          </p>
        )}
      </section>
    );
  }

  // ── Cas D : aucun séjour à venir pour ta famille ─────────────────
  return (
    <section className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-sm">
      <p className="font-semibold text-amber-900">
        🏡 Pas de prochain séjour
      </p>
      <p className="mt-1 text-amber-800 text-xs">
        Ta famille n&apos;a rien de prévu à Kerbrise.
      </p>
      <button
        onClick={onNewBooking}
        className="mt-2 text-xs font-medium text-amber-900 underline underline-offset-2 hover:text-amber-700"
      >
        Réserver des dates →
      </button>
    </section>
  );
}
