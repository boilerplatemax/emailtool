import { serve }        from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── CORS ────────────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-app-password',
}
const preflight = () => new Response(null, { status: 204, headers: CORS })
const json  = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
const error = (msg: string, s = 400) => json({ error: msg }, s)

// ── Auth ────────────────────────────────────────────────────────
const isAuthorised = (req: Request) => {
  const pw = Deno.env.get('APP_PASSWORD')
  if (!pw) { console.error('APP_PASSWORD not set'); return false }
  return req.headers.get('x-app-password') === pw
}

// ── DB ──────────────────────────────────────────────────────────
const getDb = () => createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
)

// ── SendGrid ─────────────────────────────────────────────────────
const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send'

async function sendEmail(params: {
  to: { email: string; name?: string }
  from: { email: string; name?: string }
  subject: string; text: string
}) {
  const apiKey = Deno.env.get('SENDGRID_API_KEY')
  if (!apiKey) return { success: false, messageId: null, error: 'SENDGRID_API_KEY not set' }

  let res: Response
  try {
    res = await fetch(SENDGRID_API, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{
          to:  [{ email: params.to.email, ...(params.to.name ? { name: params.to.name } : {}) }],
          // BCC the sender so a copy lands in their mailbox (e.g. the "Sent" view).
          bcc: [{ email: params.from.email, ...(params.from.name ? { name: params.from.name } : {}) }],
        }],
        from: { email: params.from.email, ...(params.from.name ? { name: params.from.name } : {}) },
        subject: params.subject,
        content: [{ type: 'text/plain', value: params.text }],
      }),
    })
  } catch (e) {
    return { success: false, messageId: null, error: `Network error: ${(e as Error).message}` }
  }

  if (res.status === 202) return { success: true, messageId: res.headers.get('X-Message-Id') }

  let errDetail = `HTTP ${res.status}`
  try {
    const b = await res.json() as { errors?: { message: string }[] }
    if (b.errors?.length) errDetail = b.errors.map(e => e.message).join('; ')
  } catch { errDetail = `HTTP ${res.status}: ${await res.text()}` }

  return { success: false, messageId: null, error: errDetail }
}

// ── Handler ─────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')   return error('Method not allowed', 405)
  if (!isAuthorised(req))      return error('Unauthorised', 401)

  let body: { leadId: string; subject: string; body: string; senderEmail: string; senderName: string }
  try { body = await req.json() } catch { return error('Invalid JSON body') }

  const { leadId, subject, body: emailBody, senderEmail, senderName } = body
  if (!leadId      || typeof leadId      !== 'string') return error('"leadId" is required')
  if (!subject     || typeof subject     !== 'string') return error('"subject" is required')
  if (!emailBody   || typeof emailBody   !== 'string') return error('"body" is required')
  if (!senderEmail || typeof senderEmail !== 'string') return error('"senderEmail" is required')
  if (!senderName  || typeof senderName  !== 'string') return error('"senderName" is required')

  const db = getDb()

  const { data: lead, error: leadErr } = await db.from('leads').select('id, email, name').eq('id', leadId).single()
  if (leadErr || !lead) return error('Lead not found', 404)

  const result = await sendEmail({
    to:   { email: lead.email, name: lead.name ?? undefined },
    from: { email: senderEmail, name: senderName },
    subject, text: emailBody,
  })

  const { data: logged, error: logErr } = await db.from('messages').insert({
    lead_id: leadId, subject, body: emailBody,
    sender_email: senderEmail, sender_name: senderName,
    sendgrid_message_id: result.messageId,
    status:        result.success ? 'sent' : 'failed',
    error_message: result.error ?? null,
    sent_at:       result.success ? new Date().toISOString() : null,
  }).select('id').single()

  if (logErr) {
    console.error('Failed to log message:', logErr.message)
    return error(`Email ${result.success ? 'sent but' : 'failed and'} message log failed: ${logErr.message}`, 500)
  }

  if (!result.success) return json({ success: false, error: result.error, loggedId: logged.id })
  return json({ success: true, messageId: result.messageId, loggedId: logged.id })
})
