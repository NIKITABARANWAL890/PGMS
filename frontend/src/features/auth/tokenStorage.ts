/**
 * Where each token lives, and why.
 *
 * The access token is held in Redux only — never in localStorage. It is the
 * credential that actually opens the API, it is short-lived, and keeping it out
 * of persistent storage means a script that manages to read storage gets
 * nothing it can use for long.
 *
 * The refresh token does persist, because a page reload has to keep you signed
 * in and there is nowhere else to put it: the backend returns it in the
 * response body rather than setting an httpOnly cookie. An httpOnly refresh
 * cookie is the stronger design and is worth revisiting once the app is served
 * from a known origin — logged as a deliberate Phase 1 tradeoff, not an
 * oversight.
 */

const REFRESH_TOKEN_KEY = 'pgms.refresh_token'

export function readStoredRefreshToken(): string | null {
  try {
    return window.localStorage.getItem(REFRESH_TOKEN_KEY)
  } catch {
    // Private mode / storage disabled — treat as "not signed in".
    return null
  }
}

export function storeRefreshToken(token: string): void {
  try {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token)
  } catch {
    /* Session simply will not survive a reload. */
  }
}

export function clearStoredRefreshToken(): void {
  try {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    /* nothing to clear */
  }
}
