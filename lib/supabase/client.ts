'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/db/types'
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/supabase/env'

/**
 * Default Supabase auth uses `navigator.locks` + an AbortSignal timeout (@supabase/auth-js locks.ts).
 * Under React Strict Mode + Turbopack, that often surfaces as Runtime AbortError ("signal is aborted without reason").
 * A no-op lock still serializes via GoTrueClient's in-memory queue in a single tab; cross-tab is slightly less coordinated.
 */
async function authStorageLock<R>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> {
  return fn()
}

let browserClient: SupabaseClient<Database> | undefined

function getBrowserClient(): SupabaseClient<Database> {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(getPublicSupabaseUrl(), getPublicSupabaseAnonKey(), {
      auth: {
        lock: authStorageLock,
      },
    })
  }
  return browserClient
}

/**
 * Lazy singleton: `createBrowserClient` must not run during SSR/static prerender (bad/missing
 * NEXT_PUBLIC_* on the server chunk triggers Invalid supabaseUrl). Real usage is in effects/handlers (browser-only).
 */
export const supabase: SupabaseClient<Database> = new Proxy({} as SupabaseClient<Database>, {
  get(_target, prop, receiver) {
    const client = getBrowserClient()
    const value = Reflect.get(client, prop, receiver)
    return typeof value === 'function' ? value.bind(client) : value
  },
})
