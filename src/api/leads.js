/**
 * leads.js — all Supabase queries for the leads table.
 *
 * Note: upsertLeads (CSV import) and send-outreach are handled
 * by Edge Functions — they need the service-role key server-side.
 */

import { supabase } from '../lib/supabase'

// ── Read ──────────────────────────────────────────────────────

/**
 * Paginated lead list with optional filters.
 * @param {{ search?: string, responded?: boolean, province?: string, page?: number, pageSize?: number }} opts
 */
export async function getLeads({ search, responded, province, page = 1, pageSize = 50 } = {}) {
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  if (typeof responded === 'boolean') q = q.eq('responded', responded)
  if (province)  q = q.eq('province', province)
  if (search)    q = q.or(`email.ilike.%${search}%,name.ilike.%${search}%,union_name.ilike.%${search}%`)

  const { data, error, count } = await q
  if (error) throw error
  return { data, count }
}

/**
 * Single lead by its UUID.
 */
export async function getLeadById(id) {
  const { data, error } = await supabase
    .from('leads')
    .select('*, messages(*)')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

/**
 * Look up a lead by the composite natural key.
 */
export async function getLeadByUnionLocal(unionName, local) {
  const { data, error } = await supabase
    .from('leads')
    .select('*')
    .eq('union_name', unionName)
    .eq('local', local)
    .maybeSingle()
  if (error) throw error
  return data   // null when not found
}

// ── Write ─────────────────────────────────────────────────────

/**
 * Mark/unmark a lead as having responded.
 */
export async function setResponded(id, responded) {
  const { data, error } = await supabase
    .from('leads')
    .update({ responded })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

/**
 * Update the free-text notes field.
 */
export async function updateNotes(id, notes) {
  const { data, error } = await supabase
    .from('leads')
    .update({ notes })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
