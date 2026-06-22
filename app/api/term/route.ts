import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { getConditions } from "@/lib/conditions";
import { getSejourSnapshot } from "@/lib/data/sejour";
import { todayInParis } from "@/lib/dates";

/**
 * GET /api/term — payload TRMNL : séjour (sensible) + conditions (#26).
 *
 * 🔒 PROTÉGÉ par token : `Authorization: Bearer <TRMNL_API_TOKEN>` (env Vercel).
 * Indispensable car le bloc `stay`/`next` expose la présence/absence de la famille
 * (cf. spec trmnl §9). Le plugin TRMNL envoie le header via « polling headers ».
 *
 * Labels pré-formatés côté serveur (le template Liquid n'affiche). Sources tierces
 * en panne → bloc `null`, jamais de 500. Date en Europe/Paris (`todayInParis`).
 */

export const dynamic = "force-dynamic";

const TZ = "Europe/Paris";

function fmt(opts: Intl.DateTimeFormatOptions, d: Date = new Date()): string {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, ...opts }).format(d);
}

function tokenValid(authHeader: string | null): boolean {
  const expected = process.env.TRMNL_API_TOKEN;
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  if (!tokenValid(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const today = todayInParis();
  const [{ tide, upcomingTides, todayTides, weather }, sejour] =
    await Promise.all([getConditions(today), getSejourSnapshot(today)]);

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

  const delta = weather?.deltaVsNormalC;
  const deltaLabel =
    delta == null
      ? null
      : delta === 0
        ? "dans la normale"
        : `${delta > 0 ? "+" : ""}${delta}° vs la normale`;

  const payload = {
    generated_at: new Date().toISOString(),
    generated_at_label: `${fmt({ weekday: "short", day: "numeric", month: "long" })} · ${fmt({ hour: "2-digit", minute: "2-digit" })}`,

    status: sejour.status,
    stay: sejour.stay,
    next: sejour.next,

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
            // Prochaines marées triées (consommé par le plugin TRMNL pour le
            // visuel "Pleine ▲ / Basse ▼"). Vide si le scraper maree.info échoue.
            upcoming: upcomingTides,
            events: todayTides,
          }
        : null,
  };

  return NextResponse.json(payload);
}
