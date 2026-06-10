"use client";

import {
  type UpcomingBooking,
  formatRange,
  getRelativeFromNow,
} from "@/lib/dashboard-banner";

import { todayISO } from "@/lib/dates";


type Props = {
  stays: UpcomingBooking[];
};

/**
 * "Mes prochains séjours" (#31, block 5) : liste compacte, max 3,
 * uniquement les séjours approuvés de MA famille.
 *
 * Guard "en cours" : getRelativeFromNow() rendrait "dans -3 jours"
 * pour un séjour déjà commencé — on court-circuite.
 */
export default function SidepanelMyStays({ stays }: Props) {
  if (stays.length === 0) return null;

  const todayStr = todayISO();

  return (
    <section className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
      <h3 className="text-xs font-semibold text-slate-900 mb-2">
        Mes prochains séjours
      </h3>
      <ul className="space-y-1.5">
        {stays.map((s) => (
          <li
            key={s.id}
            className="flex items-center gap-2 text-xs text-slate-700"
          >
            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: s.family_color }}
            />
            <span className="font-medium tabular-nums">
              {formatRange(s.start_date, s.end_date)}
            </span>
            <span className="ml-auto text-slate-400">
              {s.start_date <= todayStr
                ? "en cours"
                : getRelativeFromNow(s.start_date)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
