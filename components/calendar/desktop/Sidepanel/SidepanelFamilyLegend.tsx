"use client";

import { FAMILIES, type FamilyName } from "@/lib/families";


type Props = {
  filterFamily: FamilyName | null;
  onToggleFamily: (name: FamilyName) => void;
};

/**
 * Légende des familles, cliquable → filtre la grille (#31, block 1).
 * Re-cliquer la famille active (ou "Tout afficher") retire le filtre.
 */
export default function SidepanelFamilyLegend({
  filterFamily,
  onToggleFamily,
}: Props) {
  return (
    <section className="bg-slate-50/80 border border-slate-100 rounded-xl p-3">
      <h3 className="text-xs font-semibold text-slate-900 mb-2">
        Familles{" "}
        <span className="font-normal text-slate-400">· clique pour filtrer</span>
      </h3>

      <div className="space-y-0.5">
        {FAMILIES.map((f) => {
          const active = filterFamily === f.name;
          const dimmed = filterFamily !== null && !active;
          return (
            <button
              key={f.name}
              onClick={() => onToggleFamily(f.name)}
              aria-pressed={active}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition ${
                active
                  ? "bg-white shadow-sm ring-1 ring-slate-200 font-medium text-slate-900"
                  : "hover:bg-white/70 text-slate-700"
              } ${dimmed ? "opacity-40" : ""}`}
            >
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: f.color }}
              />
              {f.name}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-2 px-2 pt-2 text-xs text-slate-500">
        <span className="w-3 h-3 rounded-full border-2 border-dashed border-slate-400 shrink-0" />
        En attente
      </div>

      {filterFamily && (
        <button
          onClick={() => onToggleFamily(filterFamily)}
          className="mt-2 w-full text-xs text-blue-600 hover:underline text-left px-2"
        >
          ✕ Tout afficher
        </button>
      )}
    </section>
  );
}
