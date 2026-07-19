import { describe, expect, it } from "vitest";
import {
  computePlaceholdersForYear,
  getAllUpcomingPlaceholders,
  canFamilyReservePlaceholder,
  findOverlappingPlaceholder,
  type BookingMinimal,
  type Placeholder,
} from "./summer-placeholders";
import { SUMMER_PERIODS, getPeriodDates } from "./summer-priorities";

function booking(overrides: Partial<BookingMinimal>): BookingMinimal {
  return {
    start_date: "2026-06-29",
    end_date: "2026-07-19",
    family_id: "fam-1",
    family_name: "François",
    family_color: "#10b981",
    status: "approved",
    ...overrides,
  };
}

describe("computePlaceholdersForYear", () => {
  it("année sans réservation : 3 placeholders libres, dates = getPeriodDates", () => {
    for (const year of [2026, 2027]) {
      const placeholders = computePlaceholdersForYear(year, []);
      expect(placeholders).toHaveLength(3);
      placeholders.forEach((p, i) => {
        const dates = getPeriodDates(year, SUMMER_PERIODS[i]);
        expect(p.startDate).toBe(dates.start);
        expect(p.endDate).toBe(dates.end);
        expect(p.status).toBe("free");
      });
    }
  });

  it("année non configurée : aucun placeholder (on n'invente pas de période)", () => {
    expect(computePlaceholdersForYear(2030, [])).toEqual([]);
  });

  it("une résa approved couvrant EXACTEMENT la période → taken", () => {
    const dates = getPeriodDates(2027, SUMMER_PERIODS[0]);
    const placeholders = computePlaceholdersForYear(2027, [
      booking({ start_date: dates.start, end_date: dates.end, family_name: "Antoine" }),
    ]);
    expect(placeholders[0].status).toBe("taken");
    expect(placeholders[0].takenBy?.familyName).toBe("Antoine");
    expect(placeholders[1].status).toBe("free");
    expect(placeholders[2].status).toBe("free");
  });

  it("une résa pending ou aux dates inexactes ne prend PAS le placeholder", () => {
    const dates = getPeriodDates(2026, SUMMER_PERIODS[0]);
    const pending = computePlaceholdersForYear(2026, [
      booking({ start_date: dates.start, end_date: dates.end, status: "pending" }),
    ]);
    expect(pending[0].status).toBe("free");

    const offByOne = computePlaceholdersForYear(2026, [
      booking({ start_date: dates.start, end_date: "2026-07-18" }),
    ]);
    expect(offByOne[0].status).toBe("free");
  });
});

describe("getAllUpcomingPlaceholders", () => {
  it("concatène les années configurées et saute les autres", () => {
    // 2026..2030 : 2030 non configurée → 4 années × 3 périodes
    const all = getAllUpcomingPlaceholders([], 2026, 2030);
    expect(all).toHaveLength(12);
    expect(all.some((p) => p.year === 2030)).toBe(false);
  });
});

describe("canFamilyReservePlaceholder — tour de rôle par priorité", () => {
  // Été 2026 : François (1), Antoine (2), Vincent (3)
  const free = computePlaceholdersForYear(2026, []);

  it("priorité 1 peut toujours réserver", () => {
    const res = canFamilyReservePlaceholder(free[0], "François", free);
    expect(res).toMatchObject({ allowed: true, myPriority: 1 });
  });

  it("priorité 2 est bloquée tant que la priorité 1 n'a pas choisi", () => {
    const res = canFamilyReservePlaceholder(free[1], "Antoine", free);
    expect(res.allowed).toBe(false);
    expect(res.myPriority).toBe(2);
    expect(res.blockingFamily).toBe("François");
    expect(res.reason).toContain("François");
  });

  it("priorité 2 débloquée dès qu'un placeholder est pris", () => {
    const dates = getPeriodDates(2026, SUMMER_PERIODS[1]);
    const oneTaken = computePlaceholdersForYear(2026, [
      booking({ start_date: dates.start, end_date: dates.end, family_name: "François" }),
    ]);
    const stillFree = oneTaken.find((p) => p.status === "free")!;
    const res = canFamilyReservePlaceholder(stillFree, "Antoine", oneTaken);
    expect(res).toMatchObject({ allowed: true, myPriority: 2 });
    // Mais la priorité 3 attend encore le choix d'Antoine
    const p3 = canFamilyReservePlaceholder(stillFree, "Vincent", oneTaken);
    expect(p3.allowed).toBe(false);
    expect(p3.blockingFamily).toBe("Antoine");
  });

  it("un placeholder déjà pris n'est pas réservable", () => {
    const dates = getPeriodDates(2026, SUMMER_PERIODS[0]);
    const oneTaken = computePlaceholdersForYear(2026, [
      booking({ start_date: dates.start, end_date: dates.end }),
    ]);
    const res = canFamilyReservePlaceholder(oneTaken[0], "François", oneTaken);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("déjà réservé");
  });

  it("famille inconnue → refus explicite", () => {
    const res = canFamilyReservePlaceholder(free[0], "Dupont", free);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain("inconnue");
  });
});

describe("findOverlappingPlaceholder", () => {
  const placeholders: Placeholder[] = computePlaceholdersForYear(2026, []);

  it("détecte un séjour qui mord sur une période (bornes incluses)", () => {
    expect(
      findOverlappingPlaceholder("2026-06-20", "2026-06-29", placeholders)
        ?.period.id
    ).toBe(1);
    expect(
      findOverlappingPlaceholder("2026-08-31", "2026-09-05", placeholders)
        ?.period.id
    ).toBe(3);
  });

  it("null si le séjour est hors des périodes", () => {
    expect(
      findOverlappingPlaceholder("2026-06-01", "2026-06-28", placeholders)
    ).toBeNull();
  });
});
