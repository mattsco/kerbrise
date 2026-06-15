import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"
import { digestHtml, digestSubject } from "../_shared/templates/digest.ts"
import type { DigestChange, DigestPending, DigestUpcoming } from "../_shared/templates/digest.ts"
import { everyone } from "../_shared/recipients.ts"
import { todayInParis } from "../_shared/dates.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')!

const ALL_FAMILIES = ["Antoine", "Vincent", "François"]

// deno-lint-ignore no-explicit-any
type AnyClient = any

// Familles qui n'ont pas encore voté pour une demande pending =
// {3 familles} − {famille auteur} − {familles ayant déjà voté}.
async function buildPending(supabase: AnyClient, rows: any[]): Promise<DigestPending[]> {
  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)
  const { data: votes } = await supabase
    .from('approvals')
    .select('booking_id, families(name)')
    .in('booking_id', ids)

  const votedByBooking = new Map<string, Set<string>>()
  for (const v of (votes ?? [])) {
    const set = votedByBooking.get(v.booking_id) ?? new Set<string>()
    // @ts-ignore
    if (v.families?.name) set.add(v.families.name)
    votedByBooking.set(v.booking_id, set)
  }

  return rows.map((r) => {
    // @ts-ignore
    const authorFamily: string = r.families?.name ?? '?'
    const voted = votedByBooking.get(r.id) ?? new Set<string>()
    const pendingFamilies = ALL_FAMILIES.filter((f) => f !== authorFamily && !voted.has(f))
    return {
      // @ts-ignore
      authorName: r.users?.display_name ?? '?',
      startDateIso: r.start_date,
      endDateIso: r.end_date,
      pendingFamilies,
    } as DigestPending
  })
}

function toChange(r: any): DigestChange {
  return {
    // @ts-ignore
    authorName: r.users?.display_name ?? '?',
    startDateIso: r.start_date,
    endDateIso: r.end_date,
    lastActionComment: r.last_action_comment ?? null,
    previousStartIso: r.previous_start_date ?? null,
    previousEndIso: r.previous_end_date ?? null,
  }
}

Deno.serve(async (_req) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Changements de la semaine
    const { data: changedBookings } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date, status,
        last_action_type, last_action_comment,
        previous_start_date, previous_end_date,
        families(name),
        users:created_by(display_name)
      `)
      .eq('changed_this_week', true)
      .order('start_date')

    const changes = (changedBookings ?? []) as any[]
    const newApprovals = changes.filter((b) => b.last_action_type === 'approved' && b.status === 'approved').map(toChange)
    const reductions = changes.filter((b) => b.last_action_type === 'reduced' && b.status === 'approved').map(toChange)
    const cancellations = changes.filter((b) => b.status === 'cancelled').map(toChange)

    // 2. Demandes en attente
    const { data: pendingRows } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date,
        families(name),
        users:created_by(display_name)
      `)
      .eq('status', 'pending')
      .order('start_date')

    const pending = await buildPending(supabase, (pendingRows ?? []) as any[])

    // Envoi si : changements OU demandes en attente
    const totalChanges = newApprovals.length + reductions.length + cancellations.length
    if (totalChanges === 0 && pending.length === 0) {
      return new Response(JSON.stringify({ message: 'Nothing to report, skipped' }), { status: 200 })
    }

    // 3. Prochains séjours : approuvés à venir, triés par date, max 3
    const today = todayInParis()
    const { data: upcomingRows } = await supabase
      .from('bookings')
      .select(`
        start_date, end_date,
        users:created_by(display_name)
      `)
      .eq('status', 'approved')
      .gte('start_date', today)
      .order('start_date')
      .limit(3)

    const upcoming: DigestUpcoming[] = (upcomingRows ?? []).map((r: any) => ({
      // @ts-ignore
      authorName: r.users?.display_name ?? '?',
      startDateIso: r.start_date,
      endDateIso: r.end_date,
    }))

    // 4. Destinataires : tout le monde (connectés)
    const recipients = await everyone(supabase, TEST_MODE, TEST_EMAIL)
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const data = { newApprovals, reductions, cancellations, pending, upcoming, testMode: TEST_MODE }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: recipients,
        subject: digestSubject(data),
        html: digestHtml(data),
      }),
    })

    const resendData = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendData }), { status: 500 })
    }

    // 5. Reset des flags
    await supabase
      .from('bookings')
      .update({ changed_this_week: false, previous_start_date: null, previous_end_date: null })
      .eq('changed_this_week', true)

    return new Response(
      JSON.stringify({ success: true, totalChanges, pending: pending.length, upcoming: upcoming.length, recipients: recipients.length, testMode: TEST_MODE }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
