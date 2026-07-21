"use client";

import { useEffect, useState } from "react";
import { getFamilyColor, isKnownFamily } from "@/lib/families";
import {
  getFamilyPriority,
  getRelevantSummerYear,
  getYearPriorities,
} from "@/lib/summer-priorities";
import { getPontPriorityFamily } from "@/lib/ponts";
import { SNAPSHOT_KEY, parseSnapshot } from "@/lib/offline-snapshot";

/**
 * Profil hors ligne (#37).
 *
 * On ne montre que ce qui est VRAI sans réseau : le nom de famille vient du
 * snapshot, et tout le reste s'en déduit par calcul pur (priorité été,
 * priorité du pont de mai — mêmes fonctions que `PriorityCard` en ligne).
 *
 * Volontairement absents : le nom d'affichage, l'e-mail et les compteurs de
 * séjours. Ils ne sont pas dans le snapshot, et les inventer ou les figer
 * dans le HTML mis en cache afficherait les infos du dernier connecté à toute
 * la famille.
 */
export default function OfflineProfil() {
  const state = useProfilState();

  if (state === undefined) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-sm text-slate-400">Lecture du profil…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-5 text-center space-y-1.5">
        <p className="text-sm font-semibold text-slate-900">
          Profil indisponible
        </p>
        <p className="text-xs text-slate-500">
          Ouvre Kerbrise une fois avec du réseau : ta famille sera alors connue
          hors ligne.
        </p>
      </div>
    );
  }

  const { familyName, year, priority, priorities, pontFamily } = state;
  const color = getFamilyColor(familyName);

  const eteSentence =
    priority === 1
      ? "tu choisis ta période en premier."
      : priority === 2
        ? `tu choisis ta période après ${priorities[1]}.`
        : `tu choisis ta période après ${priorities[1]} et ${priorities[2]}.`;

  const pontSentence =
    familyName === pontFamily
      ? `Tu as la priorité pour choisir le pont de mai ${year} (en compensation de ta priorité 3 pour l'été).`
      : `${pontFamily} a la priorité pour choisir le pont de mai ${year} (compensation de sa priorité 3 pour l'été).`;

  return (
    <div className="space-y-3">
      <section className="bg-white rounded-2xl border border-slate-100 p-5">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: color }}
          />
          <p className="text-sm text-slate-700">
            Famille <strong className="text-slate-900">{familyName}</strong>
          </p>
        </div>
      </section>

      <section className="bg-white rounded-2xl border border-slate-100 p-5 space-y-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🌞</span>
          <h2 className="text-base font-semibold text-slate-900">
            Ta priorité été {year}
          </h2>
        </div>

        <div
          className="rounded-xl p-3"
          style={{ backgroundColor: color + "20" }}
        >
          <p className="text-sm text-slate-800 leading-relaxed">
            <strong>Priorité {priority}.</strong> Pour l&apos;été {year},{" "}
            {eteSentence}
          </p>
        </div>

        <p className="text-sm text-slate-700 leading-relaxed">
          🌸 {pontSentence}
        </p>

        <a
          href="/hors-ligne/a-propos/regles"
          className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700 transition pt-1"
        >
          Voir les règles
        </a>
      </section>
    </div>
  );
}

type ProfilState = {
  familyName: string;
  year: number;
  priority: number;
  priorities: { 1: string; 2: string; 3: string };
  pontFamily: string;
};

/** `undefined` = pas encore lu, `null` = rien d'exploitable. */
function useProfilState(): ProfilState | null | undefined {
  const [state, setState] = useState<ProfilState | null | undefined>(undefined);

  useEffect(() => {
    try {
      const snapshot = parseSnapshot(localStorage.getItem(SNAPSHOT_KEY));
      const familyName = snapshot?.familyName;
      if (!familyName || !isKnownFamily(familyName)) {
        setState(null);
        return;
      }

      const year = getRelevantSummerYear();
      const priority = getFamilyPriority(year, familyName);
      if (!priority) {
        setState(null);
        return;
      }

      setState({
        familyName,
        year,
        priority,
        priorities: getYearPriorities(year),
        pontFamily: getPontPriorityFamily(year),
      });
    } catch {
      setState(null);
    }
  }, []);

  return state;
}
