'use client'

import { createBrowserClient } from '@supabase/ssr'
import { Database } from '@/lib/db/types'
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/supabase/env'

const supabaseUrl = getPublicSupabaseUrl()
const supabaseAnonKey = getPublicSupabaseAnonKey()

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

export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: authStorageLock,
  },
})
