import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/**
 * Read session with a hard time budget so a stuck `getSession()` cannot block hydration forever.
 * Falls back to `getUser()` + second `getSession()` when the first read times out (cookie refresh race).
 *
 * Phase lengths scale with `totalMs` so a small budget never starves the getUser / second-getSession path
 * (which previously caused false "no session" while the user was still signed in).
 */
export async function getSessionWithBudget(totalMs = 22_000): Promise<{
  session: Session | null
  error: unknown
}> {
  const t0 = Date.now()
  const minFallbackBudget = 10_500
  const firstMs = Math.min(
    12_000,
    Math.max(3_500, totalMs - minFallbackBudget)
  )

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

/**
 * Access token for `Authorization: Bearer` API calls.
 * Uses a generous budget, then `refreshSession`, then a final `getSession` attempt.
 * Does not sign the user out — login gating and explicit sign-out handle invalid sessions.
 */
export async function getAccessTokenWithBudget(totalMs = 24_000): Promise<string | null> {
  const { session } = await getSessionWithBudget(totalMs)
  let t: string | null = session?.access_token?.trim() || null
  if (t) return t

  const refresh = await Promise.race([
    supabase.auth.refreshSession(),
    sleep(10_000).then(() => ({ data: { session: null }, error: null as unknown })),
  ])
  const rs = refresh as { data: { session: Session | null }; error: unknown }
  t = rs.data.session?.access_token?.trim() || null
  if (t) return t

  await Promise.race([
    supabase.auth.getUser().then((r) => ({ kind: 'ok' as const, r })),
    sleep(6_000).then(() => ({ kind: 'timeout' as const })),
  ])

  const last = await Promise.race([
    supabase.auth.getSession(),
    sleep(4_000).then(() => ({ data: { session: null }, error: null as unknown })),
  ])
  const ls = last as { data: { session: Session | null } }
  return ls.data.session?.access_token?.trim() || null
}
