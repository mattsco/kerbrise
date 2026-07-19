import { describe, expect, it } from "vitest";
import { TIDE_YEARS, TIDE_SCALE, getTideDay, tideLevel } from "./tides";

describe("RAW_BY_YEAR — indexation par position (garde-fou dev promu en test)", () => {
  // L'accès aux coefs se fait par [mois][jour-1] : si un copier-coller ajoute
  // ou retire un jour, TOUT le reste du mois se décale silencieusement.
  // On vérifie via l'API publique que chaque mois a EXACTEMENT le bon nombre
  // de jours (bissextiles comprises : new Date gère février).
  for (const year of TIDE_YEARS) {
    it(`${year} : longueurs de mois exactes`, () => {
      for (let month = 0; month < 12; month++) {
        const expected = new Date(year, month + 1, 0).getDate();
        // Dernier jour du mois présent…
        expect(
          getTideDay(year, month, expected),
          `${year}-${month + 1} : jour ${expected} absent`
        ).not.toBeNull();
        // …et pas de jour excédentaire.
        expect(
          getTideDay(year, month, expected + 1),
          `${year}-${month + 1} : jour ${expected + 1} en trop`
        ).toBeNull();
      }
    });
  }

  it("2024 est bissextile : le 29 février existe", () => {
    expect(TIDE_YEARS).toContain(2024);
    expect(getTideDay(2024, 1, 29)).not.toBeNull();
    expect(getTideDay(2025, 1, 29)).toBeNull();
  });

  it("chaque jour a 1 ou 2 coefs plausibles (20–120), coef = max des bruts", () => {
    for (const year of TIDE_YEARS) {
      for (let month = 0; month < 12; month++) {
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let day = 1; day <= daysInMonth; day++) {
          const tide = getTideDay(year, month, day)!;
          expect(tide.raw.length).toBeGreaterThanOrEqual(1);
          expect(tide.raw.length).toBeLessThanOrEqual(2);
          expect(tide.coef).toBe(Math.max(...tide.raw));
          for (const c of tide.raw) {
            expect(c).toBeGreaterThanOrEqual(20);
            expect(c).toBeLessThanOrEqual(120);
          }
        }
      }
    }
  });
});

describe("getTideDay — dégradation hors données", () => {
  it("année non couverte / jour absent → null", () => {
    expect(getTideDay(1999, 0, 1)).toBeNull();
    expect(getTideDay(2026, 0, 32)).toBeNull();
  });

  it("un jour connu renvoie ses coefs (2026-01-01 : 69 et 74)", () => {
    expect(getTideDay(2026, 0, 1)).toEqual({ coef: 74, raw: [69, 74] });
  });
});

describe("tideLevel — bornes des paliers", () => {
  const expectLabel = (coef: number, min: number) => {
    expect(tideLevel(coef).min).toBe(min);
  };

  it("chaque borne basse est INCLUSIVE", () => {
    expectLabel(100, 100);
    expectLabel(99, 95);
    expectLabel(95, 95);
    expectLabel(94, 70);
    expectLabel(70, 70);
    expectLabel(69, 40);
    expectLabel(40, 40);
    expectLabel(39, 0);
    expectLabel(0, 0);
  });

  it("le dernier palier (min: 0) capte tout, même un coef aberrant", () => {
    expect(tideLevel(120).min).toBe(100);
    expect(TIDE_SCALE[TIDE_SCALE.length - 1].min).toBe(0);
  });
});
