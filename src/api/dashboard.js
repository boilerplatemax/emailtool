import { supabase } from '../lib/supabase'

/**
 * Returns aggregate metrics from the vw_dashboard_stats view:
 *   total_leads, total_sent, total_responded, response_rate_pct
 */
export async function getDashboardStats() {
  const { data, error } = await supabase
    .from('vw_dashboard_stats')
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Import log history, newest first.
 */
export async function getRecentImports(limit = 10) {
  const { data, error } = await supabase
    .from('import_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data
}
