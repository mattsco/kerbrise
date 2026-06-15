// supabase/functions/_shared/html.ts
//
// Squelette email Kerbrise — v2 compatible Gmail.
// Corrections (2026-06-14) après tests réels Gmail :
//  - en-tête = simple <img> (le titre "Kerbrise" est INCRUSTÉ dans l'image
//    val-email-kerbrise.jpg). Plus de position:absolute (Gmail l'ignore →
//    bande bleue vide). alt de secours si l'image est bloquée.
//  - structure CONTINUE : footer intégré au flux, sans <div> détaché ni
//    border-top+fond distinct qui font que Gmail le replie comme une
//    "citation" (les "3 petits points" qui masquaient CTA + footer).

const HEADER_IMG = "https://kerbrise.fr/val-email-kerbrise.jpg";

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// Minifie le HTML email : retire les retours à la ligne et l'indentation
// ENTRE les balises. Gmail interprète certaines séquences `</div>\n` comme
// une fin de message et replie le reste derrière "..." (les 3 points qui
// masquaient le bouton + footer). Un email doit être sur une ligne continue.
// N.B. : ne touche QUE l'espace entre balises (>...<), jamais le texte —
// les espaces significatifs (ex. "Antoine</strong> (Matthieu)") sont préservés.
export function minifyEmailHtml(html: string): string {
  return html
    .replace(/>\s+</g, "><")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export interface ShellOptions {
  badge: string;
  badgeBg: string;
  badgeText: string;
  bodyHtml: string;
  ctaHref: string;
  ctaLabel: string;
  ctaColor: string;
  testMode: boolean;
  footerExtra?: string;
}

export function emailShell(o: ShellOptions): string {
  const modeLine = o.testMode ? "Mode test" : "Production";
  const footerExtra = o.footerExtra ? `${o.footerExtra}<br>` : "";

  return minifyEmailHtml(`
<div style="background:#cfe4ee;padding:24px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">

<img src="${HEADER_IMG}" alt="Kerbrise — Saint-Malo" width="560" style="display:block;width:100%;height:auto;border:0;" />

<div style="padding:24px 26px 26px;">
<div style="display:inline-block;background:${o.badgeBg};color:${o.badgeText};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;letter-spacing:.5px;">${o.badge}</div>
${o.bodyHtml}
<div style="margin:24px 0 0;">
<a href="${o.ctaHref}" style="display:inline-block;background:${o.ctaColor};color:#ffffff;padding:13px 28px;border-radius:10px;text-decoration:none;font-weight:600;font-size:15px;">${o.ctaLabel}</a>
</div>
<p style="margin:28px 0 0;font-size:12px;color:#94a3b8;line-height:1.5;">🌊 ${footerExtra}Email automatique de Kerbrise · ${modeLine}</p>
</div>

</div>
</div>
`);
}

export function infoBox(opts: { bg: string; accent: string; inner: string }): string {
  return `<div style="background:${opts.bg};border-left:4px solid ${opts.accent};border-radius:6px;padding:16px;margin:18px 0;">
${opts.inner}
</div>`;
}

export function commentBox(authorLabel: string, comment: string): string {
  return `<div style="background:#fef3c7;border-radius:6px;padding:14px;margin:16px 0;border-left:4px solid #f59e0b;">
<p style="margin:0;font-size:14px;color:#92400e;"><strong>${authorLabel} :</strong></p>
<p style="margin:4px 0 0;font-size:14px;color:#78350f;">${escapeHtml(comment)}</p>
</div>`;
}
