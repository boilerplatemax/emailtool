/**
 * Password gate for Edge Functions.
 *
 * The browser sends the app password in the `x-app-password` header.
 * The Edge Function reads APP_PASSWORD from its own env — the value
 * is never stored in the frontend bundle's env vars at this layer.
 *
 * Set via Supabase CLI:
 *   supabase secrets set APP_PASSWORD=your_secret
 */
export function isAuthorised(req: Request): boolean {
  const appPassword = Deno.env.get('APP_PASSWORD')

  if (!appPassword) {
    console.error('APP_PASSWORD env var is not set on the Edge Function.')
    return false
  }

  const provided = req.headers.get('x-app-password')
  return provided === appPassword
}
