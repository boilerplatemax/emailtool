/**
 * Edge Function: import-leads
 *
 * Receives validated lead rows from the frontend and upserts
 * them into the leads table using the service-role key (never
 * exposed to the browser).
 *
 * POST /functions/v1/import-leads
 * Body: {
 *   rows: LeadRow[],
 *   duplicateBehavior: 'ignore' | 'replace',
 *   filename: string
 * }
 *
 * Response: {
 *   created: number,
 *   updated: number,
 *   skipped: number,
 *   failed:  number,
 *   errors:  { row: object, reason: string }[]
 * }
 */

import { createClient }  from 'https://esm.sh/@supabase/supabase-js@2'
import { serve }         from 'https://deno.land/std@0.177.0/http/server.ts'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { rows, duplicateBehavior = 'ignore', filename } = await req.json()

  const stats = { created: 0, updated: 0, skipped: 0, failed: 0, errors: [] as object[] }

  for (const row of rows) {
    try {
      const existing = await supabase
        .from('leads')
        .select('id')
        .eq('union_name', row.union_name)
        .eq('local', row.local)
        .maybeSingle()

      if (existing.data) {
        if (duplicateBehavior === 'ignore') {
          stats.skipped++
          continue
        }
        // replace: update all fields except id / timestamps / tracking
        await supabase
          .from('leads')
          .update({ email: row.email, phone: row.phone, address: row.address, province: row.province, name: row.name })
          .eq('id', existing.data.id)
        stats.updated++
      } else {
        await supabase.from('leads').insert(row)
        stats.created++
      }
    } catch (err) {
      stats.failed++
      stats.errors.push({ row, reason: (err as Error).message })
    }
  }

  // write audit log
  await supabase.from('import_logs').insert({
    import_type:   'leads',
    filename,
    total_rows:    rows.length,
    created_count: stats.created,
    updated_count: stats.updated,
    skipped_count: stats.skipped,
    failed_count:  stats.failed,
    errors:        stats.errors.length ? stats.errors : null,
  })

  return new Response(JSON.stringify(stats), {
    headers: { 'Content-Type': 'application/json' },
  })
})
