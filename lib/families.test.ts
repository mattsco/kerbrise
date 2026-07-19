import { describe, expect, it } from "vitest";
import { FAMILIES, FAMILY_NAMES, FAMILY_COLORS, getFamilyColor } from "./families";

describe("FAMILIES — ordre = cycle de rotation été (NE PAS RÉORDONNER)", () => {
  it("l'ordre du tableau est verrouillé : Antoine, Vincent, François", () => {
    // Cet ordre EST l'ancre 2024 de summer-priorities.ts. Le réordonner
    // décale toutes les priorités d'été : ce test échoue avant la dispute.
    expect(FAMILIES.map((f) => f.name)).toEqual([
      "Antoine",
      "Vincent",
      "François",
    ]);
    expect(FAMILY_NAMES).toEqual(["Antoine", "Vincent", "François"]);
  });

  it("chaque famille a une couleur hex", () => {
    for (const f of FAMILIES) {
      expect(f.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});

describe("getFamilyColor", () => {
  it("retourne la couleur de la famille", () => {
    expect(getFamilyColor("Antoine")).toBe(FAMILY_COLORS.Antoine);
    expect(getFamilyColor("François")).toBe("#10b981");
  });

  it("fallback gris pour nom inconnu, null ou undefined", () => {
    expect(getFamilyColor("Dupont")).toBe("#888");
    expect(getFamilyColor(null)).toBe("#888");
    expect(getFamilyColor(undefined)).toBe("#888");
  });
});
