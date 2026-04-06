import { supabase } from '@/lib/supabase/client'

/** True when Supabase failed to refresh the session (expired / revoked / missing refresh token). */
export function isRefreshTokenAuthError(err: unknown): boolean {
  if (err == null || typeof err !== 'object') return false
  const o = err as { message?: string; name?: string }
  const msg = typeof o.message === 'string' ? o.message.toLowerCase() : ''
  const name = typeof o.name === 'string' ? o.name.toLowerCase() : ''
  if (name.includes('auth') && msg.includes('refresh')) return true
  return (
    msg.includes('invalid refresh token') ||
    msg.includes('refresh token not found') ||
    msg.includes('refresh token') ||
    (msg.includes('session') && msg.includes('not found'))
  )
}

/**
 * Clear a broken or unwanted browser session without calling Supabase sign-out API
 * (avoids extra errors when the refresh token is already invalid).
 */
function wipeSupabaseBrowserStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const prefix = 'sb-'
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i)
      if (
        key?.startsWith(prefix) &&
        (key.includes('auth') || key.toLowerCase().includes('supabase'))
      ) {
        localStorage.removeItem(key)
      }
    }
  } catch {
    // ignore
  }
}

export async function clearLocalSupabaseSession(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // ignore
  }
  wipeSupabaseBrowserStorage()
}

/**
 * Before showing the password form: drop cached tokens without calling global sign-out
 * (global `signOut` can hang on the network — same class of bug as stuck `getSession`).
 * Sync storage wipe first, then bounded local sign-out.
 */
export async function prepareClientForFreshSignIn(maxWaitMs = 900): Promise<void> {
  wipeSupabaseBrowserStorage()
  await Promise.race([
    (async () => {
      try {
        await supabase.auth.signOut({ scope: 'local' })
      } catch {
        // ignore
      }
    })(),
    new Promise<void>((resolve) => setTimeout(resolve, maxWaitMs)),
  ])
  wipeSupabaseBrowserStorage()
}
