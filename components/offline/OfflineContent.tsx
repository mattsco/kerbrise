"use client";

import { useEffect, useState } from "react";
import { getOfflineTides } from "@/lib/tides-times";
import { getTideDay, tideLevel } from "@/lib/tides";
import { todayInParis } from "@/lib/dates";
import {
  SUMMER_PERIODS,
  getRelevantSummerYear,
  getYearPriorities,
  getPeriodRangeLabel,
  isSummerYearConfigured,
} from "@/lib/summer-priorities";
import NextCollections from "@/app/dashboard/a-propos/NextCollections";

/**
 * Contenu de la page hors ligne — étape 2 de la spec #37.
 *
 * ⚠️ Tout est calculé APRÈS le montage, jamais au rendu serveur.
 *
 * Le HTML de cette page est figé dans le cache du service worker le jour de
 * son installation. Rendre les marées côté serveur reviendrait donc à afficher
 * les marées de ce jour-là comme si c'étaient celles d'aujourd'hui — une donnée
 * fausse et parfaitement crédible, exactement ce que la spec cherche à éviter
 * sur le calendrier.
 *
 * Conséquence assumée : sans JavaScript, l'utilisateur voit des tirets et une
 * explication plutôt que des chiffres. C'est le bon échec — on préfère ne rien
 * dire que mentir sur une heure de marée.
 *
 * Les données viennent de `lib/` (pur, committé, testé) : zéro réseau.
 */
export default function OfflineContent() {
  const data = useClientDay();

  if (!data) return <LoadingCards />;

  return (
    <div className="space-y-3">
      <TidesCard iso={data.iso} />
      <NextCollections />
      <SummerCard year={data.summerYear} />
    </div>
  );
}

/**
 * Calcule le jour courant côté client uniquement, et le recalcule au passage
 * de minuit (une PWA reste ouverte des jours sur un téléphone).
 */
function useClientDay() {
  const [data, setData] = useState<{ iso: string; summerYear: number } | null>(
    null
  );

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;

    function refresh() {
      setData({
        iso: todayInParis(),
        summerYear: getRelevantSummerYear(),
      });

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

  return data;
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-2">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      {children}
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="space-y-3">
      <Card title="🌊 Marées du jour">
        <p className="text-sm text-slate-400">Calcul en cours…</p>
      </Card>
    </div>
  );
}

function TidesCard({ iso }: { iso: string }) {
  const tides = getOfflineTides(iso);
  const [y, m, d] = iso.split("-").map(Number);
  const day = getTideDay(y, m - 1, d);
  const events = tides?.days[0]?.events ?? [];

  return (
    <Card title="🌊 Marées du jour">
      {events.length === 0 ? (
        <p className="text-sm text-slate-500">
          Horaires non disponibles pour cette année. Les données de marée sont
          committées année par année.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {events.map((e, i) => (
              <div
                key={i}
                className="rounded-xl border border-slate-200 bg-slate-50 p-2.5"
              >
                <p className="text-[11px] text-slate-500">
                  {e.type === "PM" ? "Pleine mer" : "Basse mer"}
                </p>
                <p className="font-bold text-slate-900 text-base leading-tight">
                  {e.time}
                </p>
                {e.height !== null && (
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {e.height} m
                  </p>
                )}
              </div>
            ))}
          </div>

          {day && (
            <div className="flex items-center gap-2 pt-1">
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  backgroundColor: tideLevel(day.coef).bg,
                  color: tideLevel(day.coef).text,
                }}
              >
                coef {day.coef}
              </span>
              <span className="text-[11px] text-slate-500">
                {tideLevel(day.coef).label}
              </span>
            </div>
          )}
        </>
      )}
      <p className="text-[10px] text-slate-500 italic pt-0.5">
        Saint-Malo · horaires locaux
      </p>
    </Card>
  );
}

function SummerCard({ year }: { year: number }) {
  // L'année d'été n'a pas forcément de date de début votée (cf.
  // SUMMER_PERIOD_1_START) : sans elle, on n'invente pas de période.
  if (!isSummerYearConfigured(year)) {
    return (
      <Card title={`☀️ Été ${year}`}>
        <p className="text-sm text-slate-500">
          Les dates des périodes ne sont pas encore votées pour {year}.
        </p>
      </Card>
    );
  }

  const priorities = getYearPriorities(year);

  return (
    <Card title={`☀️ Rotation été ${year}`}>
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

      <div className="pt-1.5 border-t border-slate-100">
        <p className="text-[11px] text-slate-500 mb-1">Ordre de priorité</p>
        <div className="flex flex-wrap gap-1.5">
          {([1, 2, 3] as const).map((rank) => (
            <span
              key={rank}
              className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700"
            >
              {rank}. {priorities[rank]}
            </span>
          ))}
        </div>
      </div>
    </Card>
  );
}
