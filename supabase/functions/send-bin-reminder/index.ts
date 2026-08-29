import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"
import { rappelPoubelleHtml, rappelPoubelleSubject } from "../_shared/templates/rappel-poubelle.ts"
import { houseAlertRecipients } from "../_shared/recipients.ts"
import { recyclablesCollectionTomorrow } from "../_shared/garbage-collection.ts"
import { occupantOn, parisHour, SEND_HOUR_PARIS, type StayRow } from "../_shared/house-presence.ts"
import { todayInParis } from "../_shared/dates.ts"

/**
 * send-bin-reminder — rappel « poubelle bleue » à l'occupant (#40).
 *
 * Appelée par pg_cron TOUS LES MARDIS à 16h ET 17h UTC (migration 0015). Les
 * deux passages sont voulus : le garde `parisHour` n'en laisse passer qu'un,
 * celui qui vaut 18h à Paris — 16h UTC l'été, 17h l'hiver. C'est ce qui donne
 * « 18h » toute l'année sans dépendre du changement d'heure.
 *
 * CHAÎNE DE GARDES qui répondent 200. Aucun n'est une erreur :
 *   - mauvaise heure           → l'autre passage du cron s'en chargera
 *   - pas de collecte demain   → une semaine sur deux, par construction
 *   - personne à Kerbrise      → la majorité de l'année
 *
 * `?force=1` contourne LE SEUL garde horaire, pour tester hors de 18h. Jamais
 * la collecte ni la présence : sinon le test ne prouverait rien.
 */

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')!

const skip = (raison: string, extra: Record<string, unknown> = {}) =>
  new Response(JSON.stringify({ sent: 0, skipped: raison, ...extra }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  try {
    const force = new URL(req.url).searchParams.get('force') === '1'

    const heure = parisHour(new Date())
    if (!force && heure !== SEND_HOUR_PARIS) {
      return skip("hors fenêtre d'envoi", { heureParis: heure })
    }

    const today = todayInParis()

    // ── Garde 1 : y a-t-il collecte demain matin ? ──────────────────────
    const collecte = recyclablesCollectionTomorrow(today)
    if (!collecte) {
      return skip('pas de collecte recyclables demain', { today })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // ── Garde 2 : qui dort à Kerbrise ce soir ? ─────────────────────────
    const { data: stays, error: staysError } = await supabase
      .from('bookings')
      .select('start_date, end_date, family_id')
      .eq('status', 'approved')
      .lte('start_date', today)
      .gt('end_date', today)

    if (staysError) {
      console.error('[bin-reminder] lecture séjours:', staysError)
      return new Response(JSON.stringify({ error: 'db_error' }), { status: 500 })
    }

    const occupant = occupantOn((stays ?? []) as StayRow[], today)
    if (!occupant) {
      return skip('personne à Kerbrise ce soir', { today })
    }

    // ── Destinataires : le référent de la famille présente ──────────────
    const cibles = await houseAlertRecipients(supabase, occupant.family_id)
    if (cibles.length === 0) {
      console.error(`[bin-reminder] aucun destinataire pour la famille ${occupant.family_id}`)
      return skip('aucun destinataire', { familyId: occupant.family_id })
    }

    // ── Envoi ───────────────────────────────────────────────────────────
    // Un e-mail PAR destinataire : le corps est nominatif, un envoi groupé
    // mettrait le prénom de l'un dans la boîte de l'autre.
    const resultats = await Promise.all(
      cibles.map(async (u) => {
        const data = { prenom: u.display_name ?? 'toi', testMode: TEST_MODE }
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: EMAIL_FROM,
            to: [TEST_MODE ? TEST_EMAIL : u.email],
            subject: rappelPoubelleSubject(data),
            html: rappelPoubelleHtml(data),
          }),
        })
        return { ok: r.ok, name: u.display_name, detail: await r.json() }
      })
    )

    const echecs = resultats.filter((r) => !r.ok)
    if (echecs.length > 0) {
      console.error('[bin-reminder] Resend:', echecs.map((e) => e.detail))
    }

    return new Response(
      JSON.stringify({
        sent: resultats.length - echecs.length,
        failed: echecs.length,
        veille: today,
        familyId: occupant.family_id,
        recipients: resultats.filter((r) => r.ok).map((r) => r.name),
        testMode: TEST_MODE,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[bin-reminder] erreur:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
