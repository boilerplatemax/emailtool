/**
 * Supabase admin client for Edge Functions.
 *
 * Uses the service-role key so it bypasses RLS — never expose
 * this client or key to the browser.
 */
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

let _client: SupabaseClient | null = null

export function getAdminClient(): SupabaseClient {
  if (_client) return _client

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!url || !key) {
    throw new Error('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env var is missing.')
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  })

  return _client
}
