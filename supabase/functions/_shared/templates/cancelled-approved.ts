// Template cancelled-approved — design carte postale mer.
import { emailShell, infoBox, commentBox } from "../html.ts";
import { formatRange, formatShort } from "../dates.ts";

export interface CancelledData {
  familyName: string;
  authorName: string;
  startDateIso: string;
  endDateIso: string;
  lastActionComment: string | null;
  testMode: boolean;
}

export function cancelledSubject(d: CancelledData): string {
  const base = `🚫 Annulation : ${d.familyName} libère ${formatShort(d.startDateIso)} → ${formatShort(d.endDateIso)}`;
  return d.testMode ? `[TEST] ${base}` : base;
}

export function cancelledHtml(d: CancelledData): string {
  const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">La famille <strong style="color:#1e293b">${d.familyName}</strong> (${d.authorName}) a <strong>annulé</strong> sa réservation confirmée. Le créneau est désormais <strong style="color:#0f6e56">disponible</strong> :</p>
${infoBox({
    bg: "#e1f5ee",
    accent: "#0f6e56",
    inner: `<div style="font-size:12px;color:#0f6e56;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Créneau libéré</div>
<div style="font-size:17px;color:#1e293b;font-weight:600;">${formatRange(d.startDateIso, d.endDateIso)}</div>`,
  })}
${d.lastActionComment ? commentBox(`Message de ${d.authorName}`, d.lastActionComment) : ""}`;

  return emailShell({
    badge: "CRÉNEAU LIBÉRÉ",
    badgeBg: "#e1f5ee",
    badgeText: "#0f6e56",
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/calendrier",
    ctaLabel: "Voir le calendrier →",
    ctaColor: "#0f6e56",
    testMode: d.testMode,
  });
}
