// Template decision (approuvé / refusé) — design carte postale mer.
import { escapeHtml, emailShell, infoBox, commentBox } from "../html.ts";
import { formatRange } from "../dates.ts";

export interface DecisionData {
  isApproved: boolean;
  familyName: string;
  startDateIso: string;
  endDateIso: string;
  note: string | null;
  rejectedByFamily?: string;
  rejectionComment?: string;
  testMode: boolean;
}

export function decisionSubject(d: DecisionData): string {
  if (d.isApproved) {
    const base = `🎉 Demande approuvée : ${formatRange(d.startDateIso, d.endDateIso)}`;
    return d.testMode ? `[TEST] ${base}` : base;
  }
  const base = `❌ Demande refusée par la famille ${d.rejectedByFamily ?? "?"}`;
  return d.testMode ? `[TEST] ${base}` : base;
}

export function decisionHtml(d: DecisionData): string {
  if (d.isApproved) {
    const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">Bonne nouvelle ! La demande de la famille <strong style="color:#1e293b">${d.familyName}</strong> a été <strong style="color:#0f6e56">approuvée par les deux autres familles</strong>.</p>
${infoBox({
      bg: "#e1f5ee",
      accent: "#0f6e56",
      inner: `<div style="font-size:12px;color:#0f6e56;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Séjour confirmé</div>
<div style="font-size:17px;color:#1e293b;font-weight:600;">${formatRange(d.startDateIso, d.endDateIso)}</div>
${d.note ? `<div style="font-size:14px;color:#64748b;margin-top:6px;">Note : ${escapeHtml(d.note)}</div>` : ""}`,
    })}
<p style="font-size:15px;color:#475569;line-height:1.6;">La réservation est officiellement confirmée dans le calendrier ✨</p>`;

    return emailShell({
      badge: "RÉSERVATION CONFIRMÉE",
      badgeBg: "#e1f5ee",
      badgeText: "#0f6e56",
      bodyHtml: body,
      ctaHref: "https://kerbrise.fr/dashboard/calendrier",
      ctaLabel: "Voir le calendrier →",
      ctaColor: "#0f6e56",
      testMode: d.testMode,
    });
  }

  const rejectedByFamily = d.rejectedByFamily ?? "?";
  const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">La demande de séjour a été <strong style="color:#dc2626">refusée par la famille ${rejectedByFamily}</strong>.</p>
${infoBox({
    bg: "#fef2f2",
    accent: "#dc2626",
    inner: `<div style="font-size:17px;color:#1e293b;font-weight:600;">${formatRange(d.startDateIso, d.endDateIso)}</div>
${d.note ? `<div style="font-size:14px;color:#64748b;margin-top:6px;">Note : ${escapeHtml(d.note)}</div>` : ""}`,
  })}
${d.rejectionComment ? commentBox(`Message de la famille ${rejectedByFamily}`, d.rejectionComment) : ""}
<p style="font-size:15px;color:#475569;line-height:1.6;">Tu peux faire une nouvelle demande avec d'autres dates ou discuter directement avec la famille ${rejectedByFamily}.</p>`;

  return emailShell({
    badge: "DEMANDE REFUSÉE",
    badgeBg: "#fef2f2",
    badgeText: "#991b1b",
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/nouvelle-demande",
    ctaLabel: "Nouvelle demande →",
    ctaColor: "#475569",
    testMode: d.testMode,
  });
}
