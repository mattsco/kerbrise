"use client";

import type { CalendarView } from "../../calendar-utils";


type Props = {
  view: CalendarView;
  onViewChange: (view: CalendarView) => void;
};

const VIEWS: { id: CalendarView; label: string; hint: string }[] = [
  { id: "stays", label: "Séjours", hint: "occupation par famille" },
  { id: "tides", label: "Marées", hint: "coefficient du jour" },
];

/**
 * Sélecteur de vue de la grille (#31 V2, bloc "Vue"). Recolore tout le
 * calendrier selon la métrique choisie. La légende correspondante est
 * affichée SOUS la grille (occupation en vue Séjours, paliers de
 * coefficient en vue Marées) — voir CalendarDesktopView.
 */
export default function SidepanelViewSwitcher({ view, onViewChange }: Props) {
  return (
    <section className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
      <h3 className="text-xs font-semibold text-slate-900 mb-2">Vue</h3>

      <div className="space-y-0.5">
        {VIEWS.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              onClick={() => onViewChange(v.id)}
              aria-pressed={active}
              className={`w-full flex flex-col items-start px-2 py-1.5 rounded-lg text-left transition ${
                active
                  ? "bg-white shadow-sm ring-1 ring-slate-200 text-slate-900"
                  : "hover:bg-white/70 text-slate-700"
              }`}
            >
              <span className={`text-sm ${active ? "font-medium" : ""}`}>
                {v.label}
              </span>
              <span className="text-[10px] text-slate-400">{v.hint}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
