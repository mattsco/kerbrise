import { describe, expect, it } from "vitest";
import {
  getHolidaysForYear,
  getHolidaysInRange,
  getHolidayForDate,
} from "./holidays";

describe("getHolidaysForYear", () => {
  it("2026 : les 11 jours fériés officiels français", () => {
    const holidays = getHolidaysForYear(2026);
    expect(holidays).toHaveLength(11);
    const dates = holidays.map((h) => h.date);
    expect(dates).toContain("2026-01-01");
    expect(dates).toContain("2026-07-14");
    expect(dates).toContain("2026-08-15");
    expect(dates).toContain("2026-12-25");
    // Fêtes mobiles 2026 : Pâques le 5 avril → lundi 6, Ascension 14 mai
    expect(dates).toContain("2026-04-06");
    expect(dates).toContain("2026-05-14");
  });

  it("les 11 noms sont raccourcis pour l'affichage compact", () => {
    // Verrouille l'alignement entre les noms renvoyés par date-holidays et la
    // table de shortenName : si la lib renomme un férié, ce test le dit.
    const byDate = Object.fromEntries(
      getHolidaysForYear(2026).map((h) => [h.date, h.shortName])
    );
    expect(byDate).toEqual({
      "2026-01-01": "Jour de l'an",
      "2026-04-06": "Pâques",
      "2026-05-01": "1er Mai",
      "2026-05-08": "8 Mai",
      "2026-05-14": "Ascension",
      "2026-05-25": "Pentecôte",
      "2026-07-14": "14 Juillet",
      "2026-08-15": "Assomption",
      "2026-11-01": "Toussaint",
      "2026-11-11": "11 Novembre",
      "2026-12-25": "Noël",
    });
  });
});

describe("getHolidaysInRange", () => {
  it("filtre sur la plage, bornes incluses", () => {
    const holidays = getHolidaysInRange("2026-07-14", "2026-08-15");
    expect(holidays.map((h) => h.date)).toEqual(["2026-07-14", "2026-08-15"]);
  });

  it("traverse un changement d'année", () => {
    const holidays = getHolidaysInRange("2026-12-20", "2027-01-05");
    expect(holidays.map((h) => h.date)).toEqual(["2026-12-25", "2027-01-01"]);
  });
});

describe("getHolidayForDate", () => {
  it("férié → objet, jour normal → null", () => {
    expect(getHolidayForDate("2026-07-14")?.shortName).toBe("14 Juillet");
    expect(getHolidayForDate("2026-07-15")).toBeNull();
  });
});
