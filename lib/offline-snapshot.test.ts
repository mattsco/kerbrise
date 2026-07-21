import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  STALE_AFTER_DAYS,
  formatSavedAt,
  parseSnapshot,
  snapshotFreshness,
  snapshotWindow,
  type OfflineSnapshot,
} from "./offline-snapshot";

function makeSnapshot(savedAt: string): OfflineSnapshot {
  return {
    version: SNAPSHOT_VERSION,
    savedAt,
    from: "2026-04-01",
    to: "2027-07-31",
    bookings: [],
    familyName: "Antoine",
  };
}

describe("snapshotWindow", () => {
  it("couvre M−3 → M+12, bornes de mois", () => {
    // 21 juillet 2026 → du 1er avril 2026 au 31 juillet 2027.
    const { from, to } = snapshotWindow(new Date(2026, 6, 21));
    expect(from).toBe("2026-04-01");
    expect(to).toBe("2027-07-31");
  });

  it("passe les frontières d'année sans décalage", () => {
    // 15 janvier 2027 → octobre 2026 → janvier 2028.
    const { from, to } = snapshotWindow(new Date(2027, 0, 15));
    expect(from).toBe("2026-10-01");
    expect(to).toBe("2028-01-31");
  });

  it("gère un mois de fin plus court que le mois de départ", () => {
    // 31 mars → la borne haute tombe en mars de l'année suivante (31 jours),
    // mais le calcul ne doit jamais produire un 31 avril.
    const { to } = snapshotWindow(new Date(2026, 10, 30)); // 30 novembre 2026
    expect(to).toBe("2027-11-30");
  });
});

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
