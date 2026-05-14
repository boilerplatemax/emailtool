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

// ── Types ───────────────────────────────────────────────────────
interface LeadRow {
  union_name: string; local: string
  email?: string|null
  phone?: string|null; address?: string|null; province?: string|null; name?: string|null
  website?: string|null
}
interface ImportBody {
  filename: string; duplicateBehavior?: 'ignore'|'replace'; rows: LeadRow[]
}

// ── Validation ──────────────────────────────────────────────────
function validateRow(row: unknown, i: number): { ok: true; row: LeadRow } | { ok: false; reason: string } {
  if (!row || typeof row !== 'object') return { ok: false, reason: `Row ${i+1}: not an object` }
  const r = row as Record<string,unknown>
  for (const f of ['union_name','local']) {
    if (!r[f] || typeof r[f] !== 'string' || !(r[f] as string).trim())
      return { ok: false, reason: `Row ${i+1}: missing required field "${f}"` }
  }
  const email   = typeof r.email   === 'string' ? r.email.trim().toLowerCase() : ''
  const phone   = typeof r.phone   === 'string' ? r.phone.trim()               : ''
  if (!email && !phone) {
    return { ok: false, reason: `Row ${i+1}: must have at least one of "email" or "phone"` }
  }
  return { ok: true, row: {
    union_name: (r.union_name as string).trim(),
    local:      (r.local      as string).trim(),
    email:      email   || null,
    phone:      phone   || null,
    address:    typeof r.address  === 'string' ? r.address.trim()  || null : null,
    province:   typeof r.province === 'string' ? r.province.trim() || null : null,
    name:       typeof r.name     === 'string' ? r.name.trim()     || null : null,
    website:    typeof r.website  === 'string' ? r.website.trim()  || null : null,
  }}
}

// ── Handler ─────────────────────────────────────────────────────
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return preflight()
  if (req.method !== 'POST')   return error('Method not allowed', 405)
  if (!isAuthorised(req))      return error('Unauthorised', 401)

  let body: ImportBody
  try { body = await req.json() } catch { return error('Invalid JSON body') }

  const { filename, rows, duplicateBehavior = 'ignore' } = body
  if (!filename || typeof filename !== 'string')        return error('"filename" is required')
  if (!Array.isArray(rows) || rows.length === 0)        return error('"rows" must be a non-empty array')
  if (!['ignore','replace'].includes(duplicateBehavior)) return error('"duplicateBehavior" must be "ignore" or "replace"')

  const db = getDb()
  const stats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as { row: LeadRow; reason: string }[] }

  for (let i = 0; i < rows.length; i++) {
    const v = validateRow(rows[i], i)
    if (!v.ok) { stats.failed++; stats.errors.push({ row: rows[i] as LeadRow, reason: v.reason }); continue }
    const row = v.row
    try {
      const { data: existing, error: lookupErr } = await db.from('leads').select('id').eq('union_name', row.union_name).eq('local', row.local).maybeSingle()
      if (lookupErr) throw new Error(lookupErr.message)
      if (existing) {
        if (duplicateBehavior === 'ignore') { stats.skipped++; continue }
        const { error: updateErr } = await db.from('leads').update({ email: row.email, phone: row.phone, address: row.address, province: row.province, name: row.name, website: row.website }).eq('id', existing.id)
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

  await db.from('import_logs').insert({
    import_type: 'leads', filename, total_rows: rows.length,
    created_count: stats.created, updated_count: stats.updated,
    skipped_count: stats.skipped, failed_count: stats.failed,
    errors: stats.errors.length ? stats.errors : null,
  })

  return json(stats)
})
