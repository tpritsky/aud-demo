import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

/**
 * Read session with a hard time budget so a stuck `getSession()` cannot block hydration forever.
 * Falls back to `getUser()` + second `getSession()` when the first read times out (cookie refresh race).
 */
export async function getSessionWithBudget(totalMs = 14_000): Promise<{
  session: Session | null
  error: unknown
}> {
  const t0 = Date.now()
  const firstMs = Math.min(10_000, totalMs)

  const first = await Promise.race([
    supabase.auth.getSession(),
    new Promise<{ data: { session: null }; error: null }>((r) =>
      setTimeout(() => r({ data: { session: null }, error: null }), firstMs)
    ),
  ])

  if (first.data.session) {
    return { session: first.data.session, error: first.error ?? null }
  }

  const elapsed = Date.now() - t0
  const remaining = totalMs - elapsed
  if (remaining < 600) {
    return { session: null, error: first.error ?? null }
  }

  const userWrap = await Promise.race([
    supabase.auth.getUser(),
    new Promise<{ data: { user: null }; error: unknown }>((r) =>
      setTimeout(() => r({ data: { user: null }, error: null }), Math.min(8_000, remaining))
    ),
  ])

  if (!userWrap.data.user) {
    return { session: null, error: first.error ?? userWrap.error ?? null }
  }

  const rest = totalMs - (Date.now() - t0)
  const second = await Promise.race([
    supabase.auth.getSession(),
    new Promise<{ data: { session: null }; error: null }>((r) =>
      setTimeout(() => r({ data: { session: null }, error: null }), Math.min(6_000, Math.max(800, rest)))
    ),
  ])

  return { session: second.data.session, error: second.error ?? null }
}
