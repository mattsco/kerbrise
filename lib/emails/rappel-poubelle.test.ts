import { describe, it, expect } from "vitest";
import { rappelPoubelleHtml, rappelPoubelleSubject } from "./rappel-poubelle";
import {
  RECYCLABLES_COLOR,
  MENAGERES_COLOR,
  getNextCollections,
} from "../garbage-collection";

const BASE = { prenom: "Vincent", testMode: false };

describe("couleurs des bacs — relevées sur place le 29/08/2026", () => {
  // Les valeurs d'origine (vert / jaune) étaient une supposition, et elles
  // étaient fausses. Ces tests existent pour qu'on ne redérive plus : le bac
  // de recyclage est BLEU, celui des ordures ménagères MARRON.
  it("recyclables = bleu, ordures ménagères = marron", () => {
    expect(RECYCLABLES_COLOR).toBe("#08288b");
    expect(MENAGERES_COLOR).toBe("#97675e");
  });

  it("la collecte porte sa couleur et son emoji, pour l'UI comme pour l'e-mail", () => {
    const { menageres, recyclables } = getNextCollections(new Date(2026, 8, 1));
    expect(menageres.color).toBe(MENAGERES_COLOR);
    expect(menageres.emoji).toBe("🟤");
    expect(recyclables?.color).toBe(RECYCLABLES_COLOR);
    expect(recyclables?.emoji).toBe("🔵");
  });

  it("plus aucune trace des anciennes couleurs", () => {
    const html = rappelPoubelleHtml(BASE);
    expect(html).not.toContain("🟡");
    expect(html).not.toContain("🟢");
    expect(html).not.toMatch(/jaune/i);
  });
});

describe("rappelPoubelleSubject", () => {
  it("reprend l'objet écrit par Antoine, accord corrigé", () => {
    // « poubelle » est féminin → « bleue ». Seule retouche au texte d'origine.
    expect(rappelPoubelleSubject(BASE)).toBe(
      "🔵 Petit rappel — la poubelle bleue, ce soir"
    );
  });

  it("préfixe [TEST] en mode test, comme les cinq autres e-mails", () => {
    expect(rappelPoubelleSubject({ ...BASE, testMode: true })).toMatch(/^\[TEST\]/);
  });
});

describe("rappelPoubelleHtml", () => {
  const html = rappelPoubelleHtml(BASE);

  it("⚠️ garde-fou d'import : rend l'habillage Deno partagé sans casser", () => {
    // `emailShell` vit dans supabase/functions/_shared/html.ts, écrit pour
    // Deno. Il n'est importable ici QUE tant qu'il reste sans import. Si
    // quelqu'un y ajoute un `from "./x.ts"`, ce test casse en CI — au lieu de
    // laisser partir un build de prod mort. Cf. pieges-connus.md n°6.
    expect(html).toContain("kerbrise.fr/val-email-kerbrise.jpg");
    expect(html).toContain("PETIT RAPPEL");
    expect(html.length).toBeGreaterThan(500);
  });

  it("reprend les trois lignes d'Antoine, mot pour mot", () => {
    expect(html).toContain("Hello Vincent,");
    expect(html).toContain("Le camion des recyclables passe demain matin.");
    expect(html).toContain("N'oublie pas de sortir la poubelle bleue 😉");
  });

  it("reste très court : trois lignes, pas de consignes de tri", () => {
    const texte = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    expect(texte.length).toBeLessThan(220);
    expect(texte).not.toMatch(/cartons|conserves/i);
  });

  it("ne met pas de date dans le corps : « demain matin » suffit la veille au soir", () => {
    expect(html).not.toMatch(/septembre|octobre|janvier/i);
  });

  it("ne laisse aucun trou de template", () => {
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("NaN");
    expect(html).not.toContain("${");
  });

  it("bascule le pied de page en mode test", () => {
    expect(rappelPoubelleHtml({ ...BASE, testMode: true })).toContain("Mode test");
    expect(html).toContain("Production");
  });
});
