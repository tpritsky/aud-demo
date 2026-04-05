import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get('Authorization')
  return h?.replace(/^Bearer\s+/i, '') || null
}

/**
 * Returns `null` if OK with `{ user }`, or a `NextResponse` to return (401/403).
 */
export async function requireVoiceApiUser(
  request: NextRequest
): Promise<{ user: { id: string } } | NextResponse> {
  const token = bearerToken(request)
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createServerClient()
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token)
  if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
  const role = (profile as { role?: string } | null)?.role
  if (role !== 'super_admin' && role !== 'admin' && role !== 'member') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return { user }
}
