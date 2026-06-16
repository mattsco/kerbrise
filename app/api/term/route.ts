import { NextResponse } from "next/server";
import { getConditions } from "@/lib/conditions";
import { todayInParis } from "@/lib/dates";

/**
 * GET /api/term — JSON des conditions du jour (#26) pour le TRMNL.
 *
 * Sous-ensemble MVP de la spec `docs/specs/trmnl-sejour-display.md` : ici on
 * n'expose QUE les conditions (marées, mer, météo), données **non sensibles** →
 * endpoint public, pas de token. L'endpoint complet spécifié (`/api/trmnl/screen`,
 * avec séjour + WiFi + switch d'écrans) reste à faire et DEVRA, lui, être protégé
 * par `Authorization: Bearer` (il exposerait présence + mot de passe WiFi).
 *
 * Labels pré-formatés côté serveur (le template Liquid TRMNL ne fait que afficher).
 * Tout bloc dont la source est en panne vaut `null` → bloc masqué, jamais de 500.
 */

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";

function fmt(opts: Intl.DateTimeFormatOptions, d: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts }).format(d);
}

export async function GET() {
  const today = todayInParis();
  const { sea, tide, upcomingTides, todayTides, weather } =
    await getConditions(today);

  const highs = todayTides.filter((t) => t.type === "PM").map((t) => t.time);
  const lows = todayTides.filter((t) => t.type === "BM").map((t) => t.time);

  const label = (type: "PM" | "BM") => (type === "PM" ? "haute" : "basse");
  let nextLabel: string | null = null;
  if (upcomingTides.length >= 2) {
    const [a, b] = upcomingTides;
    nextLabel = `Prochaine marée : ${label(a.type)} ${a.time} puis ${label(b.type)} ${b.time}`;
  } else if (upcomingTides.length === 1) {
    const a = upcomingTides[0];
    nextLabel = `Prochaine marée : ${label(a.type)} ${a.time}`;
  }

  const delta = weather?.deltaMaxC;
  const deltaLabel =
    delta == null
      ? null
      : delta === 0
        ? "comme hier"
        : `${delta > 0 ? "+" : ""}${delta}° vs hier`;

  const monthLabel = fmt({ month: "long" });
  const seaTemp = sea ? Math.round(sea.tempC) : null;

  const payload = {
    generated_at: new Date().toISOString(),
    generated_at_label: `${fmt({ weekday: "short", day: "numeric", month: "long" })} · ${fmt({ hour: "2-digit", minute: "2-digit" })}`,

    sea:
      seaTemp === null
        ? null
        : {
            temp_c: seaTemp,
            month_label: monthLabel,
            label: `Mer ~${seaTemp}° en ${monthLabel}`,
            note: "moyenne saisonnière",
          },

    weather: weather
      ? {
          min_c: weather.minC,
          max_c: weather.maxC,
          temp_label: `${weather.minC}° / ${weather.maxC}°`,
          delta_label: deltaLabel,
          sunset_label: weather.sunset,
          week_label: weather.weekSummary,
        }
      : null,

    tides:
      tide || todayTides.length > 0
        ? {
            coef: tide?.coef ?? null,
            coef_label: tide ? `Coef ${tide.coef}` : null,
            level_label: tide ? tide.level.label.split(" (")[0] : null,
            high_label: highs.length ? `PM ${highs.join(" · ")}` : null,
            low_label: lows.length ? `BM ${lows.join(" · ")}` : null,
            next_label: nextLabel,
            events: todayTides,
          }
        : null,
  };

  return NextResponse.json(payload);
}
