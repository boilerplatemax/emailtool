/**
 * functions.js — browser-side wrappers for all Edge Function calls.
 *
 * The APP_PASSWORD is embedded in the Vite bundle (acceptable for an
 * internal tool).  It is validated server-side against the Edge Function's
 * own APP_PASSWORD env var, which is the authoritative check.
 *
 * Never call Edge Functions directly from components — always go through
 * this module so the auth header is applied consistently.
 */

const BASE_URL     = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD
const ANON_KEY     = import.meta.env.VITE_SUPABASE_ANON_KEY

// ── Internal helper ────────────────────────────────────────────

/**
 * POST JSON to an Edge Function and return the parsed response.
 * Throws a descriptive Error on any non-ok response.
 */
async function callFunction(name, payload) {
  const res = await fetch(`${BASE_URL}/${name}`, {
    method:  'POST',
    headers: {
      'Content-Type':   'application/json',
      'Authorization':  `Bearer ${ANON_KEY}`,
      'x-app-password': APP_PASSWORD,
    },
    body: JSON.stringify(payload),
  })

  // Try to parse body as JSON for a clean error message
  let data
  try {
    data = await res.json()
  } catch {
    throw new Error(`[${name}] HTTP ${res.status}: unparseable response`)
  }

  if (!res.ok) {
    const msg = data?.error ?? `HTTP ${res.status}`
    throw new Error(`[${name}] ${msg}`)
  }

  return data
}

// ── Lead CSV import ────────────────────────────────────────────

/**
 * Upload a parsed batch of lead rows.
 *
 * @param {{
 *   filename:          string,
 *   rows:              object[],
 *   duplicateBehavior: 'ignore' | 'replace'
 * }} params
 * @returns {Promise<{ created: number, updated: number, skipped: number, failed: number, errors: object[] }>}
 */
export async function importLeads({ filename, rows, duplicateBehavior = 'ignore' }) {
  return callFunction('import-leads', { filename, rows, duplicateBehavior })
}

// ── Outreach CSV send ──────────────────────────────────────────

/**
 * Send an outreach batch.  Each row is sent as an individual email
 * and logged as a message on the resolved lead.
 *
 * @param {{
 *   filename:        string,
 *   rows:            object[],
 *   senderEmail:     string,
 *   senderName:      string,
 *   staggerMinutes?: number,
 * }} params
 * @returns {Promise<{ sent: number, failed: number, leadsCreated: number, errors: object[] }>}
 */
export async function sendOutreach({ filename, rows, senderEmail, senderName, staggerMinutes }) {
  return callFunction('send-outreach', { filename, rows, senderEmail, senderName, staggerMinutes })
}

// ── Single email ───────────────────────────────────────────────

/**
 * Send a one-off email to a specific lead (by UUID).
 *
 * @param {{
 *   leadId:      string,
 *   subject:     string,
 *   body:        string,
 *   senderEmail: string,
 *   senderName:  string,
 * }} params
 * @returns {Promise<{ success: boolean, messageId: string | null, loggedId: string, error?: string }>}
 */
export async function sendSingleEmail({ leadId, subject, body, senderEmail, senderName }) {
  return callFunction('send-single', { leadId, subject, body, senderEmail, senderName })
}
