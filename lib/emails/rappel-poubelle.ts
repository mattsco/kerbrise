/**
 * Template e-mail « poubelle bleue » (#40).
 *
 * ⚠️ IMPORT INHABITUEL, VOLONTAIRE — `emailShell` vient de
 * `supabase/functions/_shared/html.ts`, un fichier écrit pour Deno.
 *
 * Pourquoi : les cinq autres e-mails de Kerbrise partent d'Edge Functions et
 * partagent cet habillage (image d'en-tête, pastille, CTA, pied de page).
 * Celui-ci part d'une route Next (cf. spec §D1 : le calendrier des collectes
 * doit rester dans `lib/` pour être couvert par le check santé #33). Recopier
 * le squelette aurait donné DEUX habillages à corriger au prochain changement
 * de design — exactement ce que #37 a refusé pour le guide télé.
 *
 * L'import ne marche que parce que `html.ts` n'a AUCUN import : pas
 * d'extension `.ts` à résoudre, pas de global Deno. C'est fragile, donc
 * `rappel-poubelle.test.ts` rend le template pour de vrai — si quelqu'un
 * ajoute un import Deno dans `html.ts`, la CI casse tout de suite au lieu de
 * laisser passer un build de prod mort. Piège n°6 de `docs/guides/pieges-connus.md`.
 */

import { emailShell } from "../../supabase/functions/_shared/html";
import { RECYCLABLES_COLOR } from "../garbage-collection";

export interface RappelPoubelleData {
  /** Prénom du destinataire, ex. "Vincent". */
  prenom: string;
  testMode: boolean;
}

export function rappelPoubelleSubject(d: RappelPoubelleData): string {
  const base = "🔵 Petit rappel — la poubelle bleue, ce soir";
  return d.testMode ? `[TEST] ${base}` : base;
}

export function rappelPoubelleHtml(d: RappelPoubelleData): string {
  // Texte écrit par Antoine (29 août 2026), repris tel quel à un accord près
  // (« la poubelle bleue », féminin). Trois lignes, pas de date dans le corps,
  // pas de consignes de tri : l'e-mail arrive la veille au soir, « demain
  // matin » suffit.
  //
  // Le tutoiement direct (« n'oublie pas ») est un choix ASSUMÉ, et il revient
  // sur la prudence de la spec §D3 : le destinataire n'est pas forcément sur
  // place, mais Antoine a tranché — « s'ils ne sont pas à Kerbrise ils
  // forwarderont ». Dans cette famille on se parle comme ça.
  const body = `
    <p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">Hello ${d.prenom},</p>
    <p style="font-size:16px;color:#334155;line-height:1.6;margin:12px 0 0;">Le camion des recyclables passe demain matin.</p>
    <p style="font-size:16px;color:#334155;line-height:1.6;margin:12px 0 0;">N'oublie pas de sortir la poubelle bleue 😉</p>`;

  return emailShell({
    badge: "PETIT RAPPEL",
    badgeBg: "#eaeef7",
    badgeText: RECYCLABLES_COLOR,
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/a-propos",
    ctaLabel: "Les infos de la maison →",
    ctaColor: RECYCLABLES_COLOR,
    testMode: d.testMode,
  });
}
