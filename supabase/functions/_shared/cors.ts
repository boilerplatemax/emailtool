/**
 * CORS headers required for browser → Edge Function calls.
 *
 * x-app-password is listed so the preflight passes when we
 * send it as a custom request header.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': [
    'authorization',
    'x-client-info',
    'apikey',
    'content-type',
    'x-app-password',
  ].join(', '),
}

/** Respond to CORS preflight (OPTIONS) requests. */
export function preflight(): Response {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

/** Wrap any Response with CORS headers. */
export function withCors(res: Response): Response {
  const headers = new Headers(res.headers)
  Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v))
  return new Response(res.body, { status: res.status, headers })
}

/** JSON response with CORS headers. */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

/** Error response with CORS headers. */
export function error(message: string, status = 400): Response {
  return json({ error: message }, status)
}
