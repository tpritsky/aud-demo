/**
 * Default outbound Resend "from" when `RESEND_FROM_EMAIL` is not set.
 * The domain must be verified in the Resend project that owns `RESEND_API_KEY`.
 */
export const DEFAULT_RESEND_FROM_EMAIL = 'support@vocalis.team'

/**
 * Effective from address. Set `RESEND_FROM_EMAIL` in production if `DEFAULT_RESEND_FROM_EMAIL`
 * is not verified on your Resend account (common cause of “failed to send” with a valid API key).
 */
export function getResendFromEmail(): string {
  const e = process.env.RESEND_FROM_EMAIL?.trim()
  return e || DEFAULT_RESEND_FROM_EMAIL
}
