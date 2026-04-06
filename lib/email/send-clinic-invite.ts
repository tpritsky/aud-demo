import { getResendFromEmail } from '@/lib/email/resend-from'

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type ClinicInviteEmailParams = {
  to: string
  inviteUrl: string
  clinicName: string
  roleLabel: string
  /** Optional display name suggested by inviter */
  inviteeName?: string | null
}

/**
 * Sends invite email via Resend when RESEND_API_KEY is set.
 * @returns true if sent, false if skipped (no API key).
 */
export async function sendClinicInviteEmail(params: ClinicInviteEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return false

  const { Resend } = await import('resend')
  const resend = new Resend(apiKey)
  const safeClinic = escapeHtml(params.clinicName)
  const greeting =
    params.inviteeName?.trim() ? `Hi ${escapeHtml(params.inviteeName.trim())},` : 'Hi,'

  const res = await resend.emails.send({
    from: getResendFromEmail(),
    to: params.to,
    subject: `You’re invited to join ${params.clinicName}`,
    html: `
      <p>${greeting}</p>
      <p>You’ve been invited to join <strong>${safeClinic}</strong> as <strong>${escapeHtml(params.roleLabel)}</strong>.</p>
      <p><a href="${escapeHtml(params.inviteUrl)}">Create your account</a></p>
      <p style="color:#666;font-size:13px">If the button doesn’t work, copy this link:<br/>${escapeHtml(params.inviteUrl)}</p>
    `,
  })

  if (res.error) {
    console.error('[sendClinicInviteEmail]', res.error)
    const msg =
      typeof res.error === 'object' && res.error && 'message' in res.error
        ? String((res.error as { message: string }).message)
        : 'Email send failed'
    throw new Error(msg)
  }

  return true
}
