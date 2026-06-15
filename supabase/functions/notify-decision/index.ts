import { createClient } from "https://esm.sh/@supabase/supabase-js@2.46.1"
import { decisionHtml, decisionSubject } from "../_shared/templates/decision.ts"
import { authorAndHead } from "../_shared/recipients.ts"

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const EMAIL_FROM = Deno.env.get('EMAIL_FROM')!
const TEST_MODE = Deno.env.get('EMAIL_TEST_MODE') === 'true'
const TEST_EMAIL = Deno.env.get('TEST_EMAIL')!

Deno.serve(async (req) => {
  try {
    const { record, old_record } = await req.json()
    const newStatus = record.status
    const oldStatus = old_record?.status

    if (newStatus === oldStatus) {
      return new Response(JSON.stringify({ message: 'No status change' }), { status: 200 })
    }
    if (newStatus !== 'approved' && newStatus !== 'rejected') {
      return new Response(JSON.stringify({ message: 'Not a final status' }), { status: 200 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const { data: booking } = await supabase
      .from('bookings')
      .select(`
        id, start_date, end_date, note, family_id, created_by,
        families(name, color),
        users:created_by(email, display_name)
      `)
      .eq('id', record.id)
      .single()

    if (!booking) {
      return new Response(JSON.stringify({ error: 'Booking not found' }), { status: 404 })
    }
    // @ts-ignore
    const authorEmail: string = booking.users?.email
    // @ts-ignore
    const familyName: string = booking.families?.name ?? '?'

    const isApproved = newStatus === 'approved'

    // Pour un refus : récupère le dernier refus (famille + commentaire)
    let rejectedByFamily: string | undefined
    let rejectionComment: string | undefined
    if (!isApproved) {
      const { data: lastRejection } = await supabase
        .from('approvals')
        .select(`comment, families(name, color), users:decided_by(display_name)`)
        .eq('booking_id', record.id)
        .eq('decision', 'rejected')
        .order('decided_at', { ascending: false })
        .limit(1)
        .single()
      // @ts-ignore
      rejectedByFamily = lastRejection?.families?.name ?? '?'
      rejectionComment = lastRejection?.comment ?? ''
    }

    const recipients = await authorAndHead(
      supabase,
      { authorEmail, familyId: booking.family_id as string },
      TEST_MODE,
      TEST_EMAIL,
    )
    if (recipients.length === 0) {
      return new Response(JSON.stringify({ message: 'No recipients' }), { status: 200 })
    }

    const data = {
      isApproved,
      familyName,
      startDateIso: booking.start_date as string,
      endDateIso: booking.end_date as string,
      note: booking.note as string | null,
      rejectedByFamily,
      rejectionComment,
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
        subject: decisionSubject(data),
        html: decisionHtml(data),
      }),
    })

    const resendData = await resendResponse.json()
    if (!resendResponse.ok) {
      console.error('Resend error:', resendData)
      return new Response(JSON.stringify({ error: 'Email send failed', details: resendData }), { status: 500 })
    }

    return new Response(
      JSON.stringify({ success: true, status: newStatus, recipients, testMode: TEST_MODE }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Function error:', error)
    return new Response(JSON.stringify({ error: String(error) }), { status: 500 })
  }
})
