import Link from "next/link";
import { Plus } from "lucide-react";
import {
  type BannerContext,
  formatEndDate,
  formatRange,
  getDaysRemaining,
  getRelativeFromNow,
  getRelayPhrase,
} from "@/lib/dashboard-banner";

type Props = {
  context: BannerContext;
  displayName: string;
};

export default function ContextualBanner({
  context,
  displayName,
}: Props) {
  const { bannerCase, currentlyAt, myFamilyNextStay, relayBooking, relayDiffDays } =
    context;

  // CAS A : Ma famille est en séjour
  if (bannerCase === "A" && currentlyAt) {
    const remaining = getDaysRemaining(currentlyAt.end_date);
    return (
      <section className="bg-gradient-to-br from-sky-50 to-blue-50 border border-sky-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          🌊 Bienvenue à Kerbrise, {displayName} !
        </p>
        <p className="text-xs text-slate-600 mt-1">
          Séjour jusqu'au {formatEndDate(currentlyAt.end_date)} ·{" "}
          {remaining === 0
            ? "dernier jour"
            : remaining === 1
            ? "plus que 1 jour"
            : `${remaining} jours restants`}
        </p>
        {relayBooking && (
          <p className="text-xs text-slate-500 italic mt-1.5">
            {getRelayPhrase(relayDiffDays, relayBooking.family_name)}
          </p>
        )}
      </section>
    );
  }

  // CAS B : Autre famille à Kerbrise
  if (bannerCase === "B" && currentlyAt) {
    return (
      <section className="bg-white border border-slate-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-900 flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full inline-block"
            style={{ backgroundColor: currentlyAt.family_color }}
          />
          {currentlyAt.family_name} est à Kerbrise
        </p>
        <p className="text-xs text-slate-600 mt-1">
          jusqu'au {formatEndDate(currentlyAt.end_date)}
        </p>
        {myFamilyNextStay && (
          <p className="text-xs text-slate-700 mt-1.5">
            <span className="font-medium">Ton prochain séjour :</span>{" "}
            {formatRange(myFamilyNextStay.start_date, myFamilyNextStay.end_date)}{" "}
            <span className="text-slate-500">
              ({getRelativeFromNow(myFamilyNextStay.start_date)})
            </span>
          </p>
        )}
      </section>
    );
  }

  // CAS D : Rien
  if (bannerCase === "D") {
    return (
      <section className="bg-white border border-slate-100 rounded-2xl p-4">
        <p className="text-sm font-semibold text-slate-900">
          🏡 Pas de prochain séjour
        </p>
        <p className="text-xs text-slate-500 mt-1">
          Pour réserver, c'est ici
        </p>
        <Link
          href="/dashboard/nouvelle-demande"
          className="mt-2.5 inline-flex items-center gap-1.5 bg-emerald-600 text-white text-xs font-medium rounded-lg px-3 py-1.5 hover:bg-emerald-700 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          Créer une demande
        </Link>
      </section>
    );
  }

  // CAS C : pas de bannière (la liste s'affiche en dessous)
  return null;
}