"use client";

import { useEffect, useState } from "react";
import { Waves, ArrowUp, ArrowDown } from "lucide-react";
import {
  getOfflineTides,
  upcomingTides,
  parisNowMinutes,
  type TideTime,
} from "@/lib/tides-times";
import { getTideDay, tideLevel } from "@/lib/tides";
import { todayInParis } from "@/lib/dates";

/**
 * Marées du jour hors ligne — reprend la grammaire de `BannerConditions`
 * (ligne compacte, icône d'accent, valeurs en avant, coef en pastille), pour
 * qu'on ne se sente pas dans une autre app.
 *
 * Différence assumée avec la bannière : celle-ci vit dans un encart, faute de
 * bannière contextuelle hors ligne. Le contenu et la sélection des marées sont
 * en revanche exactement les mêmes — `upcomingTides` est partagé (lib/
 * tides-times.ts) plutôt que recopié, pour que les deux ne divergent jamais.
 *
 * ⚠️ Calculé APRÈS le montage, jamais au rendu serveur : ce HTML est figé dans
 * le cache le jour du précache, un rendu serveur afficherait donc les marées de
 * ce jour-là comme celles d'aujourd'hui.
 */
export default function OfflineTides() {
  const state = useTideState();

  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4">
      <div className="flex items-center gap-2 text-xs">
        <Waves className="w-3.5 h-3.5 text-sky-500/80 shrink-0" />

        {state === null ? (
          <span className="text-slate-400">Marées du jour…</span>
        ) : state.tides.length > 0 ? (
          <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
            {state.tides.map((t, i) => (
              <TideItem key={`${t.type}-${t.time}-${i}`} tide={t} />
            ))}
          </div>
        ) : (
          <span className="text-slate-500">
            Horaires indisponibles pour cette année
          </span>
        )}

        {state?.coef != null && (
          <span className="ml-auto shrink-0 text-[11px] font-medium text-sky-700 bg-sky-100/80 rounded-full px-2 py-0.5">
            coef {state.coef}
          </span>
        )}
      </div>

      {state?.coef != null && (
        <p className="text-[11px] text-slate-400 mt-2">
          {tideLevel(state.coef).label} · Saint-Malo
        </p>
      )}
    </div>
  );
}

function TideItem({ tide }: { tide: TideTime }) {
  return (
    <span className="inline-flex items-center gap-1">
      {tide.type === "PM" ? (
        <ArrowUp className="w-3 h-3 text-sky-500" />
      ) : (
        <ArrowDown className="w-3 h-3 text-slate-400" />
      )}
      <span className="font-semibold text-slate-700">{tide.time}</span>
      <span className="text-slate-400">
        {tide.type === "PM" ? "pleine" : "basse"}
      </span>
    </span>
  );
}

type TideState = { tides: TideTime[]; coef: number | null };

/**
 * Recalcule au montage, puis toutes les 5 minutes : contrairement aux autres
 * cartes, « les 2 prochaines marées » change plusieurs fois par jour, pas
 * seulement à minuit. Une PWA laissée ouverte sur un téléphone afficherait
 * sinon des marées déjà passées.
 */
function useTideState(): TideState | null {
  const [state, setState] = useState<TideState | null>(null);

  useEffect(() => {
    function refresh() {
      const iso = todayInParis();
      const data = getOfflineTides(iso);
      const [y, m, d] = iso.split("-").map(Number);
      const day = getTideDay(y, m - 1, d);
      setState({
        tides: upcomingTides(data, parisNowMinutes()),
        coef: day?.coef ?? null,
      });
    }

    refresh();
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return state;
}
