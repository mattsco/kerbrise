import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"
import { reducedHtml, reducedSubject } from "../_shared/templates/reduced.ts"
import { heads } from "../_shared/recipients.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')!

Deno.serve(async (req) => {
  try {
    const { record, old_record } = await req.json()
    if (!old_record) {
      return new Response(JSON.stringify({ message: 'No old_record' }), { status: 200 })
    }

    const oldStart = old_record.start_date as string
    const oldEnd = old_record.end_date as string
    const newStart = record.start_date as string
    const newEnd = record.end_date as string

    // Ceinture de sécurité : réduction effective (le trigger filtre déjà)
    const isIncluded = newStart >= oldStart && newEnd <= oldEnd
    const shrank = newStart > oldStart || newEnd < oldEnd
    if (!isIncluded || !shrank) {
      return new Response(JSON.stringify({ message: 'Not a reduction' }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date, last_action_comment,
        families(name, color),
        users:created_by(display_name)
      `)
      .eq('id', record.id)
      .single()

    if (!booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 })
    }

    // @ts-ignore
    const familyName: string = booking.families?.name ?? '?'
    // @ts-ignore
    const authorName: string = booking.users?.display_name ?? '?'

    const recipients = await heads(supabase, TEST_MODE, TEST_EMAIL)
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const data = {
      familyName,
      authorName,
      oldStartIso: oldStart,
      oldEndIso: oldEnd,
      newStartIso: newStart,
      newEndIso: newEnd,
      lastActionComment: booking.last_action_comment as string | null,
      testMode: TEST_MODE,
    }

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: EMAIL_FROM,
        to: recipients,
        subject: reducedSubject(data),
        html: reducedHtml(data),
      }),
    })

    const resendData = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendData }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, recipients, testMode: TEST_MODE }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
