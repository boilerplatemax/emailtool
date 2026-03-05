/**
 * Edge Function: import-leads
 *
 * Accepts a parsed batch of lead rows from the frontend, upserts
 * them into the `leads` table, and writes an audit row to
 * `import_logs`.
 *
 * ── Request ───────────────────────────────────────────────────
 * POST /functions/v1/import-leads
 * Headers:
 *   x-app-password: <APP_PASSWORD>
 *   Content-Type:   application/json
 *
 * Body:
 * {
 *   filename:          string,
 *   duplicateBehavior: "ignore" | "replace",   // default: "ignore"
 *   rows: Array<{
 *     union_name: string,
 *     local:      string,
 *     email:      string,
 *     phone?:     string,
 *     address?:   string,
 *     province?:  string,
 *     name?:      string,
 *   }>
 * }
 *
 * ── Response ──────────────────────────────────────────────────
 * {
 *   created: number,
 *   updated: number,
 *   skipped: number,
 *   failed:  number,
 *   errors:  Array<{ row: object, reason: string }>
 * }
 */

import { serve }          from 'https://deno.land/std@0.177.0/http/server.ts'
import { preflight, json, error } from '../_shared/cors.ts'
import { isAuthorised }   from '../_shared/auth.ts'
import { getAdminClient } from '../_shared/db.ts'

// ── Types ──────────────────────────────────────────────────────

interface LeadRow {
  union_name: string
  local:      string
  email:      string
  phone?:     string | null
  address?:   string | null
  province?:  string | null
  name?:      string | null
}

interface ImportBody {
  filename:          string
  duplicateBehavior?: 'ignore' | 'replace'
  rows:              LeadRow[]
}

interface ImportStats {
  created: number
  updated: number
  skipped: number
  failed:  number
  errors:  { row: LeadRow; reason: string }[]
}

// ── Validation ─────────────────────────────────────────────────

function validateRow(row: unknown, index: number): { ok: true; row: LeadRow } | { ok: false; reason: string } {
  if (!row || typeof row !== 'object') {
    return { ok: false, reason: `Row ${index + 1}: not an object` }
  }
  const r = row as Record<string, unknown>
  for (const field of ['union_name', 'local', 'email']) {
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
      phone:      typeof r.phone    === 'string' ? r.phone.trim()    || null : null,
      address:    typeof r.address  === 'string' ? r.address.trim()  || null : null,
      province:   typeof r.province === 'string' ? r.province.trim() || null : null,
      name:       typeof r.name     === 'string' ? r.name.trim()     || null : null,
    },
  }
}

// ── Handler ────────────────────────────────────────────────────

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')    return error('Method not allowed', 405)
  if (!isAuthorised(req))       return error('Unauthorised', 401)

  // ── Parse body ─────────────────────────────────────────────
  let body: ImportBody
  try {
    body = await req.json()
  } catch {
    return error('Invalid JSON body')
  }

  const { filename, rows, duplicateBehavior = 'ignore' } = body

  if (!filename || typeof filename !== 'string') return error('"filename" is required')
  if (!Array.isArray(rows) || rows.length === 0)  return error('"rows" must be a non-empty array')
  if (!['ignore', 'replace'].includes(duplicateBehavior)) {
    return error('"duplicateBehavior" must be "ignore" or "replace"')
  }

  const db    = getAdminClient()
  const stats: ImportStats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] }

  // ── Process rows ────────────────────────────────────────────
  for (let i = 0; i < rows.length; i++) {
    const validation = validateRow(rows[i], i)

    if (!validation.ok) {
      stats.failed++
      stats.errors.push({ row: rows[i] as LeadRow, reason: validation.reason })
      continue
    }

    const row = validation.row

    try {
      // Look up existing lead by natural key
      const { data: existing, error: lookupErr } = await db
        .from('leads')
        .select('id')
        .eq('union_name', row.union_name)
        .eq('local',      row.local)
        .maybeSingle()

      if (lookupErr) throw new Error(lookupErr.message)

      if (existing) {
        if (duplicateBehavior === 'ignore') {
          stats.skipped++
          continue
        }

        // replace — update all non-tracking fields
        const { error: updateErr } = await db
          .from('leads')
          .update({
            email:    row.email,
            phone:    row.phone,
            address:  row.address,
            province: row.province,
            name:     row.name,
          })
          .eq('id', existing.id)

        if (updateErr) throw new Error(updateErr.message)
        stats.updated++
      } else {
        const { error: insertErr } = await db.from('leads').insert(row)
        if (insertErr) throw new Error(insertErr.message)
        stats.created++
      }
    } catch (err) {
      stats.failed++
      stats.errors.push({ row, reason: (err as Error).message })
    }
  }

  // ── Audit log ───────────────────────────────────────────────
  await db.from('import_logs').insert({
    import_type:   'leads',
    filename,
    total_rows:    rows.length,
    created_count: stats.created,
    updated_count: stats.updated,
    skipped_count: stats.skipped,
    failed_count:  stats.failed,
    errors:        stats.errors.length ? stats.errors : null,
  })

  return json(stats)
})
