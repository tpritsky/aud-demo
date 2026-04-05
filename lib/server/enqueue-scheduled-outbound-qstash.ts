import { processScheduledOutboundById } from '@/lib/server/scheduled-outbound-processor'

function publicAppUrl(): string | null {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  }
  return null
}

/**
 * When QStash is configured, schedule a one-shot delivery at (about) `scheduledFor`.
 * Caps delay at 7 days (Upstash limit varies; stay conservative).
 * Falls back to running immediately in-process if QStash fails (cron still catches later).
 */
export async function enqueueScheduledOutboundDispatch(
  scheduledOutboundId: string,
  scheduledFor: Date
): Promise<void> {
  const token = process.env.QSTASH_TOKEN
  const base = publicAppUrl()
  const cronSecret = process.env.CRON_SECRET
  if (!token || !base || !cronSecret) return

  const delaySec = Math.max(0, Math.floor((scheduledFor.getTime() - Date.now()) / 1000))
  const capped = Math.min(delaySec, 604800) // 7d

  try {
    const { Client } = await import('@upstash/qstash')
    const client = new Client({ token })
    await client.publishJSON({
      url: `${base}/api/internal/dispatch-scheduled-outbound`,
      body: { id: scheduledOutboundId },
      delay: `${BigInt(capped)}s`,
      retries: 3,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cronSecret}`,
      },
    })
  } catch (e) {
    console.error('[enqueueScheduledOutboundDispatch] QStash failed, optional inline retry:', e)
    if (delaySec <= 0) {
      void processScheduledOutboundById(scheduledOutboundId).catch(() => {})
    }
  }
}
