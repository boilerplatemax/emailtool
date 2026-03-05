/**
 * Password-gate using an env variable.
 *
 * Security note: this is suitable for lightweight internal tools.
 * The password is embedded in the built JS bundle — do not use
 * for anything requiring real access control.
 *
 * The session is persisted to sessionStorage so a page refresh
 * within the same tab does not re-prompt.
 */

const SESSION_KEY = 'emailtool_auth'
const APP_PASSWORD = import.meta.env.VITE_APP_PASSWORD

export function isAuthenticated() {
  return sessionStorage.getItem(SESSION_KEY) === 'true'
}

/**
 * @param {string} input  Password entered by the user
 * @returns {boolean}     true if correct
 */
export function authenticate(input) {
  const ok = input === APP_PASSWORD
  if (ok) sessionStorage.setItem(SESSION_KEY, 'true')
  return ok
}

export function logout() {
  sessionStorage.removeItem(SESSION_KEY)
}
