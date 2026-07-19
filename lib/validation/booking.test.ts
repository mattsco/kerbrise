import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MAX_STAY_DAYS, validateBookingDates } from "./booking";

describe("validateBookingDates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // "Aujourd'hui" figé : demain = 2026-07-20
    vi.setSystemTime(new Date("2026-07-19T10:00:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("refuse des dates manquantes", () => {
    expect(validateBookingDates("", "2026-08-01")).toEqual({
      ok: false,
      error: "Les deux dates sont requises.",
    });
    expect(validateBookingDates("2026-08-01", "").ok).toBe(false);
  });

  it("refuse fin < début", () => {
    const res = validateBookingDates("2026-08-10", "2026-08-01");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain("après la date de début");
  });

  it("accepte fin = début (séjour d'un jour)", () => {
    expect(validateBookingDates("2026-08-01", "2026-08-01")).toEqual({ ok: true });
  });

  it("plafonne à 60 jours (bornes exactes)", () => {
    // 60 jours pile : OK
    expect(validateBookingDates("2026-08-01", "2026-09-30")).toEqual({ ok: true });
    // 61 jours : refus, avec la durée demandée dans le message
    const res = validateBookingDates("2026-08-01", "2026-10-01");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toContain(`${MAX_STAY_DAYS} jours (61 demandés)`);
  });

  it("le début doit être au moins demain", () => {
    expect(validateBookingDates("2026-07-20", "2026-07-25")).toEqual({ ok: true });
    const today = validateBookingDates("2026-07-19", "2026-07-25");
    expect(today.ok).toBe(false);
    if (!today.ok) expect(today.error).toContain("au moins demain");
    expect(validateBookingDates("2026-07-01", "2026-07-25").ok).toBe(false);
  });

  it("édition sans toucher au début : la règle « demain » est sautée", () => {
    // Raccourcir un séjour déjà commencé (on ne change que la fin)
    expect(
      validateBookingDates("2026-07-10", "2026-07-22", {
        originalStart: "2026-07-10",
      })
    ).toEqual({ ok: true });
    // Mais déplacer le début dans le passé reste bloqué
    expect(
      validateBookingDates("2026-07-09", "2026-07-22", {
        originalStart: "2026-07-10",
      }).ok
    ).toBe(false);
  });

  it("mode admin : saute « max 60 j » et « demain », pas fin < début", () => {
    expect(
      validateBookingDates("2025-01-01", "2025-06-01", { isAdminMode: true })
    ).toEqual({ ok: true });
    expect(
      validateBookingDates("2025-06-01", "2025-01-01", { isAdminMode: true }).ok
    ).toBe(false);
  });
});
