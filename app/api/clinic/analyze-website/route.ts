import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { analyzeBusinessFromWebsiteUrl } from '@/lib/ai/business-url-analysis'

function bearerToken(request: NextRequest): string | null {
  const h = request.headers.get('Authorization')
  return h?.replace(/^Bearer\s+/i, '') || null
}

/**
 * POST /api/clinic/analyze-website
 * Same analysis as super-admin URL tool, for clinic admins/members completing onboarding.
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearerToken(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile, error: pErr } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (pErr || !profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })

    const clinicId = (profile as { clinic_id?: string | null }).clinic_id
    const role = (profile as { role?: string }).role
    if (!clinicId) return NextResponse.json({ error: 'No clinic assigned' }, { status: 400 })
    if (role !== 'admin' && role !== 'member') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)
    const url = typeof body?.url === 'string' ? body.url : ''
    if (!url.trim()) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const result = await analyzeBusinessFromWebsiteUrl(url)
    return NextResponse.json(result)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Analysis failed'
    console.error('POST /api/clinic/analyze-website', e)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
