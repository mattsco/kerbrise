// supabase/functions/_dev/preview.ts
//
// Preview LOCALE des emails Kerbrise. Zéro DB, zéro envoi.
// Rend chaque template pur avec des données fictives couvrant toutes les
// variantes, écrit des .html dans ./preview-output/ + un index.html.
//
// Lancer depuis la racine du repo :
//   deno run --allow-write supabase/functions/_dev/preview.ts
// Puis ouvrir supabase/functions/_dev/preview-output/index.html dans le navigateur.
//
// Note : ce script n'est JAMAIS déployé (dossier _dev/). C'est un outil de dev.

import { newBookingHtml, newBookingSubject } from "../_shared/templates/new-booking.ts";
import { decisionHtml, decisionSubject } from "../_shared/templates/decision.ts";
import { cancelledHtml, cancelledSubject } from "../_shared/templates/cancelled-approved.ts";
import { reducedHtml, reducedSubject } from "../_shared/templates/reduced.ts";
import { digestHtml, digestSubject } from "../_shared/templates/digest.ts";
import { rappelPoubelleHtml, rappelPoubelleSubject } from "../_shared/templates/rappel-poubelle.ts";

type Variant = { name: string; subject: string; html: string };

const variants: Variant[] = [];
const add = (name: string, subject: string, html: string) =>
  variants.push({ name, subject, html });

// ─── new-booking ───────────────────────────────────────────────────────────
{
  const base = {
    requesterFamilyName: "Antoine",
    requesterName: "Matthieu",
    startDateIso: "2026-07-15",
    endDateIso: "2026-07-22",
    note: "Vacances d'été avec les enfants",
    testMode: false,
  };
  add("new-booking — création",
    newBookingSubject({ ...base, isModification: false, lastActionComment: null }),
    newBookingHtml({ ...base, isModification: false, lastActionComment: null }));
  add("new-booking — modification (avec commentaire)",
    newBookingSubject({ ...base, isModification: true, lastActionComment: "On décale d'une semaine" }),
    newBookingHtml({ ...base, isModification: true, lastActionComment: "On décale d'une semaine" }));
}

// ─── decision ──────────────────────────────────────────────────────────────
{
  const base = {
    familyName: "Vincent",
    startDateIso: "2026-08-01",
    endDateIso: "2026-08-12",
    note: "Semaine plage",
    testMode: false,
  };
  add("decision — approuvée",
    decisionSubject({ ...base, isApproved: true }),
    decisionHtml({ ...base, isApproved: true }));
  add("decision — refusée (avec commentaire)",
    decisionSubject({ ...base, isApproved: false, rejectedByFamily: "François", rejectionComment: "On avait prévu cette semaine aussi, désolé" }),
    decisionHtml({ ...base, isApproved: false, rejectedByFamily: "François", rejectionComment: "On avait prévu cette semaine aussi, désolé" }));
  add("decision — refusée (sans commentaire)",
    decisionSubject({ ...base, isApproved: false, rejectedByFamily: "François", rejectionComment: "" }),
    decisionHtml({ ...base, isApproved: false, rejectedByFamily: "François", rejectionComment: "" }));
}

// ─── cancelled-approved ──────────────────────────────────────────────────────
{
  const base = {
    familyName: "François",
    authorName: "Léa",
    startDateIso: "2026-09-05",
    endDateIso: "2026-09-15",
    testMode: false,
  };
  add("cancelled — avec commentaire",
    cancelledSubject(base),
    cancelledHtml({ ...base, lastActionComment: "Imprévu professionnel, on libère" }));
  add("cancelled — sans commentaire",
    cancelledSubject(base),
    cancelledHtml({ ...base, lastActionComment: null }));
}

// ─── reduced ─────────────────────────────────────────────────────────────────
{
  const base = {
    familyName: "Antoine",
    authorName: "Matthieu",
    oldStartIso: "2026-06-15",
    oldEndIso: "2026-06-30",
    lastActionComment: null as string | null,
    testMode: false,
  };
  add("reduced — par la fin (5 jours)",
    reducedSubject({ ...base, newStartIso: "2026-06-15", newEndIso: "2026-06-25" }),
    reducedHtml({ ...base, newStartIso: "2026-06-15", newEndIso: "2026-06-25" }));
  add("reduced — par le début (5 jours)",
    reducedSubject({ ...base, newStartIso: "2026-06-20", newEndIso: "2026-06-30" }),
    reducedHtml({ ...base, newStartIso: "2026-06-20", newEndIso: "2026-06-30" }));
  add("reduced — deux côtés (6 jours, avec commentaire)",
    reducedSubject({ ...base, newStartIso: "2026-06-18", newEndIso: "2026-06-27" }),
    reducedHtml({ ...base, lastActionComment: "On raccourcit des deux côtés", newStartIso: "2026-06-18", newEndIso: "2026-06-27" }));
}

// ─── digest ──────────────────────────────────────────────────────────────────
{
  const mkChange = (author: string, s: string, e: string, x: Partial<{ lastActionComment: string | null; previousStartIso: string | null; previousEndIso: string | null }> = {}) => ({
    authorName: author, startDateIso: s, endDateIso: e,
    lastActionComment: x.lastActionComment ?? null,
    previousStartIso: x.previousStartIso ?? null,
    previousEndIso: x.previousEndIso ?? null,
  });

  // Digest complet : 3 types de changements + 1 pending + prochains séjours triés
  const fullData = {
    newApprovals: [mkChange("Claire", "2026-07-15", "2026-07-22")],
    reductions: [mkChange("Paul", "2026-08-01", "2026-08-08", { previousStartIso: "2026-08-01", previousEndIso: "2026-08-12", lastActionComment: "Raccourci" })],
    cancellations: [mkChange("Léa", "2026-09-05", "2026-09-15")],
    pending: [{ authorName: "Matthieu", startDateIso: "2026-10-10", endDateIso: "2026-10-17", pendingFamilies: ["Vincent", "François"] }],
    upcoming: [
      { authorName: "Antoine", startDateIso: "2026-06-15", endDateIso: "2026-06-28" },
      { authorName: "Vincent", startDateIso: "2026-06-29", endDateIso: "2026-07-19" },
      { authorName: "Claire", startDateIso: "2026-07-20", endDateIso: "2026-08-09" },
    ],
    testMode: false,
  };
  add("digest — complet (3 parties)", digestSubject(fullData), digestHtml(fullData));

  // Digest "uniquement en attente" : sing + plur
  const pendingOnly = {
    newApprovals: [], reductions: [], cancellations: [],
    pending: [
      { authorName: "Léa", startDateIso: "2026-10-10", endDateIso: "2026-10-17", pendingFamilies: ["Vincent"] },
      { authorName: "Paul", startDateIso: "2026-11-01", endDateIso: "2026-11-05", pendingFamilies: ["Antoine", "Vincent"] },
    ],
    upcoming: [],
    testMode: false,
  };
  add("digest — uniquement en attente (sing + plur)", digestSubject(pendingOnly), digestHtml(pendingOnly));
}

// ─── rappel-poubelle (#40) ─────────────────────────────────────────────────
{
  // Cas réel : mardi 8 septembre 2026, famille Vincent sur place
  // (séjour du 31 août au 14 septembre), collecte le mercredi 9.
  for (const [nom, data] of [
    ["rappel-poubelle — production", { prenom: "Vincent", testMode: false }],
    ["rappel-poubelle — mode test", { prenom: "Vincent", testMode: true }],
    ["rappel-poubelle — prénom accentué", { prenom: "François", testMode: false }],
  ] as const) {
    add(nom, rappelPoubelleSubject(data), rappelPoubelleHtml(data));
  }
}

// ─── Écriture des fichiers ───────────────────────────────────────────────────
const outDir = new URL("./preview-output/", import.meta.url);
try {
  await Deno.mkdir(outDir, { recursive: true });
} catch { /* existe déjà */ }

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

const indexRows: string[] = [];
for (const v of variants) {
  const file = `${slug(v.name)}.html`;
  // On enveloppe le HTML email dans une page avec fond gris pour voir les marges
  const page = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${v.name}</title>
<style>body{margin:0;background:#e2e8f0;font-family:-apple-system,sans-serif}
.bar{background:#0f172a;color:#fff;padding:10px 16px;font-size:13px}
.bar b{color:#94a3b8;font-weight:400}
.frame{background:#fff;max-width:600px;margin:24px auto;box-shadow:0 4px 16px rgba(0,0,0,.1)}</style></head>
<body><div class="bar"><b>Sujet :</b> ${v.subject.replace(/</g, "&lt;")}</div>
<div class="frame">${v.html}</div></body></html>`;
  await Deno.writeTextFile(new URL(file, outDir), page);
  indexRows.push(`<li><a href="${file}">${v.name}</a><br><span style="color:#64748b;font-size:13px">${v.subject.replace(/</g, "&lt;")}</span></li>`);
}

const index = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Kerbrise — Preview emails</title>
<style>body{font-family:-apple-system,sans-serif;max-width:700px;margin:40px auto;padding:0 20px;color:#1e293b}
h1{font-size:22px}ul{line-height:1.8}li{margin:12px 0}a{color:#0f172a;font-weight:600}</style></head>
<body><h1>🏡 Kerbrise — Preview des emails</h1>
<p style="color:#64748b">${variants.length} variantes rendues localement. Aucun envoi, aucune base de données.</p>
<ul>${indexRows.join("\n")}</ul></body></html>`;
await Deno.writeTextFile(new URL("index.html", outDir), index);

console.log(`✅ ${variants.length} previews écrites dans supabase/functions/_dev/preview-output/`);
console.log("   Ouvre index.html dans ton navigateur.");
