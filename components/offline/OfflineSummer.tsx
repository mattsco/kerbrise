"use client";

import { useEffect, useState } from "react";
import {
  SUMMER_PERIODS,
  getRelevantSummerYear,
  getYearPriorities,
  getPeriodRangeLabel,
  isSummerYearConfigured,
} from "@/lib/summer-priorities";

/**
 * Rotation et priorités d'été, recalculées côté client (spec #37).
 *
 * ⚠️ Client et non serveur : l'année pertinente bascule au 1er octobre
 * (getRelevantSummerYear). Rendu au précache, un HTML de septembre annoncerait
 * encore l'été courant en plein mois d'octobre.
 */
export default function OfflineSummer() {
  const year = useRelevantYear();

  if (year === null) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <p className="text-sm text-slate-400">Calcul en cours…</p>
      </div>
    );
  }

  // Une année d'été n'a pas forcément de date de début votée : sans elle, on
  // n'invente pas de période (cf. isSummerYearConfigured).
  if (!isSummerYearConfigured(year)) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 p-4">
        <h2 className="text-sm font-semibold text-slate-900">Été {year}</h2>
        <p className="text-sm text-slate-500 mt-1">
          Les dates des périodes ne sont pas encore votées.
        </p>
      </div>
    );
  }

  const priorities = getYearPriorities(year);

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          ☀️ Périodes de l&apos;été {year}
        </h2>
        <div className="space-y-1.5">
          {SUMMER_PERIODS.map((period) => (
            <div
              key={period.id}
              className="flex items-baseline justify-between gap-2"
            >
              <span className="text-xs font-medium text-slate-700 shrink-0">
                {period.label}
              </span>
              <span className="text-xs text-slate-500 text-right">
                {getPeriodRangeLabel(year, period)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Ordre de priorité {year}
        </h2>
        <div className="space-y-1.5">
          {([1, 2, 3] as const).map((rank) => (
            <div key={rank} className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold flex items-center justify-center shrink-0">
                {rank}
              </span>
              <span className="text-sm text-slate-700">{priorities[rank]}</span>
            </div>
          ))}
        </div>
        <p className="text-[11px] text-slate-400 pt-0.5">
          La rotation avance d&apos;un cran chaque année.
        </p>
      </div>
    </div>
  );
}

/** Recalculé au montage puis à minuit — la bascule du 1er octobre en dépend. */
function useRelevantYear(): number | null {
  const [year, setYear] = useState<number | null>(null);

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function refresh() {
      setYear(getRelevantSummerYear());
      const now = new Date();
      const nextMidnight = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() + 1,
        0,
        0,
        1
      );
      timeoutId = setTimeout(refresh, nextMidnight.getTime() - now.getTime());
    }

    refresh();
    return () => clearTimeout(timeoutId);
  }, []);

  return year;
}
