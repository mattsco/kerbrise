// Template digest hebdo — v4.
//  1. Changements : PRÉNOM de l'auteur (pas de badge famille), note masquée
//  2. Demandes en attente : "X a fait une demande du A au B, en attente de
//     validation par la/les famille(s) ..." (familles restantes, sing/plur)
//  3. Prochains séjours : liste PLATE triée par date, max 3, prénom auteur,
//     sans année
// Plus aucune couleur de famille (choix de sobriété 2026-06-14).
import { escapeHtml, emailShell } from "../html.ts";
import { formatShort, formatRange } from "../dates.ts";

export interface DigestChange {
  authorName: string;
  startDateIso: string;
  endDateIso: string;
  lastActionComment: string | null;
  previousStartIso: string | null;
  previousEndIso: string | null;
}

export interface DigestPending {
  authorName: string;
  startDateIso: string;
  endDateIso: string;
  pendingFamilies: string[];
}

export interface DigestUpcoming {
  authorName: string;
  startDateIso: string;
  endDateIso: string;
}

export interface DigestData {
  newApprovals: DigestChange[];
  reductions: DigestChange[];
  cancellations: DigestChange[];
  pending: DigestPending[];
  // liste PLATE déjà triée par date de début (la fonction Edge trie + slice 3)
  upcoming: DigestUpcoming[];
  testMode: boolean;
}

export function digestSubject(d: DigestData): string {
  const changes = d.newApprovals.length + d.reductions.length + d.cancellations.length;
  let base: string;
  if (changes > 0) {
    base = `🏡 Kerbrise — ${changes} ${changes > 1 ? "mises à jour" : "mise à jour"} cette semaine`;
  } else {
    const p = d.pending.length;
    base = `🏡 Kerbrise — ${p} ${p > 1 ? "demandes en attente" : "demande en attente"}`;
  }
  return d.testMode ? `[TEST] ${base}` : base;
}

const SECTION = "#334155";

function changeList(items: DigestChange[], extra: (b: DigestChange) => string): string {
  return `<ul style="margin:0;padding-left:20px;">
${items.map((b) => `
<li style="margin:6px 0;color:#334155;">
<strong>${escapeHtml(b.authorName)}</strong> du ${formatShort(b.startDateIso)} au ${formatShort(b.endDateIso)}${extra(b)}
</li>`).join("")}
</ul>`;
}

function joinFamilies(names: string[]): string {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} et ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} et ${names[names.length - 1]}`;
}

export function digestHtml(d: DigestData): string {
  let changesHtml = "";

  if (d.newApprovals.length > 0) {
    changesHtml += `
<div style="margin:20px 0 0;">
<h3 style="color:${SECTION};margin:0 0 8px;font-size:16px;">✨ Nouvelles réservations confirmées</h3>
${changeList(d.newApprovals, () => "")}
</div>`;
  }

  if (d.reductions.length > 0) {
    changesHtml += `
<div style="margin:20px 0 0;">
<h3 style="color:${SECTION};margin:0 0 8px;font-size:16px;">🔄 Modifications</h3>
${changeList(d.reductions, (b) => `
<span style="color:#94a3b8;font-size:13px;">(était : ${formatShort(b.previousStartIso || b.startDateIso)} → ${formatShort(b.previousEndIso || b.endDateIso)})</span>${b.lastActionComment ? `<br><span style="color:#64748b;font-size:13px;">💬 ${escapeHtml(b.lastActionComment)}</span>` : ""}`)}
</div>`;
  }

  if (d.cancellations.length > 0) {
    changesHtml += `
<div style="margin:20px 0 0;">
<h3 style="color:${SECTION};margin:0 0 8px;font-size:16px;">🚫 Annulations (créneaux libérés)</h3>
${changeList(d.cancellations, (b) => ` — créneau désormais libre${b.lastActionComment ? `<br><span style="color:#64748b;font-size:13px;">💬 ${escapeHtml(b.lastActionComment)}</span>` : ""}`)}
</div>`;
  }

  // PARTIE 2 — demandes en attente
  let pendingHtml = "";
  if (d.pending.length > 0) {
    pendingHtml = `
<div style="margin:20px 0 0;">
<h3 style="color:${SECTION};margin:0 0 8px;font-size:16px;">⏳ Demandes en attente</h3>
${d.pending.map((p) => {
      const fams = joinFamilies(p.pendingFamilies);
      const famLabel = p.pendingFamilies.length > 1 ? `les familles ${fams}` : `la famille ${fams}`;
      return `<p style="margin:8px 0;font-size:15px;color:#334155;line-height:1.5;">${escapeHtml(p.authorName)} a fait une demande <strong>du ${formatShort(p.startDateIso)} au ${formatShort(p.endDateIso)}</strong>, en attente de validation par ${famLabel}.</p>`;
    }).join("")}
</div>`;
  }

  // PARTIE 3 — prochains séjours (liste plate triée, max 3, sans année)
  let upcomingHtml = "";
  if (d.upcoming.length === 0) {
    upcomingHtml = `<p style="color:#94a3b8;font-style:italic;margin:8px 0 0;">Aucun séjour prévu prochainement.</p>`;
  } else {
    upcomingHtml = `<ul style="margin:8px 0 0;padding-left:20px;">
${d.upcoming.slice(0, 3).map((u) => `
<li style="margin:6px 0;color:#334155;"><strong>${escapeHtml(u.authorName)}</strong> ${formatRange(u.startDateIso, u.endDateIso, { noYear: true })}</li>`).join("")}
</ul>`;
  }

  const body = `
<p style="font-size:16px;color:#334155;line-height:1.6;margin:16px 0 0;">Voici les nouveautés de la semaine sur le calendrier :</p>
${changesHtml}
${pendingHtml}
<hr style="border:none;border-top:1px solid #e2e8f0;margin:28px 0 0;">
<h3 style="color:${SECTION};font-size:16px;margin:20px 0 0;">📅 Prochains séjours</h3>
${upcomingHtml}`;

  return emailShell({
    badge: "RÉCAP HEBDOMADAIRE",
    badgeBg: "#e0f0f7",
    badgeText: "#1a5d7a",
    bodyHtml: body,
    ctaHref: "https://kerbrise.fr/dashboard/calendrier",
    ctaLabel: "Voir le calendrier complet →",
    ctaColor: "#2b7a9e",
    testMode: d.testMode,
    footerExtra: "Récap envoyé chaque dimanche · uniquement s'il y a du nouveau",
  });
}
