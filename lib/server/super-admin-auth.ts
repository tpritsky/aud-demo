import { NextResponse } from 'next/server'
import type { createServerClient } from '@/lib/supabase/server'

type ServerSupabase = ReturnType<typeof createServerClient>

/** Returns null if the caller is super_admin; otherwise a 403 JSON response. */
export async function assertCallerIsSuperAdmin(
  supabase: ServerSupabase,
  authUserId: string
): Promise<NextResponse | null> {
  const { data: p } = await supabase.from('profiles').select('role').eq('id', authUserId).maybeSingle()
  if ((p as { role?: string } | null)?.role !== 'super_admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}
