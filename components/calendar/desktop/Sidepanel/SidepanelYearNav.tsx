"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";


type Props = {
  year: number;
  currentYear: number;
  onYearChange: (year: number) => void;
};

/**
 * Navigation par année (#31, block 2) : ← 2026 →
 * + raccourci "Aujourd'hui" quand on s'est éloigné de l'année courante.
 */
export default function SidepanelYearNav({
  year,
  currentYear,
  onYearChange,
}: Props) {
  return (
    <section className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => onYearChange(year - 1)}
          aria-label="Année précédente"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 transition"
        >
          <ChevronLeft size={16} />
        </button>

        <span className="text-base font-bold text-slate-900 tabular-nums">
          {year}
        </span>

        <button
          onClick={() => onYearChange(year + 1)}
          aria-label="Année suivante"
          className="p-1.5 rounded-lg text-slate-500 hover:bg-white hover:text-slate-900 transition"
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
