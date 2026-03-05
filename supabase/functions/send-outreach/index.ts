/**
 * Edge Function: send-outreach
 *
 * Processes an outreach CSV batch:
 *   1. For each row, resolve the lead (create if missing).
 *   2. Send the email via SendGrid.
 *   3. Append a message record whether the send succeeded or failed.
 *   4. Trigger on `messages` table maintains lead.total_contacts
 *      and lead.last_contacted_at automatically.
 *   5. Write an audit row to import_logs.
 *
 * ── Request ───────────────────────────────────────────────────
 * POST /functions/v1/send-outreach
 * Headers:
 *   x-app-password: <APP_PASSWORD>
 *   Content-Type:   application/json
 *
 * Body:
 * {
 *   filename:    string,
 *   senderEmail: string,
 *   senderName:  string,
 *   rows: Array<{
 *     union_name: string,
 *     local:      string,
 *     email:      string,
 *     subject:    string,
 *     body:       string,
 *     name?:      string,
 *   }>
 * }
 *
 * ── Response ──────────────────────────────────────────────────
 * {
 *   sent:          number,
 *   failed:        number,
 *   leadsCreated:  number,
 *   errors:        Array<{ row: object, reason: string }>
 * }
 */

import { serve }          from 'https://deno.land/std@0.177.0/http/server.ts'
import { preflight, json, error } from '../_shared/cors.ts'
import { isAuthorised }   from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/db.ts'
import { sendEmail }      from '../_shared/sendgrid.ts'

// ── Types ──────────────────────────────────────────────────────

interface OutreachRow {
  union_name: string
  local:      string
  email:      string
  subject:    string
  body:       string
  name?:      string | null
}

interface OutreachBody {
  filename:    string
  senderEmail: string
  senderName:  string
  rows:        OutreachRow[]
}

interface OutreachStats {
  sent:         number
  failed:       number
  leadsCreated: number
  errors:       { row: OutreachRow; reason: string }[]
}

// ── Validation ─────────────────────────────────────────────────

const REQUIRED = ['union_name', 'local', 'email', 'subject', 'body'] as const

function validateRow(
  row: unknown,
  index: number,
): { ok: true; row: OutreachRow } | { ok: false; reason: string } {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: `Row ${index + 1}: not an object` }
  }
  const r = row as Record<string, unknown>
  for (const field of REQUIRED) {
    if (!r[field] || typeof r[field] !== 'string' || !(r[field] as string).trim()) {
      return { ok: false, reason: `Row ${index + 1}: missing required field "${field}"` }
    }
  }
  return {
    ok:  true,
    row: {
      union_name: (r.union_name as string).trim(),
      local:      (r.local      as string).trim(),
      email:      (r.email      as string).trim().toLowerCase(),
      subject:    (r.subject    as string).trim(),
      body:       (r.body       as string).trim(),
      name:       typeof r.name === 'string' ? r.name.trim() || null : null,
    },
  }
}

// ── Lead resolution ────────────────────────────────────────────

/**
 * Return the lead id for a (union_name, local) pair.
 * Creates a minimal lead record if one does not exist yet.
 * Returns { leadId, created }.
 */
async function resolveOrCreateLead(
  db: ReturnType<typeof getAdminClient>,
  row: OutreachRow,
): Promise<{ leadId: string; created: boolean }> {
  const { data: existing, error: lookupErr } = await db
    .from('leads')
    .select('id')
    .eq('union_name', row.union_name)
    .eq('local',      row.local)
    .maybeSingle()

  if (lookupErr) throw new Error(lookupErr.message)

  if (existing) return { leadId: existing.id, created: false }

  const { data: newLead, error: insertErr } = await db
    .from('leads')
    .insert({
      union_name: row.union_name,
      local:      row.local,
      email:      row.email,
      name:       row.name ?? null,
    })
    .select('id')
    .single()

  if (insertErr || !newLead) throw new Error(insertErr?.message ?? 'Failed to create lead')
  return { leadId: newLead.id, created: true }
}

// ── Handler ────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')    return error('Method not allowed', 405)
  if (!isAuthorised(req))       return error('Unauthorised', 401)

  // ── Parse body ─────────────────────────────────────────────
  let body: OutreachBody
  try {
    body = await req.json()
  } catch {
    return error('Invalid JSON body')
  }

  const { filename, senderEmail, senderName, rows } = body

  if (!filename    || typeof filename    !== 'string') return error('"filename" is required')
  if (!senderEmail || typeof senderEmail !== 'string') return error('"senderEmail" is required')
  if (!senderName  || typeof senderName  !== 'string') return error('"senderName" is required')
  if (!Array.isArray(rows) || rows.length === 0)        return error('"rows" must be a non-empty array')

  const db    = getAdminClient()
  const stats: OutreachStats = { sent: 0, failed: 0, leadsCreated: 0, errors: [] }

  // ── Process rows ────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const validation = validateRow(rows[i], i)

    if (!validation.ok) {
      stats.failed++
      stats.errors.push({ row: rows[i] as OutreachRow, reason: validation.reason })
      continue
    }

    const row = validation.row
    let leadId: string | null = null

    try {
      // 1. Resolve lead
      const resolved = await resolveOrCreateLead(db, row)
      leadId = resolved.leadId
      if (resolved.created) stats.leadsCreated++

      // 2. Send via SendGrid
      const result = await sendEmail({
        to:      { email: row.email, name: row.name ?? undefined },
        from:    { email: senderEmail, name: senderName },
        subject: row.subject,
        text:    row.body,
      })

      // 3. Log message — sent OR failed
      const { error: logErr } = await db.from('messages').insert({
        lead_id:             leadId,
        subject:             row.subject,
        body:                row.body,
        sender_email:        senderEmail,
        sender_name:         senderName,
        sendgrid_message_id: result.messageId,
        status:              result.success ? 'sent' : 'failed',
        error_message:       result.error ?? null,
        sent_at:             result.success ? new Date().toISOString() : null,
      })

      if (logErr) console.error('Message log error:', logErr.message)

      if (result.success) {
        stats.sent++
      } else {
        stats.failed++
        stats.errors.push({ row, reason: result.error! })
      }
    } catch (err) {
      // Unexpected error — still attempt to log a failed message if we have a lead id
      if (leadId) {
        await db.from('messages').insert({
          lead_id:      leadId,
          subject:      row.subject,
          body:         row.body,
          sender_email: senderEmail,
          sender_name:  senderName,
          status:       'failed',
          error_message: (err as Error).message,
        }).catch(() => {/* best-effort */})
      }
      stats.failed++
      stats.errors.push({ row, reason: (err as Error).message })
    }
  }

  // ── Audit log ───────────────────────────────────────────────
  await db.from('import_logs').insert({
    import_type:   'outreach',
    filename,
    total_rows:    rows.length,
    created_count: stats.leadsCreated,
    updated_count: 0,
    skipped_count: 0,
    failed_count:  stats.failed,
    errors:        stats.errors.length ? stats.errors : null,
  })

  return json(stats)
})
