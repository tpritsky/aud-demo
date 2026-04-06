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
 * Before showing the password form: local sign-out only (bounded). Avoid manually wiping all `sb-*`
 * localStorage keys — @supabase/ssr keeps the session in cookies; aggressive wipes can desync storage
 * and make reloads look “logged out” while cookies still exist, or vice versa.
 */
export async function prepareClientForFreshSignIn(maxWaitMs = 1200): Promise<void> {
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
}
