import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  getYearPriorities,
  getFamilyPriority,
  getRelevantSummerYear,
} from "@/lib/summer-priorities";
import { getPontPriorityFamily } from "@/lib/ponts";
import { getSummerSnapshot } from "@/lib/summer-state";
import { FAMILY_NAMES, getFamilyColor, type FamilyName } from "@/lib/families";

function isKnownFamily(name: string): name is FamilyName {
  return (FAMILY_NAMES as readonly string[]).includes(name);
}

/**
 * Carte explicative de la priorité de l'année dans le Profil.
 *
 * Server component : calcule l'année pertinente (bascule 1er octobre, via
 * getRelevantSummerYear) puis fait UN round-trip DB (getSummerSnapshot) pour
 * savoir quelles périodes d'été sont déjà choisies — nécessaire au bloc
 * juin/septembre.
 *
 * Tout est indexé sur une seule année Y (l'été pertinent). Le pont concerné
 * est celui de mai Y, et c'est la famille en priorité 3 de l'été Y qui a la
 * priorité dessus (compensation).
 *
 * Purement informatif : aucune de ces règles n'est appliquée dans le
 * calendrier (décision PO, le calendrier reste flexible).
 */
export default async function PriorityCard({
  familyName,
}: {
  familyName: string;
}) {
  // Famille inconnue / non renseignée → on n'affiche rien.
  if (!isKnownFamily(familyName)) return null;

  const year = getRelevantSummerYear();
  const priority = getFamilyPriority(year, familyName); // 1 | 2 | 3 | null
  if (!priority) return null;

  const priorities = getYearPriorities(year);
  const pontFamily = getPontPriorityFamily(year); // règle unique (#38), = P3 de l'été Y
  const familyColor = getFamilyColor(familyName);

  // --- Bloc été ---------------------------------------------------------
  let eteSentence: string;
  if (priority === 1) {
    eteSentence = "tu choisis ta période en premier.";
  } else if (priority === 2) {
    eteSentence = `tu choisis ta période après ${priorities[1]}.`;
  } else {
    eteSentence = `tu choisis ta période après ${priorities[1]} et ${priorities[2]}.`;
  }

  // --- Bloc pont du printemps ------------------------------------------
  const pontSentence =
    familyName === pontFamily
      ? `Tu as la priorité pour choisir le pont de mai ${year} (en compensation de ta priorité 3 pour l'été).`
      : `${pontFamily} a la priorité pour choisir le pont de mai ${year} (compensation de sa priorité 3 pour l'été).`;

  // --- Bloc juin/septembre ---------------------------------------------
  // Restrictions des familles qui occupent P1 et P3 (la P2 n'a aucune
  // contrainte). Chaque ligne n'apparaît que si la période correspondante
  // est déjà choisie. Avant que les choix d'été ne soient saisis (ex. années
  // sans réservation de période), aucune ligne ne s'affiche.
  const snapshot = await getSummerSnapshot(year);

  const juinSeptLines: { key: string; text: string }[] = [];

  const p1 = snapshot.periods[1];
  if (p1.state === "taken") {
    juinSeptLines.push({
      key: "p1",
      text:
        p1.familyName === familyName
          ? "Tu occupes la Période 1 (début juillet) : tu n'as donc pas la priorité sur la 2e quinzaine de juin."
          : `${p1.familyName} occupe la Période 1 (début juillet) : pas de priorité sur la 2e quinzaine de juin.`,
    });
  }

  const p3 = snapshot.periods[3];
  if (p3.state === "taken") {
    juinSeptLines.push({
      key: "p3",
      text:
        p3.familyName === familyName
          ? "Tu occupes la Période 3 (fin août) : tu n'as donc pas la priorité sur la 1re quinzaine de septembre."
          : `${p3.familyName} occupe la Période 3 (fin août) : pas de priorité sur la 1re quinzaine de septembre.`,
    });
  }

  return (
    <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🌞</span>
        <h2 className="text-base font-semibold text-slate-900">
          Ta priorité été {year}
        </h2>
      </div>

      {/* Bloc été — priorité mise en avant avec la couleur de la famille */}
      <div
        className="rounded-xl p-3"
        style={{ backgroundColor: familyColor + "20" }}
      >
        <p className="text-sm text-slate-800 leading-relaxed">
          <strong>Priorité {priority}.</strong> Pour l'été {year}, {eteSentence}
        </p>
      </div>

      {/* Bloc pont du printemps */}
      <p className="text-sm text-slate-700 leading-relaxed">
        🌸 {pontSentence}
      </p>

      {/* Bloc juin/septembre (conditionnel, une ligne par période choisie) */}
      {juinSeptLines.map(({ key, text }) => (
        <p key={key} className="text-sm text-slate-700 leading-relaxed">
          🌷 {text}
        </p>
      ))}

      <Link
        href="/dashboard/a-propos/regles"
        className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition pt-1"
      >
        Voir le règlement complet
        <ArrowRight className="w-3 h-3" />
      </Link>
    </section>
  );
}
