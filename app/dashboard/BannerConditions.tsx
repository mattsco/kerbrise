import { getConditions } from "@/lib/conditions";
import {
  Waves,
  Droplets,
  Thermometer,
  Sunset,
  Sparkles,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

/**
 * Conditions du jour (marées + temp. eau + météo) dans la bannière contextuelle
 * (cas A/B). Reste dans la « vibe » aérée de la bannière — séparateur léger,
 * icônes d'accent discrètes, valeurs en avant, labels atténués, coef en pastille
 * douce — pas un widget encadré.
 *
 * Async server component sous <Suspense fallback={null}> : la bannière s'affiche
 * instantanément, ce bloc apparaît au retour du fetch (caché). Rend null si rien.
 */
export default async function BannerConditions({
  todayISO,
}: {
  todayISO: string;
}) {
  const { sea, tide, upcomingTides, weather } = await getConditions(todayISO);

  // Nom du mois courant (pour « mer ~14° en juin »)
  const monthLabel = new Date(`${todayISO}T12:00:00`).toLocaleDateString("fr-FR", {
    month: "long",
  });

  const hasTimes = upcomingTides.length > 0;
  const showTideRow = hasTimes || tide !== null;
  if (!showTideRow && !sea && !weather) return null;

  const delta = weather?.deltaVsNormalC;
  const deltaText =
    delta == null
      ? null
      : delta === 0
        ? "dans la normale"
        : `${delta > 0 ? "+" : ""}${delta}° vs la normale`;

  return (
    <div className="mt-3 pt-2.5 border-t border-slate-200/60 flex flex-col gap-2">
      {/* Marées */}
      {showTideRow && (
        <div className="flex items-center gap-2 text-xs">
          <Waves className="w-3.5 h-3.5 text-sky-500/80 shrink-0" />
          {hasTimes ? (
            <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
              {upcomingTides.map((t, i) => (
                <span
                  key={`${t.type}-${t.time}-${i}`}
                  className="inline-flex items-center gap-1"
                >
                  {t.type === "PM" ? (
                    <ArrowUp className="w-3 h-3 text-sky-500" />
                  ) : (
                    <ArrowDown className="w-3 h-3 text-slate-400" />
                  )}
                  <span className="font-semibold text-slate-700">{t.time}</span>
                  <span className="text-slate-400">
                    {t.type === "PM" ? "pleine" : "basse"}
                  </span>
                </span>
              ))}
            </div>
          ) : (
            <span className="text-slate-500">Marée du jour</span>
          )}
          {tide && (
            <span className="ml-auto shrink-0 text-[11px] font-medium text-sky-700 bg-sky-100/80 rounded-full px-2 py-0.5">
              coef {tide.coef}
            </span>
          )}
        </div>
      )}

      {/* Météo du jour : min/max + écart vs hier, coucher du soleil à droite */}
      {weather && (
        <div className="flex items-center gap-2 text-xs">
          <Thermometer className="w-3.5 h-3.5 text-sky-500/80 shrink-0" />
          <span className="font-semibold text-slate-700">
            {weather.minC}° / {weather.maxC}°
          </span>
          {deltaText && <span className="text-slate-400">{deltaText}</span>}
          {weather.sunset && (
            <span
              className="ml-auto shrink-0 inline-flex items-center gap-1 text-slate-500"
              title="Coucher du soleil"
            >
              <Sunset className="w-3.5 h-3.5 text-amber-500/80" />
              {weather.sunset}
            </span>
          )}
        </div>
      )}

      {/* Température de l'eau (moyenne saisonnière du mois) */}
      {sea && (
        <div className="flex items-center gap-2 text-xs">
          <Droplets className="w-3.5 h-3.5 text-sky-500/80 shrink-0" />
          <span className="text-slate-600">
            mer ~
            <span className="font-semibold text-slate-700">
              {Math.round(sea.tempC)}°
            </span>
            <span className="text-slate-400"> en {monthLabel}</span>
          </span>
        </div>
      )}

      {/* Tendance de la semaine, ton léger */}
      {weather?.weekSummary && (
        <div className="flex items-center gap-2 text-xs">
          <Sparkles className="w-3.5 h-3.5 text-amber-500/80 shrink-0" />
          <span className="text-slate-500 italic">{weather.weekSummary}</span>
        </div>
      )}
    </div>
  );
}
