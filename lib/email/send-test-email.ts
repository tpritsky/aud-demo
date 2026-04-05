import { RESEND_FROM_EMAIL } from '@/lib/email/resend-from'

/**
 * Transactional email via Resend (test sends, post-call follow-ups, etc.).
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

  const { error } = await resend.emails.send({
    from: RESEND_FROM_EMAIL,
    to: params.to,
    subject: params.subject,
    text: params.body,
  })

  if (error) {
    console.error('[sendTestEmail]', error)
    throw new Error(
      typeof error === 'object' && error && 'message' in error
        ? String((error as { message: string }).message)
        : 'Email send failed'
    )
  }
}
