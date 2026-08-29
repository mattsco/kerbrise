// scripts/preview-rappel-poubelle.ts
//
// Preview LOCALE de l'e-mail « bac bleu » (#40). Zéro DB, zéro envoi.
//
// Pendant Next du `supabase/functions/_dev/preview.ts` qui couvre les cinq
// e-mails Deno : celui-ci part d'une route Next (spec §D1), donc son template
// vit dans `lib/emails/` et ne peut pas être rendu par le script Deno. Les
// deux écrivent dans le MÊME dossier de sortie — un seul endroit où regarder
// à quoi ressemblent les e-mails de Kerbrise.
//
// Lancer depuis la racine du repo :
//   npx tsx scripts/preview-rappel-poubelle.ts
// Puis ouvrir supabase/functions/_dev/preview-output/rappel-poubelle.html

import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import {
  rappelPoubelleHtml,
  rappelPoubelleSubject,
} from "../lib/emails/rappel-poubelle";

const OUT_DIR = join(
  process.cwd(),
  "supabase",
  "functions",
  "_dev",
  "preview-output"
);

// Le cas réel : mardi 8 septembre 2026, famille Vincent sur place
// (séjour du 31 août au 14 septembre), collecte le mercredi 9.
const variants = [
  {
    nom: "Production — Vincent",
    data: { prenom: "Vincent", testMode: false },
  },
  {
    nom: "Mode test — objet préfixé [TEST]",
    data: { prenom: "Vincent", testMode: true },
  },
  {
    nom: "Prénom accentué",
    data: { prenom: "François", testMode: false },
  },
];

mkdirSync(OUT_DIR, { recursive: true });

const sections = variants
  .map(
    (v) => `
    <section style="margin:0 0 44px;">
      <p style="font:600 13px/1.4 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;margin:0 0 4px;">${v.nom}</p>
      <p style="font:400 13px/1.4 ui-monospace,Menlo,monospace;color:#64748b;margin:0 0 12px;">Objet : ${rappelPoubelleSubject(v.data)}</p>
      ${rappelPoubelleHtml(v.data)}
    </section>`
  )
  .join("\n");

const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8">
<title>Preview — rappel bac bleu (#40)</title>
<meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:28px 16px;background:#eef2f4;">
  <h1 style="font:600 20px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#0f172a;max-width:560px;margin:0 auto 24px;">
    Rappel « bac bleu » — preview
  </h1>
  <div style="max-width:560px;margin:0 auto;">${sections}</div>
</body></html>`;

const outFile = join(OUT_DIR, "rappel-poubelle.html");
writeFileSync(outFile, page, "utf-8");
console.log(`✅ ${variants.length} variantes écrites dans ${outFile}`);
