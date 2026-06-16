// lib/sea-temp.ts

/**
 * Température de l'eau de la mer à Saint-Malo, scrapée sur cabaigne.net.
 *
 * Choisie après échec des autres pistes (Open-Meteo Marine lisait ~19° au lieu
 * de ~15° ; letelegramme & lachainemeteo non récupérables pour caler le sélecteur).
 * cabaigne expose une mesure satellite de surface, régionale (Saint-Malo, pas la
 * plage du Val précisément) mais réaliste, et la page est récupérable.
 *
 * ⚠️ Pas de noms de classes stables connus → on parse par ANCRAGE TEXTUEL (la
 * phrase « est au maximum de » qui précède la valeur temps réel, sinon la 1ʳᵉ
 * ligne « température de la mer : » du listing 7 jours = aujourd'hui). Plus robuste
 * qu'un sélecteur CSS qu'on ne peut pas vérifier. Caché 3h, timeout, non-throwing,
 * borne de plausibilité (0-35°). La ligne disparaît côté UI si rien n'est extrait.
 */

import * as cheerio from "cheerio";

const URL = "https://www.cabaigne.net/france/bretagne/saint-malo/";

const PATTERNS: readonly RegExp[] = [
  /est au maximum de\s*:?\s*([0-9]{1,2}(?:[.,][0-9])?)\s*°/i,
  /température de la mer\s*:?\s*([0-9]{1,2}(?:[.,][0-9])?)\s*°/i,
];

export async function getSaintMaloWaterTemp(): Promise<number | null> {
  try {
    const res = await fetch(URL, {
      headers: { "User-Agent": "Kerbrise/1.0 (+https://kerbrise.fr)" },
      next: { revalidate: 10800 }, // 3h
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;

    // Aplatir en texte : on s'affranchit de la structure HTML (classes inconnues).
    const text = cheerio.load(await res.text()).root().text().replace(/\s+/g, " ");

    for (const re of PATTERNS) {
      const m = re.exec(text);
      if (!m) continue;
      const n = parseFloat(m[1].replace(",", "."));
      if (Number.isFinite(n) && n > 0 && n < 35) return n;
    }
    return null;
  } catch {
    return null;
  }
}
