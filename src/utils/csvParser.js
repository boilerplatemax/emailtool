/**
 * csvParser.js
 *
 * Parses and validates CSV files for both import types.
 * Returns { rows: [...], errors: [...] }.
 *
 * Usage:
 *   const { rows, errors } = parseLeadsCsv(rawText)
 *   const { rows, errors } = parseOutreachCsv(rawText)
 */

const LEADS_REQUIRED    = ['union', 'local', 'email']
const LEADS_OPTIONAL    = ['phone', 'address', 'province', 'name']

const OUTREACH_REQUIRED = ['union', 'local', 'email', 'province', 'employer / sector', 'subject', 'body']
const OUTREACH_OPTIONAL = ['name']

// ── Helpers ───────────────────────────────────────────────────

function parseRaw(text) {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase())
  const rows    = lines.slice(1).map((line, i) => ({ _line: i + 2, _raw: line }))

  rows.forEach(row => {
    const values = row._raw.split(',')
    headers.forEach((h, idx) => { row[h] = (values[idx] ?? '').trim() })
  })

  return { headers, rows }
}

function validateRows(rows, required, allowed) {
  const valid  = []
  const errors = []

  rows.forEach(row => {
    const missing = required.filter(f => !row[f])
    if (missing.length) {
      errors.push({ line: row._line, reason: `Missing required fields: ${missing.join(', ')}` })
      return
    }

    const cleaned = {}
    ;[...required, ...allowed].forEach(f => {
      if (row[f]) cleaned[f] = row[f]
    })
    valid.push(cleaned)
  })

  return { valid, errors }
}

// ── Public API ────────────────────────────────────────────────

/**
 * @param {string} text  Raw CSV string
 * @returns {{ rows: object[], errors: object[] }}
 */
export function parseLeadsCsv(text) {
  const { headers, rows } = parseRaw(text)
  const missing = LEADS_REQUIRED.filter(f => !headers.includes(f))
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, reason: `CSV missing columns: ${missing.join(', ')}` }] }
  }
  const { valid, errors } = validateRows(rows, LEADS_REQUIRED, LEADS_OPTIONAL)
  // normalise field names to match DB columns
  const normalised = valid.map(r => ({
    union_name: r.union,
    local:      r.local,
    email:      r.email,
    phone:      r.phone    || null,
    address:    r.address  || null,
    province:   r.province || null,
    name:       r.name     || null,
  }))
  return { rows: normalised, errors }
}

/**
 * @param {string} text  Raw CSV string
 * @returns {{ rows: object[], errors: object[] }}
 */
export function parseOutreachCsv(text) {
  const { headers, rows } = parseRaw(text)
  const missing = OUTREACH_REQUIRED.filter(f => !headers.includes(f))
  if (missing.length) {
    return { rows: [], errors: [{ line: 1, reason: `CSV missing columns: ${missing.join(', ')}` }] }
  }
  const { valid, errors } = validateRows(rows, OUTREACH_REQUIRED, OUTREACH_OPTIONAL)
  const normalised = valid.map(r => ({
    union_name:      r.union,
    local:           r.local,
    email:           r.email,
    province:        r.province,
    employer_sector: r['employer / sector'],
    subject:         r.subject,
    body:            r.body,
    name:            r.name || null,
  }))
  return { rows: normalised, errors }
}
