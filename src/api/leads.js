/**
 * leads.js — all Supabase queries for the leads table.
 *
 * Note: upsertLeads (CSV import) and send-outreach are handled
 * by Edge Functions — they need the service-role key server-side.
 */

import { supabase } from '../lib/supabase'

// ── Filter helpers ────────────────────────────────────────────

function applyFilters(q, { search, responded, called, province, hasPhone, hasEmail } = {}) {
  if (typeof responded === 'boolean') q = q.eq('responded', responded)
  if (typeof called    === 'boolean') q = q.eq('called', called)
  if (province)  q = q.eq('province', province)
  if (hasPhone) q = q.not('phone', 'is', null).neq('phone', '')
  if (hasEmail) q = q.not('email', 'is', null).neq('email', '')
  if (search) {
    const s = search.replace(/[,()]/g, ' ')
    q = q.or(`email.ilike.%${s}%,name.ilike.%${s}%,union_name.ilike.%${s}%,local.ilike.%${s}%,phone.ilike.%${s}%`)
  }
  return q
}

// ── Read ──────────────────────────────────────────────────────

/**
 * Paginated lead list with optional filters.
 */
export async function getLeads({ page = 1, pageSize = 50, ...filters } = {}) {
  let q = supabase
    .from('leads')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1)

  q = applyFilters(q, filters)

  const { data, error, count } = await q
  if (error) throw error
  return { data, count }
}

/**
 * Get just the ordered list of lead IDs matching the given filters.
 * Used for prev/next navigation inside LeadDetail.
 */
export async function getLeadIds(filters = {}, limit = 2000) {
  let q = supabase
    .from('leads')
    .select('id')
    .order('created_at', { ascending: false })
    .limit(limit)

  q = applyFilters(q, filters)

  const { data, error } = await q
  if (error) throw error
  return data.map(r => r.id)
}

/**
 * Distinct list of non-null provinces present in the table.
 */
export async function getProvinces() {
  const { data, error } = await supabase
    .from('leads')
    .select('province')
    .not('province', 'is', null)
    .neq('province', '')
  if (error) throw error
  const set = new Set(data.map(r => r.province?.trim()).filter(Boolean))
  return Array.from(set).sort((a, b) => a.localeCompare(b))
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
 * Mark/unmark a lead as having been called.
 */
export async function setCalled(id, called) {
  const { data, error } = await supabase
    .from('leads')
    .update({ called })
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
