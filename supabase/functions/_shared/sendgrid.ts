/**
 * SendGrid mail helper.
 *
 * Wraps the SendGrid v3 /mail/send REST endpoint directly —
 * no Node.js SDK dependency, works cleanly in Deno/Edge Functions.
 *
 * Docs: https://docs.sendgrid.com/api-reference/mail-send/mail-send
 */

const SENDGRID_API = 'https://api.sendgrid.com/v3/mail/send'

// ── Types ──────────────────────────────────────────────────────

export interface EmailAddress {
  email: string
  name?: string
}

export interface SendEmailParams {
  to:      EmailAddress
  from:    EmailAddress
  subject: string
  /** Plain-text version — always required by SendGrid. */
  text:    string
  /** Optional HTML version. */
  html?:   string
  /** Optional reply-to address. */
  replyTo?: EmailAddress
}

export interface SendResult {
  success:   boolean
  messageId: string | null
  /** Populated when success === false */
  error?:    string
}

// ── Internal helpers ───────────────────────────────────────────

function buildPayload(params: SendEmailParams) {
  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: params.to.email, ...(params.to.name ? { name: params.to.name } : {}) }],
      },
    ],
    from: {
      email: params.from.email,
      ...(params.from.name ? { name: params.from.name } : {}),
    },
    subject: params.subject,
    content: [
      { type: 'text/plain', value: params.text },
      ...(params.html ? [{ type: 'text/html', value: params.html }] : []),
    ],
  }

  if (params.replyTo) {
    payload.reply_to = {
      email: params.replyTo.email,
      ...(params.replyTo.name ? { name: params.replyTo.name } : {}),
    }
  }

  return payload
}

// ── Public API ─────────────────────────────────────────────────

/**
 * Send a single transactional email via SendGrid.
 *
 * Returns a SendResult — never throws, so callers can handle
 * send failures gracefully without a try/catch at every call site.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendResult> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY')

  if (!apiKey) {
    return { success: false, messageId: null, error: 'SENDGRID_API_KEY env var is not set.' }
  }

  let res: Response
  try {
    res = await fetch(SENDGRID_API, {
      method:  'POST',
      headers: {
        Authorization:  `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildPayload(params)),
    })
  } catch (networkErr) {
    return {
      success:   false,
      messageId: null,
      error:     `Network error: ${(networkErr as Error).message}`,
    }
  }

  // SendGrid returns 202 Accepted on success — no response body
  if (res.status === 202) {
    return {
      success:   true,
      messageId: res.headers.get('X-Message-Id'),
    }
  }

  // Parse SendGrid's structured error body when available
  let errDetail = `HTTP ${res.status}`
  try {
    const body = await res.json() as { errors?: { message: string }[] }
    if (body.errors?.length) {
      errDetail = body.errors.map(e => e.message).join('; ')
    }
  } catch {
    errDetail = `HTTP ${res.status}: ${await res.text()}`
  }

  return { success: false, messageId: null, error: errDetail }
}

/**
 * Send multiple emails sequentially.
 *
 * Returns individual results keyed by index so the caller knows
 * exactly which rows succeeded and which failed without stopping
 * the entire batch on a single failure.
 */
export async function sendBatch(
  emails: SendEmailParams[],
): Promise<SendResult[]> {
  const results: SendResult[] = []
  for (const email of emails) {
    results.push(await sendEmail(email))
  }
  return results
}
