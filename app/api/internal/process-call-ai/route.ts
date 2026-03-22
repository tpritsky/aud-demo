import { NextRequest, NextResponse } from 'next/server'
import { Receiver } from '@upstash/qstash'
import { runCallPostProcessJob } from '@/lib/ai/run-call-post-process'

export const runtime = 'nodejs'
export const maxDuration = 120

/**
 * Worker for call AI post-processing.
 * - **QStash**: verifies `Upstash-Signature` (set QSTASH_CURRENT_SIGNING_KEY + QSTASH_NEXT_SIGNING_KEY in Vercel).
 * - **Direct** (cron / manual): `Authorization: Bearer ${CALL_AI_PROCESS_SECRET}`.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const signature = request.headers.get('Upstash-Signature')

  const signingKey = process.env.QSTASH_CURRENT_SIGNING_KEY
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY

  let authorized = false

  if (signature && signingKey && nextSigningKey) {
    try {
      const receiver = new Receiver({
        currentSigningKey: signingKey,
        nextSigningKey: nextSigningKey,
      })
      await receiver.verify({
        signature,
        body: rawBody,
        url: request.nextUrl.toString(),
        clockTolerance: 30,
      })
      authorized = true
    } catch {
      authorized = false
    }
  }

  if (!authorized) {
    const secret = process.env.CALL_AI_PROCESS_SECRET
    const auth = request.headers.get('authorization')
    const bearer = auth?.replace(/^Bearer\s+/i, '')
    if (secret && bearer === secret) {
      authorized = true
    }
  }

  if (!authorized) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { callId?: string }
  try {
    body = JSON.parse(rawBody) as { callId?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const callId = typeof body.callId === 'string' ? body.callId.trim() : ''
  if (!callId) {
    return NextResponse.json({ error: 'callId required' }, { status: 400 })
  }

  await runCallPostProcessJob(callId)

  return NextResponse.json({ ok: true })
}
