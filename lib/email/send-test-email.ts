import { RESEND_FROM_EMAIL } from '@/lib/email/resend-from'

type ResendErrorShape = {
  message?: string
  name?: string
  statusCode?: number | null
}

function formatResendError(error: ResendErrorShape | null | undefined): string {
  if (!error) return 'Unknown Resend error'
  const parts = [error.name, error.message].filter((x): x is string => typeof x === 'string' && x.length > 0)
  const s = parts.join(' — ') || 'Unknown Resend error'
  return s.length > 400 ? `${s.slice(0, 400)}…` : s
}

/**
 * Transactional email via Resend (test sends, post-call follow-ups, live ConvAI tool, etc.).
 */
export async function sendTestEmail(params: {
  to: string
  subject: string
  body: string
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    throw new Error('RESEND_NOT_CONFIGURED')
  }

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)

  const res = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.body,
  })

  if (res.error) {
    console.error('[sendTestEmail]', res.error)
    throw new Error(formatResendError(res.error))
  }
  if (!res.data?.id) {
    console.error('[sendTestEmail] missing data.id', res)
    throw new Error('Resend accepted the request but returned no message id')
  }
}
