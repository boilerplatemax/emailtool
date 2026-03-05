import { supabase } from '../lib/supabase'

/**
 * All messages for a single lead, newest first.
 */
export async function getMessagesByLeadId(leadId) {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('lead_id', leadId)
    .order('sent_at', { ascending: false })
  if (error) throw error
  return data
}

/**
 * Recent activity feed (uses the pre-built view).
 */
export async function getRecentActivity() {
  const { data, error } = await supabase
    .from('vw_recent_activity')
    .select('*')
  if (error) throw error
  return data
}
