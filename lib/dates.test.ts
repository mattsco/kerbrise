// ⚠️ Ces tests supposent TZ=Europe/Paris (imposé par le script npm test) :
// c'est le fuseau de l'app, et celui où le bug timezone historique se voit.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  parseLocalDate,
  dateToISO,
  todayInParis,
  daysBetween,
  daysInRangeInclusive,
  daysInRangeClipped,
  nightsInRangeClipped,
  addDays,
} from "./dates";

describe("parseLocalDate — verrou du bug timezone historique", () => {
  // Si on remplace parseLocalDate par `new Date(iso)` (parse UTC), la date
  // devient minuit UTC = 01h/02h à Paris → ces assertions échouent.
  it("parse en minuit LOCAL, pas UTC (heure d'hiver)", () => {
    const d = parseLocalDate("2026-01-15");
    expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2026, 0, 15]);
    expect(d.getHours()).toBe(0);
  });

  it("parse en minuit LOCAL, pas UTC (heure d'été)", () => {
    const d = parseLocalDate("2026-07-15");
    expect(d.getDate()).toBe(15);
    expect(d.getHours()).toBe(0);
  });

  it("roundtrip dateToISO(parseLocalDate(iso)) === iso, toute l'année", () => {
    for (const iso of ["2026-01-01", "2026-03-29", "2026-10-25", "2026-12-31"]) {
      expect(dateToISO(parseLocalDate(iso))).toBe(iso);
    }
  });

  it("documente le piège : toISOString() décale d'un jour en heure d'hiver Paris", () => {
    // C'est LA raison d'être de dateToISO : minuit Paris = 23h UTC la veille.
    expect(parseLocalDate("2026-01-15").toISOString().slice(0, 10)).toBe(
      "2026-01-14"
    );
  });
});

describe("todayInParis", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("entre 23h UTC et minuit Paris, la date Paris est en avance sur l'UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T23:30:00Z")); // 00h30 le 11 à Paris
    expect(todayInParis()).toBe("2026-03-11");
  });

  it("en journée, date Paris = date UTC", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    expect(todayInParis()).toBe("2026-03-10");
  });
});

describe("daysBetween", () => {
  it("est signé (b - a)", () => {
    expect(daysBetween("2026-05-01", "2026-05-04")).toBe(3);
    expect(daysBetween("2026-05-04", "2026-05-01")).toBe(-3);
    expect(daysBetween("2026-05-01", "2026-05-01")).toBe(0);
  });

  it("robuste aux changements d'heure (DST mars et octobre)", () => {
    expect(daysBetween("2026-03-28", "2026-03-30")).toBe(2); // passage à l'heure d'été le 29
    expect(daysBetween("2026-10-24", "2026-10-26")).toBe(2); // retour à l'heure d'hiver le 25
  });
});

describe("daysInRangeInclusive", () => {
  it("compte les deux bornes", () => {
    expect(daysInRangeInclusive("2026-05-01", "2026-05-03")).toBe(3);
    expect(daysInRangeInclusive("2026-05-01", "2026-05-01")).toBe(1);
  });
});

describe("daysInRangeClipped", () => {
  it("clippe un séjour à cheval sur deux années", () => {
    // Séjour 28 déc → 3 janv, fenêtre 2026 → 3 jours côté 2026
    expect(
      daysInRangeClipped("2025-12-28", "2026-01-03", "2026-01-01", "2026-12-31")
    ).toBe(3);
    // et 4 jours côté 2025
    expect(
      daysInRangeClipped("2025-12-28", "2026-01-03", "2025-01-01", "2025-12-31")
    ).toBe(4);
  });

  it("séjour entièrement dans la fenêtre : durée inclusive complète", () => {
    expect(
      daysInRangeClipped("2026-05-01", "2026-05-03", "2026-01-01", "2026-12-31")
    ).toBe(3);
  });

  it("séjour hors fenêtre → 0", () => {
    expect(
      daysInRangeClipped("2025-05-01", "2025-05-10", "2026-01-01", "2026-12-31")
    ).toBe(0);
  });
});

describe("nightsInRangeClipped", () => {
  it("durée = nuits (fin − début), pas de double-comptage du pivot", () => {
    // Séjour type période d'été pivot : 21 nuits exactement
    expect(
      nightsInRangeClipped("2027-06-28", "2027-07-19", "2027-01-01", "2027-12-31")
    ).toBe(21);
  });

  it("séjour d'un jour (end = start) → 0 nuit", () => {
    expect(
      nightsInRangeClipped("2026-05-01", "2026-05-01", "2026-01-01", "2026-12-31")
    ).toBe(0);
  });

  it("range dégénéré (end < start) → 0", () => {
    expect(
      nightsInRangeClipped("2026-05-10", "2026-05-01", "2026-01-01", "2026-12-31")
    ).toBe(0);
  });

  it("la nuit est rattachée au jour de coucher lors du clip", () => {
    // Séjour 30 déc → 2 janv : nuits des 30, 31 déc et 1er janv.
    expect(
      nightsInRangeClipped("2025-12-30", "2026-01-02", "2025-01-01", "2025-12-31")
    ).toBe(2);
    expect(
      nightsInRangeClipped("2025-12-30", "2026-01-02", "2026-01-01", "2026-12-31")
    ).toBe(1);
  });
});

describe("addDays", () => {
  it("passe les fins de mois et d'année", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29"); // bissextile
  });

  it("traverse les changements d'heure sans décalage", () => {
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
  });

  it("addDays(iso, 0) est l'identité", () => {
    expect(addDays("2026-07-19", 0)).toBe("2026-07-19");
  });
});
