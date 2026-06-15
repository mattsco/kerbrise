import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"
import { newBookingHtml, newBookingSubject } from "../_shared/templates/new-booking.ts"
import { heads } from "../_shared/recipients.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')!

Deno.serve(async (req) => {
  try {
    const { record, old_record } = await req.json()
    const bookingId = record.id
    const isModification = old_record !== null && old_record !== undefined

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date, note, family_id, last_action_comment,
        families(name, color),
        users:created_by(display_name, email)
      `)
      .eq('id', bookingId)
      .single()

    if (bookingError || !booking) {
      console.error('Booking not found:', bookingError)
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 })
    }

    // @ts-ignore
    const requesterFamilyName: string = booking.families?.name ?? '?'
    // @ts-ignore
    const requesterName: string = booking.users?.display_name ?? '?'

    const recipients = await heads(supabase, TEST_MODE, TEST_EMAIL)
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const data = {
      isModification,
      requesterFamilyName,
      requesterName,
      startDateIso: booking.start_date as string,
      endDateIso: booking.end_date as string,
      note: booking.note as string | null,
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
        subject: newBookingSubject(data),
        html: newBookingHtml(data),
      }),
    })

    const resendData = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendData }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, isModification, recipients, testMode: TEST_MODE }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
