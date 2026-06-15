// Template reduced — design carte postale mer.
import { emailShell, infoBox, commentBox } from "../html.ts";
import { formatRange, formatShort } from "../dates.ts";

export interface ReducedData {
  familyName: string;
  authorName: string;
  oldStartIso: string;
  oldEndIso: string;
  newStartIso: string;
  newEndIso: string;
  lastActionComment: string | null;
  testMode: boolean;
}

function daysBetween(aIso: string, bIso: string): number {
  const [ay, am, ad] = aIso.split("-").map(Number);
  const [by, bm, bd] = bIso.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

export function reducedFreedDays(d: ReducedData): number {
  return daysBetween(d.oldStartIso, d.newStartIso) + daysBetween(d.newEndIso, d.oldEndIso);
}

export function reducedSubject(d: ReducedData): string {
  const total = reducedFreedDays(d);
  const jourLabel = total > 1 ? "jours" : "jour";
  const base = `📅 ${d.familyName} libère ${total} ${jourLabel} (${formatShort(d.newStartIso)} → ${formatShort(d.newEndIso)})`;
  return d.testMode ? `[TEST] ${base}` : base;
}

export function reducedHtml(d: ReducedData): string {
  const freedStart = daysBetween(d.oldStartIso, d.newStartIso);
  const freedEnd = daysBetween(d.newEndIso, d.oldEndIso);
  const totalFreed = freedStart + freedEnd;
  const jourLabel = totalFreed > 1 ? "jours" : "jour";

  const freedParts: string[] = [];
  if (freedStart > 0) freedParts.push(`du ${formatShort(d.oldStartIso)} au ${formatShort(d.newStartIso)}`);
  if (freedEnd > 0) freedParts.push(`du ${formatShort(d.newEndIso)} au ${formatShort(d.oldEndIso)}`);
  const freedText = freedParts.join(" et ");

  const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">La famille <strong style="color:#1e293b">${d.familyName}</strong> (${d.authorName}) a <strong>raccourci</strong> son séjour. <strong style="color:#0f6e56">${totalFreed} ${jourLabel}</strong> ${totalFreed > 1 ? "se libèrent" : "se libère"} :</p>
${infoBox({
    bg: "#e1f5ee",
    accent: "#0f6e56",
    inner: `<div style="font-size:12px;color:#0f6e56;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Désormais disponible</div>
<div style="font-size:17px;color:#1e293b;font-weight:600;">${freedText}</div>
<div style="font-size:14px;color:#64748b;margin-top:8px;">Séjour conservé : ${formatRange(d.newStartIso, d.newEndIso)}</div>`,
  })}
${d.lastActionComment ? commentBox(`Message de ${d.authorName}`, d.lastActionComment) : ""}
<p style="font-size:15px;color:#475569;line-height:1.6;">Si ce créneau t'intéresse, tu peux faire une demande dans le calendrier.</p>`;

  return emailShell({
    badge: "CRÉNEAU RACCOURCI",
    badgeBg: "#e1f5ee",
    badgeText: "#0f6e56",
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/calendrier",
    ctaLabel: "Voir le calendrier →",
    ctaColor: "#0f6e56",
    testMode: d.testMode,
  });
}
