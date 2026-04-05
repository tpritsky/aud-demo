import { NextRequest, NextResponse } from 'next/server'
import { processDueScheduledOutboundCalls } from '@/lib/server/scheduled-outbound-processor'

/**
 * GET /api/cron/scheduled-outbound
 * Vercel Cron or manual ping. Set CRON_SECRET and send Authorization: Bearer <CRON_SECRET>.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 })
  }
  const auth = request.headers.get('Authorization')
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await processDueScheduledOutboundCalls(10)
  return NextResponse.json({ ok: true, ...result })
}
