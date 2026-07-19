import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SUMMER_PERIODS,
  getYearPriorities,
  getFamilyPriority,
  getPeriodDates,
  getRelevantSummerYear,
  isSummerYearConfigured,
  overlapsSummerPeriod,
} from "./summer-priorities";

const [P1, P2, P3] = SUMMER_PERIODS;

describe("getYearPriorities — rotation ancrée 2024", () => {
  // Table de vérité explicite : si FAMILIES est réordonné ou le modulo cassé,
  // ce test échoue avec l'année fautive en clair.
  const truthTable: Record<number, [string, string, string]> = {
    2024: ["Antoine", "Vincent", "François"],
    2025: ["Vincent", "François", "Antoine"],
    2026: ["François", "Antoine", "Vincent"],
    2027: ["Antoine", "Vincent", "François"],
    2028: ["Vincent", "François", "Antoine"],
    2029: ["François", "Antoine", "Vincent"],
    2030: ["Antoine", "Vincent", "François"],
  };

  for (const [year, [first, second, third]] of Object.entries(truthTable)) {
    it(`${year} : ${first} → ${second} → ${third}`, () => {
      expect(getYearPriorities(Number(year))).toEqual({
        1: first,
        2: second,
        3: third,
      });
    });
  }

  it("gère les années antérieures à l'ancre (modulo négatif)", () => {
    expect(getYearPriorities(2023)).toEqual(getYearPriorities(2026));
  });
});

describe("getFamilyPriority", () => {
  it("retourne la priorité 1/2/3 selon l'année", () => {
    expect(getFamilyPriority(2026, "François")).toBe(1);
    expect(getFamilyPriority(2026, "Antoine")).toBe(2);
    expect(getFamilyPriority(2026, "Vincent")).toBe(3);
  });

  it("retourne null pour une famille inconnue", () => {
    expect(getFamilyPriority(2026, "Dupont")).toBeNull();
  });
});

describe("isSummerYearConfigured", () => {
  it("toute année legacy (< 2027) est configurée", () => {
    expect(isSummerYearConfigured(2024)).toBe(true);
    expect(isSummerYearConfigured(2026)).toBe(true);
  });

  it("les années pivot votées sont configurées", () => {
    expect(isSummerYearConfigured(2027)).toBe(true);
    expect(isSummerYearConfigured(2028)).toBe(true);
    expect(isSummerYearConfigured(2029)).toBe(true);
  });

  it("une année pivot sans date votée n'est PAS configurée", () => {
    expect(isSummerYearConfigured(2030)).toBe(false);
  });
});

describe("getPeriodDates — modèle legacy (≤ 2026, dates fixes, end inclusif)", () => {
  it("2026 : bornes exactes des 3 périodes", () => {
    expect(getPeriodDates(2026, P1)).toEqual({
      start: "2026-06-29",
      end: "2026-07-19",
    });
    expect(getPeriodDates(2026, P2)).toEqual({
      start: "2026-07-20",
      end: "2026-08-09",
    });
    expect(getPeriodDates(2026, P3)).toEqual({
      start: "2026-08-10",
      end: "2026-08-31",
    });
  });

  it("les périodes legacy sont NON jointives (P1 finit le 19, P2 démarre le 20)", () => {
    expect(getPeriodDates(2026, P1).end).not.toBe(getPeriodDates(2026, P2).start);
  });
});

describe("getPeriodDates — modèle pivot (≥ 2027, 21 jours, end = pivot)", () => {
  it("2027 : bornes exactes depuis la date votée (2027-06-28)", () => {
    expect(getPeriodDates(2027, P1)).toEqual({
      start: "2027-06-28",
      end: "2027-07-19",
    });
    expect(getPeriodDates(2027, P2)).toEqual({
      start: "2027-07-19",
      end: "2027-08-09",
    });
    expect(getPeriodDates(2027, P3)).toEqual({
      start: "2027-08-09",
      end: "2027-08-30",
    });
  });

  it("chevauchement au jour pivot : dernier jour Pn = premier jour Pn+1", () => {
    for (const year of [2027, 2028, 2029]) {
      expect(getPeriodDates(year, P1).end).toBe(getPeriodDates(year, P2).start);
      expect(getPeriodDates(year, P2).end).toBe(getPeriodDates(year, P3).start);
    }
  });

  it("le pivot tombe le même jour de semaine que le début de P1", () => {
    for (const year of [2027, 2028, 2029]) {
      const { start, end } = getPeriodDates(year, P1);
      const dayOfWeek = (iso: string) => new Date(`${iso}T12:00:00`).getDay();
      expect(dayOfWeek(end)).toBe(dayOfWeek(start));
    }
  });

  it("lève pour une année pivot sans date votée (on n'invente pas de période)", () => {
    expect(() => getPeriodDates(2030, P1)).toThrow(/2030/);
  });
});

describe("overlapsSummerPeriod", () => {
  it("détecte un séjour entièrement dans une période", () => {
    expect(overlapsSummerPeriod("2026-07-01", "2026-07-10")?.id).toBe(1);
    expect(overlapsSummerPeriod("2027-08-15", "2027-08-20")?.id).toBe(3);
  });

  it("bornes incluses : toucher le premier ou le dernier jour suffit", () => {
    // Arrive le dernier jour de P3 legacy 2026
    expect(overlapsSummerPeriod("2026-08-31", "2026-09-10")?.id).toBe(3);
    // Repart le premier jour de P1 legacy 2026
    expect(overlapsSummerPeriod("2026-06-20", "2026-06-29")?.id).toBe(1);
    // Juste avant / juste après : pas de chevauchement
    expect(overlapsSummerPeriod("2026-06-20", "2026-06-28")).toBeNull();
    expect(overlapsSummerPeriod("2026-09-01", "2026-09-10")).toBeNull();
  });

  it("séjour à cheval sur un pivot 2027 : matche la première période touchée", () => {
    // 15 → 25 juillet 2027 : à cheval sur le pivot P1/P2 (19 juillet)
    expect(overlapsSummerPeriod("2027-07-15", "2027-07-25")?.id).toBe(1);
    // Arrivée LE jour pivot P1/P2 : touche encore P1 (son end est le pivot)
    expect(overlapsSummerPeriod("2027-07-19", "2027-07-25")?.id).toBe(1);
    // Lendemain du pivot : P2 seulement
    expect(overlapsSummerPeriod("2027-07-20", "2027-07-25")?.id).toBe(2);
  });

  it("année non configurée → null (pas d'exception)", () => {
    expect(overlapsSummerPeriod("2030-07-01", "2030-07-15")).toBeNull();
  });
});

describe("getRelevantSummerYear — bascule au 1er octobre", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const cases: [string, number][] = [
    ["2026-01-15", 2026], // janvier : on prépare l'été courant
    ["2026-07-20", 2026], // plein été
    ["2026-09-01", 2026], // 1er septembre → toujours été courant (règle figée)
    ["2026-09-30", 2026], // veille de la bascule
    ["2026-10-01", 2027], // jour de la bascule → été suivant
    ["2026-12-25", 2027],
  ];

  for (const [date, expected] of cases) {
    it(`${date} → été ${expected}`, () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(`${date}T12:00:00`));
      expect(getRelevantSummerYear()).toBe(expected);
      expect(getRelevantSummerYear(new Date(`${date}T12:00:00`))).toBe(expected);
    });
  }
});
