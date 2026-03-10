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
        personalizations: [{ to: [{ email: params.to.email, ...(params.to.name ? { name: params.to.name } : {}) }] }],
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

// ── Types ───────────────────────────────────────────────────────
interface OutreachRow {
  union_name: string; local: string; email: string
  province: string; employer_sector: string
  subject: string; body: string; name?: string|null
}
interface OutreachBody {
  filename: string; senderEmail: string; senderName: string; rows: OutreachRow[]
}

// ── Validation ──────────────────────────────────────────────────
function validateRow(row: unknown, i: number): { ok: true; row: OutreachRow } | { ok: false; reason: string } {
  if (!row || typeof row !== 'object') return { ok: false, reason: `Row ${i+1}: not an object` }
  const r = row as Record<string,unknown>
  for (const f of ['union_name','local','email','province','employer_sector','subject','body']) {
    if (!r[f] || typeof r[f] !== 'string' || !(r[f] as string).trim())
      return { ok: false, reason: `Row ${i+1}: missing required field "${f}"` }
  }
  return { ok: true, row: {
    union_name:      (r.union_name      as string).trim(),
    local:           (r.local           as string).trim(),
    email:           (r.email           as string).trim().toLowerCase(),
    province:        (r.province        as string).trim(),
    employer_sector: (r.employer_sector as string).trim(),
    subject:         (r.subject         as string).trim(),
    body:            (r.body            as string).trim(),
    name:            typeof r.name === 'string' ? r.name.trim() || null : null,
  }}
}

// ── Lead resolution ─────────────────────────────────────────────
async function resolveOrCreateLead(db: ReturnType<typeof getDb>, row: OutreachRow) {
  const { data: existing, error: e } = await db.from('leads').select('id').eq('union_name', row.union_name).eq('local', row.local).maybeSingle()
  if (e) throw new Error(e.message)
  if (existing) return { leadId: existing.id, created: false }
  const { data: newLead, error: ie } = await db.from('leads').insert({ union_name: row.union_name, local: row.local, email: row.email, name: row.name ?? null }).select('id').single()
  if (ie || !newLead) throw new Error(ie?.message ?? 'Failed to create lead')
  return { leadId: newLead.id, created: true }
}

// ── Handler ─────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')   return error('Method not allowed', 405)
  if (!isAuthorised(req))      return error('Unauthorised', 401)

  let body: OutreachBody
  try { body = await req.json() } catch { return error('Invalid JSON body') }

  const { filename, senderEmail, senderName, rows } = body
  if (!filename    || typeof filename    !== 'string') return error('"filename" is required')
  if (!senderEmail || typeof senderEmail !== 'string') return error('"senderEmail" is required')
  if (!senderName  || typeof senderName  !== 'string') return error('"senderName" is required')
  if (!Array.isArray(rows) || rows.length === 0)        return error('"rows" must be a non-empty array')

  const db = getDb()
  const stats = { sent: 0, failed: 0, leadsCreated: 0, errors: [] as { row: OutreachRow; reason: string }[] }

  for (let i = 0; i < rows.length; i++) {
    const v = validateRow(rows[i], i)
    if (!v.ok) { stats.failed++; stats.errors.push({ row: rows[i] as OutreachRow, reason: v.reason }); continue }
    const row = v.row
    let leadId: string|null = null
    try {
      const resolved = await resolveOrCreateLead(db, row)
      leadId = resolved.leadId
      if (resolved.created) stats.leadsCreated++

      const result = await sendEmail({ to: { email: row.email, name: row.name ?? undefined }, from: { email: senderEmail, name: senderName }, subject: row.subject, text: row.body })

      await db.from('messages').insert({
        lead_id: leadId, subject: row.subject, body: row.body,
        sender_email: senderEmail, sender_name: senderName,
        sendgrid_message_id: result.messageId,
        status: result.success ? 'sent' : 'failed',
        error_message: result.error ?? null,
        sent_at: result.success ? new Date().toISOString() : null,
      })

      if (result.success) { stats.sent++ }
      else { stats.failed++; stats.errors.push({ row, reason: result.error! }) }
    } catch (err) {
      if (leadId) {
        await db.from('messages').insert({ lead_id: leadId, subject: row.subject, body: row.body, sender_email: senderEmail, sender_name: senderName, status: 'failed', error_message: (err as Error).message }).catch(() => {})
      }
      stats.failed++
      stats.errors.push({ row, reason: (err as Error).message })
    }
  }

  await db.from('import_logs').insert({
    import_type: 'outreach', filename, total_rows: rows.length,
    created_count: stats.leadsCreated, updated_count: 0, skipped_count: 0,
    failed_count: stats.failed, errors: stats.errors.length ? stats.errors : null,
  })

  return json(stats)
})
