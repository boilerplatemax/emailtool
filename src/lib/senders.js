/**
 * Sender selector data — parses VITE_SENDERS into a list of
 * { name, email } options for the compose dropdowns.
 *
 * Env format (comma-separated, optional display name):
 *   VITE_SENDERS="Alex <alex@example.com>, Amy <amy@example.com>, dan@example.com"
 *
 * Falls back to the single VITE_SENDER_NAME / VITE_SENDER_EMAIL pair
 * when VITE_SENDERS is not set, preserving the previous behaviour.
 *
 * Every email listed here must be a Verified Sender (or live on a
 * domain-authenticated domain) in your SendGrid account, otherwise
 * SendGrid will reject the send with a 403.
 */

const RAW           = import.meta.env.VITE_SENDERS      ?? ''
const DEFAULT_NAME  = import.meta.env.VITE_SENDER_NAME  ?? ''
const DEFAULT_EMAIL = import.meta.env.VITE_SENDER_EMAIL ?? ''

function parseEntry(raw) {
  const s = raw.trim()
  if (!s) return null

  // "Name <email@x.com>"
  const m = s.match(/^(.+?)\s*<([^>]+)>\s*$/)
  if (m) return { name: m[1].trim(), email: m[2].trim().toLowerCase() }

  // Bare email
  if (s.includes('@')) return { name: '', email: s.toLowerCase() }

  return null
}

export const SENDERS = (() => {
  const list = RAW.split(',').map(parseEntry).filter(Boolean)
  if (list.length) return list
  if (DEFAULT_EMAIL) return [{ name: DEFAULT_NAME, email: DEFAULT_EMAIL.toLowerCase() }]
  return []
})()

export const DEFAULT_SENDER = SENDERS[0] ?? { name: '', email: '' }
