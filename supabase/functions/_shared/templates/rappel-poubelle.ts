// Template rappel « poubelle bleue » (#40) — design carte postale mer.
import { emailShell } from "../html.ts";
import { RECYCLABLES_COLOR } from "../garbage-collection.ts";

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
  // Le tutoiement direct (« n'oublie pas ») est un choix ASSUMÉ : le
  // destinataire n'est pas forcément sur place, mais Antoine a tranché —
  // « s'ils ne sont pas à Kerbrise ils forwarderont ».
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
