import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { todayInParis, dateToISO } from "@/lib/dates";
import {
  occupantOn,
  parisHour,
  recyclablesCollectionTomorrow,
  SEND_HOUR_PARIS,
  type StayRow,
} from "@/lib/house-alerts";
import {
  rappelPoubelleHtml,
  rappelPoubelleSubject,
} from "@/lib/emails/rappel-poubelle";

/**
 * POST /api/cron/rappel-poubelle — rappel « bac bleu » à l'occupant (#40).
 *
 * 🔒 PROTÉGÉ par token : `Authorization: Bearer <CRON_SECRET>`. Même patron que
 * /api/term. Une route cron est publique par construction ; #35 a fermé une
 * surface publique inutile, on n'en rouvre pas une sans serrure.
 *
 * Appelée par pg_cron TOUS LES MARDIS à 16h ET 17h UTC (migration 0015). Les
 * deux passages sont voulus : le garde `parisHour` n'en laisse passer qu'un,
 * celui qui vaut 18h à Paris — 16h UTC l'été, 17h l'hiver. C'est ce qui donne
 * « 18h » toute l'année sans dépendre du changement d'heure.
 *
 * La route est une CHAÎNE DE GARDES qui répondent 200 {skipped}. Aucun n'est
 * une erreur :
 *   - mauvaise heure           → l'autre passage du cron s'en chargera
 *   - pas de collecte demain   → une semaine sur deux, par construction
 *   - personne à Kerbrise      → la majorité de l'année
 *
 * Pourquoi ici et pas dans une Edge Function comme les 5 autres e-mails :
 * le calendrier des collectes vit dans `lib/garbage-collection.ts` et EXPIRE
 * le 31/01/2027. Le dupliquer en Deno aurait créé une seconde échéance
 * silencieuse, invisible du check santé #33. Cf. spec §D1.
 */

export const dynamic = "force-dynamic";

function tokenValid(authHeader: string | null): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader ?? "");
  if (!m) return false;
  const a = Buffer.from(m[1]);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

const skip = (raison: string, extra: Record<string, unknown> = {}) =>
  NextResponse.json({ sent: false, skipped: raison, ...extra });

export async function POST(req: Request) {
  if (!tokenValid(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // `force` : déclenchement manuel de test, en dehors de la fenêtre de 18h.
  // Ne contourne QUE le garde horaire — jamais la collecte ni la présence,
  // sinon le test ne prouverait rien.
  const force = new URL(req.url).searchParams.get("force") === "1";

  const heure = parisHour(new Date());
  if (!force && heure !== SEND_HOUR_PARIS) {
    return skip("hors fenêtre d'envoi", { heureParis: heure });
  }

  const today = todayInParis();

  // ── Garde 1 : y a-t-il collecte demain matin ? ────────────────────────
  const collecte = recyclablesCollectionTomorrow(today);
  if (!collecte) {
    return skip("pas de collecte recyclables demain", { today });
  }
  const collecteISO = dateToISO(collecte.date);

  const supabase = createServiceClient();

  // ── Garde 2 : qui dort à Kerbrise ce soir ? ───────────────────────────
  // Fenêtre minimale : un séjour ne peut couvrir aujourd'hui que s'il a
  // commencé au plus tard aujourd'hui et se termine après.
  const { data: stays, error: staysError } = await supabase
    .from("bookings")
    .select("start_date, end_date, family_id")
    .eq("status", "approved")
    .lte("start_date", today)
    .gt("end_date", today);

  if (staysError) {
    console.error("[rappel-poubelle] lecture séjours:", staysError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  const occupant = occupantOn((stays ?? []) as StayRow[], today);
  if (!occupant) {
    return skip("personne à Kerbrise ce soir", { today, collecte: collecteISO });
  }

  // ── Destinataires : le référent de la famille présente ────────────────
  const { data: familyUsers, error: usersError } = await supabase
    .from("users")
    .select("email, display_name, receives_house_alerts, is_family_head")
    .eq("family_id", occupant.family_id);

  if (usersError) {
    console.error("[rappel-poubelle] lecture users:", usersError);
    return NextResponse.json({ error: "db_error" }, { status: 500 });
  }

  // Repli sur les chefs de famille si personne n'est coché : un rappel qui
  // n'arrive pas est pire qu'un rappel qui arrive à deux personnes.
  const flagged = (familyUsers ?? []).filter((u) => u.receives_house_alerts);
  const cibles = flagged.length > 0
    ? flagged
    : (familyUsers ?? []).filter((u) => u.is_family_head);

  if (cibles.length === 0) {
    console.error(
      `[rappel-poubelle] aucun destinataire pour la famille ${occupant.family_id}`
    );
    return skip("aucun destinataire", { familyId: occupant.family_id });
  }

  // ── Envoi ─────────────────────────────────────────────────────────────
  const testMode = process.env.EMAIL_TEST_MODE === "true";
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    console.error("[rappel-poubelle] RESEND_API_KEY / EMAIL_FROM manquants");
    return NextResponse.json({ error: "email_config" }, { status: 500 });
  }

  // Un e-mail PAR destinataire : le corps est nominatif (« Bonjour Vincent »),
  // un envoi groupé mettrait le prénom de l'un dans la boîte de l'autre.
  const envois = cibles.map((u) => {
    const prenom = u.display_name ?? "toi";
    const data = { prenom, testMode };
    return fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [testMode ? process.env.TEST_EMAIL : u.email],
        subject: rappelPoubelleSubject(data),
        html: rappelPoubelleHtml(data),
      }),
    }).then(async (r) => ({ ok: r.ok, detail: await r.json() }));
  });

  const resultats = await Promise.all(envois);
  const echecs = resultats.filter((r) => !r.ok);
  if (echecs.length > 0) {
    console.error("[rappel-poubelle] Resend:", echecs.map((e) => e.detail));
  }

  return NextResponse.json({
    sent: resultats.length - echecs.length,
    failed: echecs.length,
    collecte: collecteISO,
    veille: today,
    familyId: occupant.family_id,
    recipients: cibles.map((u) => u.display_name),
    testMode,
  });
}
