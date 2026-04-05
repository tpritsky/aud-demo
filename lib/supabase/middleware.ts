import { createClient } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { getPublicSupabaseAnonKey, getPublicSupabaseUrl } from '@/lib/supabase/env'

/**
 * Create a Supabase client for middleware
 * For Next.js 16, we use a simpler approach with cookie handling
 */
export function createMiddlewareClient(request: NextRequest) {
  const supabaseUrl = getPublicSupabaseUrl()
  const supabaseAnonKey = getPublicSupabaseAnonKey()

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return supabase
}
