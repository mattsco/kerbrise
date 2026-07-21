import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  STALE_AFTER_DAYS,
  formatSavedAt,
  parseSnapshot,
  snapshotFreshness,
  type OfflineSnapshot,
} from "./offline-snapshot";

function makeSnapshot(savedAt: string): OfflineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    bookings: [],
    familyName: "Antoine",
  };
}

describe("snapshotFreshness", () => {
  const now = new Date(2026, 6, 21, 12, 0, 0);

  it("absent quand il n'y a pas de snapshot", () => {
    expect(snapshotFreshness(null, now)).toEqual({ state: "absent" });
  });

  it("frais en deçà du seuil", () => {
    const s = makeSnapshot(new Date(2026, 6, 18, 12, 0, 0).toISOString());
    const r = snapshotFreshness(s, now);
    expect(r.state).toBe("fresh");
    expect(r).toMatchObject({ ageDays: 3 });
  });

  it("périmé pile au seuil — la bascule est inclusive", () => {
    const s = makeSnapshot(
      new Date(2026, 6, 21 - STALE_AFTER_DAYS, 12, 0, 0).toISOString()
    );
    const r = snapshotFreshness(s, now);
    expect(r.state).toBe("stale");
    expect(r).toMatchObject({ ageDays: STALE_AFTER_DAYS });
  });

  it("périmé bien au-delà", () => {
    const s = makeSnapshot(new Date(2026, 5, 1, 12, 0, 0).toISOString());
    expect(snapshotFreshness(s, now).state).toBe("stale");
  });

  it("horloge en avance : âge borné à 0, jamais négatif", () => {
    const s = makeSnapshot(new Date(2026, 6, 25, 12, 0, 0).toISOString());
    const r = snapshotFreshness(s, now);
    expect(r.state).toBe("fresh");
    expect(r).toMatchObject({ ageDays: 0 });
  });

  it("date illisible → traité comme absent, pas comme frais", () => {
    const s = makeSnapshot("pas une date");
    expect(snapshotFreshness(s, now)).toEqual({ state: "absent" });
  });
});

describe("parseSnapshot", () => {
  it("relit ce qu'il a écrit", () => {
    const s = makeSnapshot(new Date(2026, 6, 20).toISOString());
    expect(parseSnapshot(JSON.stringify(s))).toEqual(s);
  });

  it("rejette null, JSON invalide, version inconnue, bookings absents", () => {
    expect(parseSnapshot(null)).toBeNull();
    expect(parseSnapshot("{pas du json")).toBeNull();
    expect(
      parseSnapshot(JSON.stringify({ ...makeSnapshot("2026-07-20"), version: 99 }))
    ).toBeNull();
    expect(
      parseSnapshot(
        JSON.stringify({ version: SNAPSHOT_VERSION, savedAt: "2026-07-20" })
      )
    ).toBeNull();
  });
});

describe("formatSavedAt", () => {
  it("rend une date lisible en français", () => {
    const out = formatSavedAt(new Date(2026, 6, 21, 14, 30));
    expect(out).toContain("21 juillet");
    expect(out).toContain("14h30");
  });
});
