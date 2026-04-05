import { normalizePhoneNumber } from '@/lib/phone-format'

const MAX_BODY = 1600

/**
 * Send one outbound SMS via Twilio (same env as /api/clinic/sms-test).
 */
export async function sendTwilioSms(params: { to: string; body: string }): Promise<void> {
  const to = normalizePhoneNumber(params.to)
  if (!to.startsWith('+') || to.replace(/\D/g, '').length < 10) {
    throw new Error('Invalid destination phone (need E.164)')
  }
  const text = params.body.trim().slice(0, MAX_BODY)
  if (!text.length) throw new Error('Message body is empty')

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim()
  const authToken =
    process.env.TWILIO_AUTH_TOKEN?.trim() ||
    process.env.SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN?.trim()
  const apiKeySid = process.env.TWILIO_API_KEY_SID?.trim()
  const apiKeySecret = process.env.TWILIO_API_KEY_SECRET?.trim()
  const from =
    process.env.TWILIO_SMS_FROM?.trim() ||
    process.env.TWILIO_PHONE_NUMBER?.trim() ||
    process.env.TWILIO_FROM_NUMBER?.trim()

  const hasTokenAuth = Boolean(accountSid && authToken)
  const hasApiKeyAuth = Boolean(accountSid && apiKeySid && apiKeySecret)
  if (!hasTokenAuth && !hasApiKeyAuth) {
    throw new Error('TWILIO_NOT_CONFIGURED')
  }
  if (!from) {
    throw new Error('TWILIO_FROM_NOT_SET')
  }

  const basic =
    hasTokenAuth && accountSid && authToken
      ? Buffer.from(`${accountSid}:${authToken}`).toString('base64')
      : Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString('base64')

  const paramsBody = new URLSearchParams({ To: to, From: from, Body: text })
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid!)}/Messages.json`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: paramsBody.toString(),
    }
  )

  const rawText = await res.text()
  type TwilioMsgJson = { message?: string; code?: number }
  let twilioJson: TwilioMsgJson | null = null
  try {
    twilioJson = JSON.parse(rawText) as TwilioMsgJson
  } catch {
    /* ignore */
  }

  if (!res.ok) {
    const msg =
      (twilioJson && typeof twilioJson.message === 'string' && twilioJson.message) ||
      rawText.slice(0, 400) ||
      `Twilio error ${res.status}`
    throw new Error(msg)
  }
}
