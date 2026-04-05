import { NextRequest, NextResponse } from 'next/server'
import { processScheduledOutboundById } from '@/lib/server/scheduled-outbound-processor'

/**
 * POST /api/internal/dispatch-scheduled-outbound
 * QStash (or cron secret) triggers a single scheduled row. Same auth as cron.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const id = typeof body.id === 'string' ? body.id : ''
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const result = await processScheduledOutboundById(id)
  return NextResponse.json({ ok: true, ...result })
}
