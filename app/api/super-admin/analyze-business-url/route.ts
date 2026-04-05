import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { analyzeBusinessFromWebsiteUrl } from '@/lib/ai/business-url-analysis'

/**
 * POST /api/super-admin/analyze-business-url
 * Body: { url: string }
 * Super admin only. Uses Tavily extract + Claude to suggest name, vertical, and notes.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    const role = (profile as { role?: string } | null)?.role
    if (role !== 'super_admin') {
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
    const lower = message.toLowerCase()
    const clientish =
      lower.includes('invalid url') ||
      lower.includes('url is required') ||
      lower.includes('only http') ||
      lower.includes('no content could be extracted') ||
      lower.includes('unauthorized') ||
      lower.includes('forbidden')
    console.error('analyze-business-url:', message)
    return NextResponse.json(
      { error: message },
      { status: clientish ? 400 : 502 }
    )
  }
}
