import { describe, expect, it } from "vitest";
import {
  getMayPonts,
  getPontsForRange,
  getPontPriorityFamily,
  stayTakesPont,
  mergeOverlappingPonts,
  buildPontsState,
  computeDemanderPontAdvisory,
  computeValidatorPontAdvisory,
  type Pont,
  type PontBooking,
} from "./ponts";

// Raccourci : retrouver un pont par le premier de ses noms.
const byName = (ponts: Pont[], name: string) =>
  ponts.find((p) => p.names.includes(name))!;

describe("getMayPonts — fenêtres selon le jour de semaine du férié", () => {
  it("2027 : Ascension (jeu 6→dim 9) et Pentecôte (sam 15→lun 17), 1er/8 mai samedi = pas de pont", () => {
    const ponts = getMayPonts(2027);
    expect(ponts.map((p) => p.names)).toEqual([["Ascension"], ["Pentecôte"]]);
    expect(byName(ponts, "Ascension")).toMatchObject({
      start: "2027-05-06",
      end: "2027-05-09",
      label: "pont de l'Ascension",
    });
    expect(byName(ponts, "Pentecôte")).toMatchObject({
      start: "2027-05-15",
      end: "2027-05-17",
      label: "pont de Pentecôte",
    });
  });

  it("2026 : 1er/8 mai vendredi (ven→dim), Ascension jeudi, Pentecôte lundi", () => {
    const ponts = getMayPonts(2026);
    expect(byName(ponts, "1er Mai")).toMatchObject({
      start: "2026-05-01",
      end: "2026-05-03",
      label: "pont du 1er Mai",
    });
    expect(byName(ponts, "8 Mai")).toMatchObject({
      start: "2026-05-08",
      end: "2026-05-10",
    });
  });

  it("2029 : 1er/8 mai mardi → sam→mar (4j)", () => {
    const p = byName(getMayPonts(2029), "1er Mai");
    expect(p).toMatchObject({ start: "2029-04-28", end: "2029-05-01" });
  });

  it("2030 : 1er/8 mai mercredi = pas de pont, mais Ascension + Pentecôte restent (débordent sur juin)", () => {
    const ponts = getMayPonts(2030);
    expect(ponts.map((p) => p.names[0])).toEqual(["Ascension", "Pentecôte"]);
    // Pentecôte 2030 est en JUIN — incluse quand même (périmètre = les fériés, pas le mois)
    expect(byName(ponts, "Pentecôte")).toMatchObject({
      start: "2030-06-08",
      end: "2030-06-10",
    });
  });

  it("Pâques est exclu du périmètre", () => {
    for (const year of [2026, 2027, 2028]) {
      expect(getMayPonts(year).some((p) => p.names.includes("Pâques"))).toBe(false);
    }
  });

  it("les ponts sont triés chronologiquement", () => {
    const ponts = getMayPonts(2028);
    const starts = ponts.map((p) => p.start);
    expect([...starts].sort()).toEqual(starts);
  });
});

describe("mergeOverlappingPonts — fenêtres qui se chevauchent → pont à double nom", () => {
  it("2035 : Ascension (3→6 mai) et 8 mai (sam 5→mar 8) fusionnent", () => {
    const ponts = getMayPonts(2035);
    const fusion = ponts.find((p) => p.names.length > 1)!;
    expect(fusion.names).toEqual(["Ascension", "8 Mai"]);
    expect(fusion).toMatchObject({
      start: "2035-05-03",
      end: "2035-05-08",
      label: "pont de l'Ascension et du 8 Mai",
    });
    // 1er Mai (mardi) reste séparé
    expect(ponts.some((p) => p.names.length === 1 && p.names[0] === "1er Mai")).toBe(true);
  });

  it("est l'identité sur 0 ou 1 pont", () => {
    expect(mergeOverlappingPonts([])).toEqual([]);
    const single = getMayPonts(2027).slice(0, 1);
    expect(mergeOverlappingPonts(single)).toEqual(single);
  });
});

describe("stayTakesPont / getPontsForRange — au moins une NUIT, jours pivots autorisés", () => {
  const pentecote2027 = byName(getMayPonts(2027), "Pentecôte"); // sam 15 → lun 17

  it("partir le premier jour du pont ne prend aucune nuit", () => {
    // Séjour ... → samedi 15 (départ le 1er jour) : nuits jusqu'au 14, pont = nuits 15,16
    expect(stayTakesPont("2027-05-10", "2027-05-15", pentecote2027)).toBe(false);
  });

  it("arriver le dernier jour du pont ne prend aucune nuit", () => {
    // Arrivée lundi 17 : nuits 17… ; pont = nuits 15,16 → aucune commune
    expect(stayTakesPont("2027-05-17", "2027-05-20", pentecote2027)).toBe(false);
  });

  it("arriver le dimanche d'un pont sam→lun prend la nuit dim→lun", () => {
    expect(stayTakesPont("2027-05-16", "2027-05-18", pentecote2027)).toBe(true);
  });

  it("séjour couvrant tout le pont", () => {
    expect(stayTakesPont("2027-05-15", "2027-05-17", pentecote2027)).toBe(true);
  });

  it("séjour d'un jour (end = start) → 0 nuit → aucun pont", () => {
    expect(getPontsForRange("2027-05-16", "2027-05-16")).toEqual([]);
  });

  it("séjour couvrant DEUX ponts (2028 : 1er mai → 8 mai)", () => {
    const ponts = getPontsForRange("2028-04-29", "2028-05-08");
    expect(ponts.map((p) => p.names[0]).sort()).toEqual(["1er Mai", "8 Mai"]);
  });

  it("séjour hors saison des ponts → []", () => {
    expect(getPontsForRange("2027-07-01", "2027-07-15")).toEqual([]);
  });
});

describe("getPontPriorityFamily — priorité 3 de l'été de la MÊME année", () => {
  it("2027 : François (P3 été 2027)", () => {
    expect(getPontPriorityFamily(2027)).toBe("François");
  });
  it("2028 : Antoine, 2026 : Vincent", () => {
    expect(getPontPriorityFamily(2028)).toBe("Antoine");
    expect(getPontPriorityFamily(2026)).toBe("Vincent");
  });
});

// --- Warnings demandeur -----------------------------------------------------

const book = (o: Partial<PontBooking>): PontBooking => ({
  family_id: "id-" + (o.family_name ?? "x"),
  family_name: "Vincent",
  start_date: "2027-05-06",
  end_date: "2027-05-09",
  status: "approved",
  ...o,
});

describe("computeDemanderPontAdvisory", () => {
  it("null si le séjour ne prend aucun pont", () => {
    const state = buildPontsState(2027, []);
    expect(computeDemanderPontAdvisory("2027-07-01", "2027-07-10", "Vincent", state)).toBeNull();
  });

  it("Cas A : pas prioritaire, la prioritaire (François) n'a pas encore choisi", () => {
    const state = buildPontsState(2027, []);
    const adv = computeDemanderPontAdvisory("2027-05-06", "2027-05-09", "Vincent", state)!;
    expect(adv.priorityFamily).toBe("François");
    expect(adv.caseA).toBe(true);
    expect(adv.caseC).toBe(false);
    expect(adv.caseB).toBeNull();
    expect(adv.priorityPendingLabel).toBeNull();
  });

  it("Cas A mentionne un pont PENDING de la famille prioritaire", () => {
    const state = buildPontsState(2027, [
      book({ family_name: "François", start_date: "2027-05-15", end_date: "2027-05-17", status: "pending" }),
    ]);
    const adv = computeDemanderPontAdvisory("2027-05-06", "2027-05-09", "Vincent", state)!;
    expect(adv.caseA).toBe(true); // pending n'éteint pas le warning
    expect(adv.priorityChosen).toBe(false);
    expect(adv.priorityPendingLabel).toBe("pont de Pentecôte");
  });

  it("Extinction : un pont APPROVED de la prioritaire éteint le cas A", () => {
    const state = buildPontsState(2027, [
      book({ family_name: "François", start_date: "2027-05-15", end_date: "2027-05-17", status: "approved" }),
    ]);
    const adv = computeDemanderPontAdvisory("2027-05-06", "2027-05-09", "Vincent", state)!;
    expect(adv.priorityChosen).toBe(true);
    expect(adv.caseA).toBe(false);
  });

  it("Cas C : la famille prioritaire voit une info positive", () => {
    const state = buildPontsState(2027, []);
    const adv = computeDemanderPontAdvisory("2027-05-06", "2027-05-09", "François", state)!;
    expect(adv.caseC).toBe(true);
    expect(adv.caseA).toBe(false);
  });

  it("Cas B isolé (2028) : 2e pont alors qu'une famille n'a rien", () => {
    // Antoine (prioritaire 2028) a déjà un pont approved → cas A éteint.
    // Vincent tient le 1er Mai approved et demande l'Ascension. François = 0.
    const state = buildPontsState(2028, [
      book({ family_name: "Antoine", start_date: "2028-05-06", end_date: "2028-05-08", status: "approved" }),
      book({ family_name: "Vincent", start_date: "2028-04-29", end_date: "2028-05-01", status: "approved" }),
    ]);
    const adv = computeDemanderPontAdvisory("2028-05-25", "2028-05-28", "Vincent", state)!;
    expect(adv.caseA).toBe(false);
    expect(adv.caseB).toEqual({
      alreadyApproved: true,
      heldLabels: ["pont du 1er Mai"],
      deprived: ["François"],
    });
  });

  it("Prolongation sur le même pont : pas de cas B", () => {
    const state = buildPontsState(2028, [
      book({ family_name: "Vincent", start_date: "2028-05-25", end_date: "2028-05-27", status: "approved" }),
    ]);
    // Vincent ré-étend l'Ascension (même pont) → union inchangée
    const adv = computeDemanderPontAdvisory("2028-05-25", "2028-05-28", "Vincent", state)!;
    expect(adv.caseB).toBeNull();
  });

  it("Séjour couvrant 2 ponts d'un coup = cas B dès la demande (alreadyApproved false)", () => {
    const state = buildPontsState(2028, []);
    const adv = computeDemanderPontAdvisory("2028-04-29", "2028-05-08", "Vincent", state)!;
    expect(adv.ponts.map((p) => p.names[0])).toEqual(["1er Mai", "8 Mai"]);
    expect(adv.caseB?.alreadyApproved).toBe(false);
    expect(adv.caseB?.heldLabels).toEqual(["pont du 1er Mai", "pont du 8 Mai"]);
  });
});

describe("computeValidatorPontAdvisory — faits, aucune reco", () => {
  it("liste la prioritaire, si elle a choisi, et les ponts déjà pris (approved)", () => {
    const state = buildPontsState(2027, [
      book({ family_name: "Antoine", start_date: "2027-05-15", end_date: "2027-05-17", status: "approved" }),
      book({ family_name: "Vincent", start_date: "2027-05-06", end_date: "2027-05-09", status: "pending" }),
    ]);
    const adv = computeValidatorPontAdvisory("2027-05-06", "2027-05-09", state)!;
    expect(adv.ponts[0].label).toBe("pont de l'Ascension");
    expect(adv.priorityFamily).toBe("François");
    expect(adv.priorityChosen).toBe(false); // François n'a rien d'approved
    expect(adv.takenPonts).toEqual([{ label: "pont de Pentecôte", family: "Antoine" }]);
  });

  it("null si le séjour ne prend aucun pont", () => {
    const state = buildPontsState(2027, []);
    expect(computeValidatorPontAdvisory("2027-07-01", "2027-07-10", state)).toBeNull();
  });
});
