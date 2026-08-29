import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getNextCollections,
  getNextCollection,
  formatRelativeDate,
} from "@/supabase/functions/_shared/garbage-collection";

// ⚠️ Le module testé vit dans supabase/functions/_shared/ — il est partagé
// avec l'Edge Function send-bin-reminder (#40) et doit rester sans import
// pour passer les deux runtimes. Le TEST, lui, reste dans lib/ : c'est la
// règle du projet (« tests colocalisés dans lib/ uniquement », spec #34) et
// l'include de vitest.config.ts.

// Construit une date locale sans passer par le parse UTC de new Date(iso).
const local = (y: number, m1: number, d: number) => new Date(y, m1 - 1, d);

describe("getNextCollections — ordures ménagères (tous les lundis)", () => {
  it("un lundi compte comme « prochain lundi » (inclus)", () => {
    const { menageres } = getNextCollections(local(2026, 6, 1)); // lundi 1er juin
    expect(menageres.date.getDay()).toBe(1);
    expect(menageres.date.getDate()).toBe(1);
  });

  it("depuis un jeudi → lundi suivant ; depuis un dimanche → lendemain", () => {
    const thursday = getNextCollections(local(2026, 6, 4)).menageres;
    expect([thursday.date.getDate(), thursday.date.getDay()]).toEqual([8, 1]);
    const sunday = getNextCollections(local(2026, 6, 7)).menageres;
    expect(sunday.date.getDate()).toBe(8);
  });
});

describe("getNextCollections — recyclables (mercredis 1/2 depuis le 3 juin 2026)", () => {
  it("avant le démarrage : première collecte = mercredi 3 juin 2026", () => {
    const { recyclables } = getNextCollections(local(2026, 5, 1));
    expect(recyclables?.date.getTime()).toBe(local(2026, 6, 3).getTime());
  });

  it("respecte la quinzaine : semaine impaire → saute au mercredi suivant", () => {
    // Jeudi 4 juin : le mercredi 10 est en semaine impaire → 17 juin
    const { recyclables } = getNextCollections(local(2026, 6, 4));
    expect(recyclables?.date.getTime()).toBe(local(2026, 6, 17).getTime());
    // Le 17 juin même : collecte le jour même
    const sameDay = getNextCollections(local(2026, 6, 17)).recyclables;
    expect(sameDay?.date.getTime()).toBe(local(2026, 6, 17).getTime());
  });

  it("après la fin du calendrier connu (31 janv 2027) → null", () => {
    expect(getNextCollections(local(2027, 2, 15)).recyclables).toBeNull();
  });
});

describe("getNextCollection — la plus proche tous types confondus", () => {
  it("retourne la première des deux", () => {
    // Mardi 2 juin 2026 : recyclables mercredi 3, ménagères lundi 8
    const next = getNextCollection(local(2026, 6, 2));
    expect(next.type).toBe("recyclables");
    // Jeudi 4 juin : ménagères lundi 8 avant recyclables mercredi 17
    expect(getNextCollection(local(2026, 6, 4)).type).toBe("menageres");
  });

  it("sans recyclables (calendrier fini), retombe sur les ménagères", () => {
    expect(getNextCollection(local(2027, 6, 1)).type).toBe("menageres");
  });
});

describe("formatRelativeDate", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("aujourd'hui / demain / dans N jours / dans N semaines", () => {
    vi.useFakeTimers();
    vi.setSystemTime(local(2026, 6, 1));
    expect(formatRelativeDate(local(2026, 6, 1))).toBe("aujourd'hui");
    expect(formatRelativeDate(local(2026, 6, 2))).toBe("demain");
    expect(formatRelativeDate(local(2026, 6, 8))).toBe("dans 7 jours");
    expect(formatRelativeDate(local(2026, 6, 16))).toBe("dans 2 semaines");
  });
});
