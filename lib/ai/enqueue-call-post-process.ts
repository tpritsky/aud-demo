import { runCallPostProcessJob } from '@/lib/ai/run-call-post-process'

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
 * Durable enqueue for Claude post-processing (multi-tenant, high volume).
 *
 * Priority:
 * 1. **QStash** — if `QSTASH_TOKEN` is set, publishes a delayed message with retries (best for production scale).
 * 2. **Vercel `waitUntil`** — if `VERCEL` is set, extends the current invocation until the job finishes.
 * 3. **Local / fallback** — `void` the job (dev only; not reliable on serverless without 1 or 2).
 */
export async function enqueueCallPostProcess(callId: string): Promise<void> {
  const qstashToken = process.env.QSTASH_TOKEN
  const baseUrl = publicAppUrl()

  if (qstashToken && baseUrl) {
    try {
      const { Client } = await import('@upstash/qstash')
      const client = new Client({ token: qstashToken })
      await client.publishJSON({
        url: `${baseUrl}/api/internal/process-call-ai`,
        body: { callId },
        retries: 5,
        delay: '3s',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      return
    } catch (e) {
      console.error('[enqueueCallPostProcess] QStash publish failed, falling back:', e)
    }
  }

  if (process.env.VERCEL) {
    try {
      const { waitUntil } = await import('@vercel/functions')
      waitUntil(
        runCallPostProcessJob(callId).catch((err) => {
          console.error('[enqueueCallPostProcess] waitUntil job failed:', err)
        })
      )
      return
    } catch (e) {
      console.error('[enqueueCallPostProcess] waitUntil unavailable, falling back:', e)
    }
  }

  void runCallPostProcessJob(callId).catch((err) => {
    console.error('[enqueueCallPostProcess] inline job failed:', err)
  })
}
