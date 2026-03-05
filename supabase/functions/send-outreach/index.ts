/**
 * Edge Function: send-outreach
 *
 * For each row in an outreach CSV:
 *   1. Look up lead by (union_name + local)
 *   2. Create lead if it does not exist
 *   3. Send email via SendGrid
 *   4. Log the message (status = sent | failed)
 *   5. Write import audit log
 *
 * POST /functions/v1/send-outreach
 * Body: {
 *   rows: OutreachRow[],
 *   filename: string,
 *   senderEmail: string,
 *   senderName: string
 * }
 *
 * Response: {
 *   sent:    number,
 *   failed:  number,
 *   created: number,   <- new leads auto-created
 *   errors:  { row: object, reason: string }[]
 * }
 */

import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2'
import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY')!

async function sendEmail(to: string, subject: string, body: string, senderEmail: string, senderName: string) {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from:             { email: senderEmail, name: senderName },
      subject,
      content:          [{ type: 'text/plain', value: body }],
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`SendGrid ${res.status}: ${text}`)
  }

  // SendGrid returns the message id in the X-Message-Id header
  return res.headers.get('X-Message-Id') ?? null
}

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { rows, filename, senderEmail, senderName } = await req.json()

  const stats = { sent: 0, failed: 0, created: 0, errors: [] as object[] }

  for (const row of rows) {
    let leadId: string | null = null

    try {
      // ── 1. Resolve lead ─────────────────────────────────────
      const { data: existing } = await supabase
        .from('leads')
        .select('id')
        .eq('union_name', row.union_name)
        .eq('local', row.local)
        .maybeSingle()

      if (existing) {
        leadId = existing.id
      } else {
        // auto-create minimal lead record
        const { data: created, error: createErr } = await supabase
          .from('leads')
          .insert({ union_name: row.union_name, local: row.local, email: row.email, name: row.name })
          .select('id')
          .single()
        if (createErr) throw createErr
        leadId = created.id
        stats.created++
      }

      // ── 2. Send email ────────────────────────────────────────
      const msgId = await sendEmail(row.email, row.subject, row.body, senderEmail, senderName)

      // ── 3. Log message ───────────────────────────────────────
      await supabase.from('messages').insert({
        lead_id:             leadId,
        subject:             row.subject,
        body:                row.body,
        sender_email:        senderEmail,
        sender_name:         senderName,
        sendgrid_message_id: msgId,
        status:              'sent',
        sent_at:             new Date().toISOString(),
      })

      stats.sent++
    } catch (err) {
      // log a failed message row so history is still recorded
      if (leadId) {
        await supabase.from('messages').insert({
          lead_id:      leadId,
          subject:      row.subject,
          body:         row.body,
          sender_email: senderEmail,
          sender_name:  senderName,
          status:       'failed',
          error_message: (err as Error).message,
        })
      }
      stats.failed++
      stats.errors.push({ row, reason: (err as Error).message })
    }
  }

  // ── Audit log ────────────────────────────────────────────────
  await supabase.from('import_logs').insert({
    import_type:   'outreach',
    filename,
    total_rows:    rows.length,
    created_count: stats.created,
    updated_count: 0,
    skipped_count: 0,
    failed_count:  stats.failed,
    errors:        stats.errors.length ? stats.errors : null,
  })

  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  })
})
