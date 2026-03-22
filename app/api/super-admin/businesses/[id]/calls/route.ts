import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import * as dbUtils from '@/lib/db/utils'
import type { CallRow } from '@/lib/db/types'

/**
 * GET /api/super-admin/businesses/[id]/calls
 * List calls for a business (clinic). Super admin only.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
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

    if ((profile as { role?: string } | null)?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: clinicId } = await context.params
    if (!clinicId?.trim()) {
      return NextResponse.json({ error: 'Invalid business id' }, { status: 400 })
    }

    const { data: clinic } = await supabase.from('clinics').select('id').eq('id', clinicId).maybeSingle()
    if (!clinic) {
      return NextResponse.json({ error: 'Business not found' }, { status: 404 })
    }

    const limitParam = request.nextUrl.searchParams.get('limit')
    const limit = Math.min(Math.max(parseInt(limitParam || '200', 10) || 200, 1), 500)

    const { data: rows, error } = await supabase
      .from('calls')
      .select('*')
      .eq('clinic_id', clinicId)
      .order('timestamp', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('super-admin calls:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const calls = (rows || []).map((row) => dbUtils.dbCallToApp(row as CallRow))

    return NextResponse.json({ calls })
  } catch (e) {
    console.error('super-admin calls route:', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
