import { describe, expect, it } from "vitest";
import {
  getPreSummerWindow,
  getPostSummerWindow,
  getAdjacentWindowsForRange,
  stayTakesWindow,
  buildPeriodHolders,
  computeAdjacentAdvisory,
  type AdjacentWindow,
  type PeriodBooking,
} from "./summer-adjacent";

// Dates de référence (lib/config.ts + SUMMER_PERIODS) :
//   2026 legacy — P1 29 juin → 19 juil. ; P3 10 → 31 août
//   2027 pivot  — P1 démarre le 28 juin ; P3 finit le 30 août
//   2028 pivot  — P1 démarre le 1er juil. ; P3 finit le 2 sept.
//   2030        — non votée → non configurée

const pre = (year: number) => getPreSummerWindow(year)!;
const post = (year: number) => getPostSummerWindow(year)!;

describe("getPreSummerWindow — 14 jours avant le début de P1", () => {
  it("2027 (pivot) : 14 → 28 juin", () => {
    expect(pre(2027)).toMatchObject({
      kind: "pre",
      periodId: 1,
      start: "2027-06-14",
      end: "2027-06-28",
    });
  });

  it("2028 : suit le début de P1 voté (1er juillet) → 17 juin → 1er juillet", () => {
    expect(pre(2028)).toMatchObject({ start: "2028-06-17", end: "2028-07-01" });
  });

  it("2026 (legacy) : 15 → 29 juin", () => {
    expect(pre(2026)).toMatchObject({ start: "2026-06-15", end: "2026-06-29" });
  });

  it("année non configurée → null (on n'invente pas de période)", () => {
    expect(getPreSummerWindow(2030)).toBeNull();
    expect(getPostSummerWindow(2030)).toBeNull();
  });
});

describe("getPostSummerWindow — 14 jours après la fin de P3", () => {
  it("2027 : 30 août → 13 septembre", () => {
    expect(post(2027)).toMatchObject({
      kind: "post",
      periodId: 3,
      start: "2027-08-30",
      end: "2027-09-13",
    });
  });

  it("2028 : 2 → 16 septembre", () => {
    expect(post(2028)).toMatchObject({ start: "2028-09-02", end: "2028-09-16" });
  });
});

describe("stayTakesWindow — ≥ 1 nuit, jours pivots autorisés", () => {
  const w = pre(2027); // 2027-06-14 → 2027-06-28

  it("séjour au cœur de la fenêtre → pris", () => {
    expect(stayTakesWindow("2027-06-20", "2027-06-24", w)).toBe(true);
  });

  it("une seule nuit dans la fenêtre → pris", () => {
    expect(stayTakesWindow("2027-06-27", "2027-06-28", w)).toBe(true);
  });

  it("arrivée pile au début de P1 (jour pivot) → PAS pris", () => {
    expect(stayTakesWindow("2027-06-28", "2027-07-05", w)).toBe(false);
  });

  it("départ pile au premier jour de la fenêtre (jour pivot) → PAS pris", () => {
    expect(stayTakesWindow("2027-06-08", "2027-06-14", w)).toBe(false);
  });

  it("séjour entièrement avant la fenêtre → PAS pris", () => {
    expect(stayTakesWindow("2027-06-01", "2027-06-10", w)).toBe(false);
  });

  it("séjour de 0 nuit (aller-retour même jour) → PAS pris", () => {
    expect(stayTakesWindow("2027-06-20", "2027-06-20", w)).toBe(false);
  });

  it("dates vides → PAS pris", () => {
    expect(stayTakesWindow("", "", w)).toBe(false);
  });
});

describe("getAdjacentWindowsForRange", () => {
  it("les deux fenêtres d'une même année ne peuvent pas être prises ensemble", () => {
    // Séjour couvrant tout l'été : chevauche les deux fenêtres… mais un tel
    // séjour est bloqué en amont par overlapsSummerPeriod. On vérifie juste que
    // le calcul reste cohérent (2 fenêtres distinctes retournées).
    const windows = getAdjacentWindowsForRange("2027-06-20", "2027-09-05");
    expect(windows.map((w) => w.kind)).toEqual(["pre", "post"]);
  });

  it("séjour hors fenêtres → aucune", () => {
    expect(getAdjacentWindowsForRange("2027-06-01", "2027-06-08")).toEqual([]);
    expect(getAdjacentWindowsForRange("2027-10-01", "2027-10-08")).toEqual([]);
  });

  it("séjour à cheval sur deux années → balaie les deux", () => {
    const windows = getAdjacentWindowsForRange("2027-12-20", "2028-06-20");
    expect(windows.map((w) => `${w.year}:${w.kind}`)).toEqual(["2028:pre"]);
  });
});

describe("buildPeriodHolders — matching tolérant sur données réelles", () => {
  // Été 2026 tel qu'il est RÉELLEMENT en base : 2 périodes sur 3 saisies à un
  // jour des dates canoniques (P1 29 juin → 19 juil., P3 10 → 31 août).
  const ete2026: PeriodBooking[] = [
    {
      family_name: "Antoine",
      start_date: "2026-06-15",
      end_date: "2026-06-28",
      status: "approved",
    },
    {
      family_name: "Vincent",
      start_date: "2026-06-28", // canonique : 29 juin
      end_date: "2026-07-19",
      status: "approved",
    },
    {
      family_name: "François",
      start_date: "2026-07-20",
      end_date: "2026-08-09",
      status: "approved",
    },
    {
      family_name: "Antoine",
      start_date: "2026-08-10",
      end_date: "2026-08-30", // canonique : 31 août
      status: "approved",
    },
    {
      family_name: "Vincent",
      start_date: "2026-08-31",
      end_date: "2026-09-14",
      status: "approved",
    },
  ];

  it("détecte P1 et P3 malgré le décalage d'un jour", () => {
    expect(buildPeriodHolders(2026, ete2026)).toEqual({
      1: "Vincent",
      3: "Antoine",
    });
  });

  it("un séjour adjacent hors période ne devient pas détenteur", () => {
    // Antoine occupe le 15→28 juin (la quinzaine d'avant), pas la Période 1.
    expect(buildPeriodHolders(2026, ete2026)[1]).not.toBe("Antoine");
  });

  it("une semaine posée au milieu d'une période ne suffit pas (< 50 %)", () => {
    expect(
      buildPeriodHolders(2027, [
        {
          family_name: "Vincent",
          start_date: "2027-07-05",
          end_date: "2027-07-12",
          status: "approved",
        },
      ])
    ).toEqual({ 1: null, 3: null });
  });

  it("en cas de concurrence, le plus gros recouvrement gagne", () => {
    expect(
      buildPeriodHolders(2027, [
        {
          family_name: "Vincent",
          start_date: "2027-06-28",
          end_date: "2027-07-12", // 14 nuits sur 21
          status: "approved",
        },
        {
          family_name: "Antoine",
          start_date: "2027-06-27",
          end_date: "2027-07-19", // 21 nuits sur 21
          status: "approved",
        },
      ])[1]
    ).toBe("Antoine");
  });
});

describe("buildPeriodHolders — dates canoniques, approved uniquement", () => {
  const p1Booking: PeriodBooking = {
    family_name: "Antoine",
    start_date: "2027-06-28",
    end_date: "2027-07-19",
    status: "approved",
  };
  const p3Booking: PeriodBooking = {
    family_name: "François",
    start_date: "2027-08-09",
    end_date: "2027-08-30",
    status: "approved",
  };

  it("détecte les détenteurs de P1 et P3", () => {
    expect(buildPeriodHolders(2027, [p1Booking, p3Booking])).toEqual({
      1: "Antoine",
      3: "François",
    });
  });

  it("gating par période : P1 attribuée seule suffit", () => {
    expect(buildPeriodHolders(2027, [p1Booking])).toEqual({
      1: "Antoine",
      3: null,
    });
  });

  it("un séjour pending ne rend pas la période détenue", () => {
    expect(
      buildPeriodHolders(2027, [{ ...p1Booking, status: "pending" }])
    ).toEqual({ 1: null, 3: null });
  });

  it("un jour de décalage reste détecté (tolérance)", () => {
    expect(
      buildPeriodHolders(2027, [{ ...p1Booking, end_date: "2027-07-20" }])[1]
    ).toBe("Antoine");
  });

  it("année non configurée → aucun détenteur", () => {
    expect(buildPeriodHolders(2030, [p1Booking])).toEqual({ 1: null, 3: null });
  });
});

describe("computeAdjacentAdvisory", () => {
  const state = {
    year: 2027,
    holders: { 1: "Antoine", 3: "François" } as const,
  };

  it("le détenteur de P1 réservant la quinzaine d'avant → warning juin", () => {
    const advisory = computeAdjacentAdvisory(
      "2027-06-18",
      "2027-06-26",
      "Antoine",
      state
    );
    expect(advisory).toMatchObject({
      familyName: "Antoine",
      window: { kind: "pre", periodLabel: "Période 1" },
    });
  });

  it("le détenteur de P3 réservant la quinzaine d'après → warning septembre", () => {
    const advisory = computeAdjacentAdvisory(
      "2027-09-01",
      "2027-09-08",
      "François",
      state
    );
    expect(advisory).toMatchObject({
      familyName: "François",
      window: { kind: "post", periodLabel: "Période 3" },
    });
  });

  it("une autre famille sur la même quinzaine → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2027-06-18", "2027-06-26", "Vincent", state)
    ).toBeNull();
  });

  it("la P2 n'est jamais concernée", () => {
    expect(
      computeAdjacentAdvisory("2027-06-18", "2027-06-26", "Vincent", {
        year: 2027,
        holders: { 1: null, 3: null },
      })
    ).toBeNull();
  });

  it("période non encore attribuée → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2027-06-18", "2027-06-26", "Antoine", {
        year: 2027,
        holders: { 1: null, 3: "François" },
      })
    ).toBeNull();
  });

  it("le détenteur de P1 hors fenêtre → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2027-06-01", "2027-06-08", "Antoine", state)
    ).toBeNull();
  });

  it("jour pivot (arrivée au début de P1) → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2027-06-28", "2027-07-05", "Antoine", state)
    ).toBeNull();
  });

  it("état d'une autre année que le séjour → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2028-06-20", "2028-06-28", "Antoine", state)
    ).toBeNull();
  });

  it("famille vide → aucun warning", () => {
    expect(
      computeAdjacentAdvisory("2027-06-18", "2027-06-26", "", state)
    ).toBeNull();
  });
});

describe("cohérence des fenêtres", () => {
  it("chaque fenêtre fait bien 14 nuits", () => {
    const nights = (w: AdjacentWindow) =>
      (Date.parse(w.end) - Date.parse(w.start)) / 86_400_000;
    expect(nights(pre(2027))).toBe(14);
    expect(nights(post(2027))).toBe(14);
    expect(nights(pre(2026))).toBe(14);
  });

  it("la fenêtre juin est contiguë au début de P1, la fenêtre sept. à la fin de P3", () => {
    expect(pre(2027).end).toBe("2027-06-28");
    expect(post(2027).start).toBe("2027-08-30");
  });
});
