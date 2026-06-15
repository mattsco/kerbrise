// Template new-booking — design carte postale mer.
import { escapeHtml, emailShell, infoBox, commentBox } from "../html.ts";
import { formatRange } from "../dates.ts";

export interface NewBookingData {
  isModification: boolean;
  requesterFamilyName: string;
  requesterName: string;
  startDateIso: string;
  endDateIso: string;
  note: string | null;
  lastActionComment: string | null;
  testMode: boolean;
}

export function newBookingSubject(d: NewBookingData): string {
  const base = d.isModification
    ? `🔄 Demande modifiée de la famille ${d.requesterFamilyName}`
    : `🆕 Nouvelle demande de la famille ${d.requesterFamilyName}`;
  return d.testMode ? `[TEST] ${base}` : base;
}

export function newBookingHtml(d: NewBookingData): string {

  const intro = d.isModification
    ? `La famille <strong style="color:#1e293b">${d.requesterFamilyName}</strong> (${d.requesterName}) a <strong>modifié les dates</strong> de sa demande de séjour. Une nouvelle validation est nécessaire :`
    : `La famille <strong style="color:#1e293b">${d.requesterFamilyName}</strong> (${d.requesterName}) a fait une nouvelle demande de séjour :`;

  const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">${intro}</p>
${infoBox({
    bg: "#f0f8fb",
    accent: "#2b7a9e",
    inner: `<div style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Séjour demandé</div>
<div style="font-size:17px;color:#1e293b;font-weight:600;">${formatRange(d.startDateIso, d.endDateIso)}</div>
${d.note ? `<div style="font-size:14px;color:#64748b;margin-top:6px;">Note : ${escapeHtml(d.note)}</div>` : ""}`,
  })}
${d.lastActionComment && d.isModification ? commentBox(`Message de ${d.requesterName}`, d.lastActionComment) : ""}
<p style="font-size:15px;color:#475569;line-height:1.6;">Votre validation est nécessaire pour approuver cette demande.</p>`;

  return emailShell({
    badge: d.isModification ? "DEMANDE MODIFIÉE" : "NOUVELLE DEMANDE",
    badgeBg: d.isModification ? "#fef3c7" : "#e0f0f7",
    badgeText: d.isModification ? "#92400e" : "#1a5d7a",
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/demandes",
    ctaLabel: "Voir et décider →",
    ctaColor: "#2b7a9e",
    testMode: d.testMode,
  });
}
