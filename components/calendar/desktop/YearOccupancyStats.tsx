"use client";

import { useMemo } from "react";

import { FAMILIES } from "@/lib/families";
import { daysInRangeClipped, daysInRangeInclusive } from "@/lib/dates";

import type { CalendarEvent } from "../CalendarDayCell";


type Props = {
  events: CalendarEvent[];
  year: number;
};

type FamilyStat = {
  name: string;
  color: string;
  days: number;
  /** Part du total occupé (convention du tableur Excel : jours famille / total). */
  share: number;
};

/**
 * Stats d'occupation succinctes sous la grille année (#31),
 * comme le bas du planning Excel historique :
 *
 *   Occupation 2026   ● Antoine 51 j · 36 %   ● Vincent 47 j · 33 %
 *                     ● François 45 j · 31 %   Total 143 j · 39 % de l'année
 *
 * Conventions — identiques à la page Stats (cohérence inter-pages) :
 *   - séjours APPROUVÉS uniquement
 *   - comptage inclusif (arrivée + départ comptés), clippé à l'année
 *     affichée pour les séjours à cheval sur deux années
 *   - conséquence assumée : un jour pivot compte pour les 2 familles
 *   - le % par famille = part du total occupé (comme l'Excel) ;
 *     la ligne Total affiche le % de l'année (plus utile que le
 *     "100 %" du tableur)
 *
 * Réagit à la navigation d'année, ignore le filtre famille
 * (comparer les familles est sa raison d'être). Zéro query :
 * calcul client sur les events déjà chargés.
 */
export default function YearOccupancyStats({ events, year }: Props) {
  const yearStart = `${year}-01-01`;
  const yearEnd = `${year}-12-31`;

  const { stats, totalDays, yearShare } = useMemo(() => {
    const daysByFamily = new Map<string, number>();

    for (const e of events) {
      if (e.status !== "approved") continue;
      const days = daysInRangeClipped(
        e.start_date,
        e.end_date,
        yearStart,
        yearEnd
      );
      if (days === 0) continue;
      daysByFamily.set(
        e.family_name,
        (daysByFamily.get(e.family_name) ?? 0) + days
      );
    }

    const totalDays = Array.from(daysByFamily.values()).reduce(
      (sum, d) => sum + d,
      0
    );

    const stats: FamilyStat[] = FAMILIES.map((f) => {
      const days = daysByFamily.get(f.name) ?? 0;
      return {
        name: f.name,
        color: f.color,
        days,
        share: totalDays > 0 ? days / totalDays : 0,
      };
    });

    const yearShare = totalDays / daysInRangeInclusive(yearStart, yearEnd);

    return { stats, totalDays, yearShare };
  }, [events, yearStart, yearEnd]);

  // Année sans séjour approuvé (ex. année future) → pas de bruit
  if (totalDays === 0) return null;

  return (
    <section className="mt-3 bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-sm">
        <h3 className="text-xs font-semibold text-slate-900">
          Occupation {year}
        </h3>

        {stats.map((s) => (
          <span
            key={s.name}
            className="flex items-center gap-1.5 text-slate-700"
          >
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: s.color }}
            />
            {s.name}{" "}
            <span className="font-medium tabular-nums">{s.days} j</span>
            <span className="text-slate-400 tabular-nums">
              · {Math.round(s.share * 100)} %
            </span>
          </span>
        ))}

        <span className="ml-auto text-slate-900">
          Total{" "}
          <span className="font-semibold tabular-nums">{totalDays} j</span>
          <span className="text-slate-500 tabular-nums">
            {" "}
            · {Math.round(yearShare * 100)} % de l&apos;année
          </span>
        </span>
      </div>
    </section>
  );
}
