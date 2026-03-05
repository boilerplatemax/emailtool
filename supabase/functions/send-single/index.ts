/**
 * Edge Function: send-single
 *
 * Sends a one-off email to an existing lead and logs the message.
 * Used from the lead detail view in the UI.
 *
 * ── Request ───────────────────────────────────────────────────
 * POST /functions/v1/send-single
 * Headers:
 *   x-app-password: <APP_PASSWORD>
 *   Content-Type:   application/json
 *
 * Body:
 * {
 *   leadId:      string,   // UUID of the lead
 *   subject:     string,
 *   body:        string,   // plain text
 *   senderEmail: string,
 *   senderName:  string,
 * }
 *
 * ── Response (success) ────────────────────────────────────────
 * {
 *   messageId:  string | null,   // SendGrid X-Message-Id
 *   loggedId:   string,           // messages.id in DB
 * }
 *
 * ── Response (failure) ────────────────────────────────────────
 * HTTP 4xx/5xx  { error: string }
 * OR HTTP 200   with status "failed" in DB log when SendGrid rejects
 */

import { serve }          from 'https://deno.land/std@0.177.0/http/server.ts'
import { preflight, json, error } from '../_shared/cors.ts'
import { isAuthorised }   from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/db.ts'
import { sendEmail }      from '../_shared/sendgrid.ts'

// ── Types ──────────────────────────────────────────────────────

interface SendSingleBody {
  leadId:      string
  subject:     string
  body:        string
  senderEmail: string
  senderName:  string
}

// ── Handler ────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')    return error('Method not allowed', 405)
  if (!isAuthorised(req))       return error('Unauthorised', 401)

  // ── Parse & validate body ───────────────────────────────────
  let body: SendSingleBody
  try {
    body = await req.json()
  } catch {
    return error('Invalid JSON body')
  }

  const { leadId, subject, body: emailBody, senderEmail, senderName } = body

  if (!leadId      || typeof leadId      !== 'string') return error('"leadId" is required')
  if (!subject     || typeof subject     !== 'string') return error('"subject" is required')
  if (!emailBody   || typeof emailBody   !== 'string') return error('"body" is required')
  if (!senderEmail || typeof senderEmail !== 'string') return error('"senderEmail" is required')
  if (!senderName  || typeof senderName  !== 'string') return error('"senderName" is required')

  const db = getAdminClient()

  // ── Fetch lead ──────────────────────────────────────────────
  const { data: lead, error: leadErr } = await db
    .from('leads')
    .select('id, email, name')
    .eq('id', leadId)
    .single()

  if (leadErr || !lead) return error('Lead not found', 404)

  // ── Send via SendGrid ───────────────────────────────────────
  const result = await sendEmail({
    to:      { email: lead.email, name: lead.name ?? undefined },
    from:    { email: senderEmail, name: senderName },
    subject,
    text:    emailBody,
  })

  // ── Log message regardless of outcome ──────────────────────
  const { data: logged, error: logErr } = await db
    .from('messages')
    .insert({
      lead_id:             leadId,
      subject,
      body:                emailBody,
      sender_email:        senderEmail,
      sender_name:         senderName,
      sendgrid_message_id: result.messageId,
      status:              result.success ? 'sent' : 'failed',
      error_message:       result.error ?? null,
      sent_at:             result.success ? new Date().toISOString() : null,
    })
    .select('id')
    .single()

  if (logErr) {
    // The email may have sent — surface this rather than silently failing
    console.error('Failed to log message:', logErr.message)
    return error(`Email ${result.success ? 'sent but' : 'failed and'} message log failed: ${logErr.message}`, 500)
  }

  // ── Return ──────────────────────────────────────────────────
  if (!result.success) {
    // Return 200 with error detail so the caller can show the user
    // what went wrong without treating it as a transport failure
    return json({ success: false, error: result.error, loggedId: logged.id })
  }

  return json({ success: true, messageId: result.messageId, loggedId: logged.id })
})
