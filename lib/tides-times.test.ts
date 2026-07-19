import { describe, expect, it } from "vitest";
import {
  TIDE_TIMES_YEARS,
  getTideTimesDay,
  getOfflineTides,
} from "./tides-times";
import { TIDE_TIMES_2026 } from "./data/tides-times-2026";

/** "04h42" → minutes depuis minuit. */
function toMinutes(time: string): number {
  const m = /^(\d{2})h(\d{2})$/.exec(time);
  expect(m, `format horaire inattendu : ${time}`).not.toBeNull();
  return Number(m![1]) * 60 + Number(m![2]);
}

/** Tous les jours ISO d'une année (UTC pour éviter tout piège DST). */
function allDaysOfYear(year: number): string[] {
  const days: string[] = [];
  for (
    let d = Date.UTC(year, 0, 1);
    d < Date.UTC(year + 1, 0, 1);
    d += 24 * 3600 * 1000
  ) {
    days.push(new Date(d).toISOString().slice(0, 10));
  }
  return days;
}

describe("TIDE_TIMES_2026 — intégrité de la donnée committée", () => {
  const days2026 = allDaysOfYear(2026);

  it("couvre les 365 jours de 2026, sans clé parasite", () => {
    expect(days2026).toHaveLength(365);
    for (const iso of days2026) {
      expect(TIDE_TIMES_2026[iso], `jour manquant : ${iso}`).toBeDefined();
    }
    expect(Object.keys(TIDE_TIMES_2026)).toHaveLength(365);
  });

  it("horaires strictement croissants sur chaque jour de l'année (garde-fou dev promu en test)", () => {
    for (const [iso, events] of Object.entries(TIDE_TIMES_2026)) {
      const mins = events.map((e) => toMinutes(e.time));
      for (let i = 1; i < mins.length; i++) {
        expect(
          mins[i],
          `${iso} : horaires non croissants (${events[i - 1].time} puis ${events[i].time})`
        ).toBeGreaterThan(mins[i - 1]);
      }
    }
  });

  it("cohérence coef ↔ PM : toutes les PM ont un coef, jamais les BM", () => {
    for (const [iso, events] of Object.entries(TIDE_TIMES_2026)) {
      const pmCount = events.filter((e) => e.type === "PM").length;
      const coefCount = events.filter((e) => e.coef !== undefined).length;
      expect(coefCount, `${iso} : ${pmCount} PM mais ${coefCount} coefs`).toBe(
        pmCount
      );
      for (const e of events) {
        if (e.type === "PM") {
          expect(e.coef, `${iso} : PM sans coef`).toBeTypeOf("number");
          expect(e.coef!).toBeGreaterThanOrEqual(20);
          expect(e.coef!).toBeLessThanOrEqual(120);
        } else {
          expect(e.coef, `${iso} : BM avec coef`).toBeUndefined();
        }
      }
    }
  });

  it("chaque jour a 2 à 4 marées, aux hauteurs plausibles pour Saint-Malo", () => {
    for (const [iso, events] of Object.entries(TIDE_TIMES_2026)) {
      expect(events.length, `${iso}`).toBeGreaterThanOrEqual(2);
      expect(events.length, `${iso}`).toBeLessThanOrEqual(4);
      for (const e of events) {
        if (e.height !== null) {
          expect(e.height, `${iso} : hauteur aberrante`).toBeGreaterThanOrEqual(0);
          expect(e.height, `${iso} : hauteur aberrante`).toBeLessThanOrEqual(15);
        }
      }
    }
  });
});

describe("getTideTimesDay", () => {
  it("jour couvert → événements, jour hors données → null", () => {
    expect(getTideTimesDay("2026-06-15")).not.toBeNull();
    expect(getTideTimesDay("2025-06-15")).toBeNull();
    expect(TIDE_TIMES_YEARS).toContain(2026);
  });
});

describe("getOfflineTides", () => {
  it("jour couvert : aujourd'hui + lendemain", () => {
    const tides = getOfflineTides("2026-06-15")!;
    expect(tides.port).toBe("Saint-Malo");
    expect(tides.days.map((d) => d.date)).toEqual(["2026-06-15", "2026-06-16"]);
    expect(tides.days[0].events.length).toBeGreaterThan(0);
  });

  it("jour non couvert → null (mode dégradé)", () => {
    expect(getOfflineTides("2025-06-15")).toBeNull();
    expect(getOfflineTides("2027-06-15")).toBeNull();
  });

  it("dernier jour de l'année : lendemain absent → un seul jour, pas de crash", () => {
    const tides = getOfflineTides("2026-12-31")!;
    expect(tides.days.map((d) => d.date)).toEqual(["2026-12-31"]);
  });
});
