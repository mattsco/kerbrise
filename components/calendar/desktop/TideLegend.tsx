"use client";

import { TIDE_SCALE, TIDE_YEARS } from "@/lib/tides";


type Props = { year: number };

/**
 * Légende des coefficients de marée, sous la grille année, en vue "Marées"
 * (#31 V2). Occupe le même emplacement et le même style que
 * YearOccupancyStats (affichée en vue "Séjours") pour une bascule sans
 * saut visuel. Lecture gauche → droite : morte-eau (clair) vers grande
 * marée (foncé).
 */
export default function TideLegend({ year }: Props) {
  const hasData = TIDE_YEARS.includes(year);
  const scale = [...TIDE_SCALE].reverse();

  return (
    <section className="mt-3 bg-slate-50/80 border border-slate-100 rounded-xl px-4 py-2.5">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm">
        <h3 className="text-xs font-semibold text-slate-900">
          Coefficient de marée {year}
        </h3>

        {scale.map((l) => (
          <span
            key={l.min}
            className="flex items-center gap-1.5 text-slate-700"
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0 border border-black/5"
              style={{ backgroundColor: l.bg }}
            />
            {l.label}
          </span>
        ))}

        {!hasData && (
          <span className="ml-auto text-xs text-slate-400">
            Pas de données pour {year}
          </span>
        )}
      </div>
    </section>
  );
}
