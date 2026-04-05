import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { normalizePhoneNumber } from '@/lib/phone-format'
import { sendTestEmail } from '@/lib/email/send-test-email'
import { sendTwilioSms } from '@/lib/server/twilio-sms'

function bearer(request: NextRequest): string | null {
  return request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '') || null
}

const MAX_BODY = 1600

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * POST /api/clinic/sms-test
 * Body:
 *   SMS: { channel?: "sms", to: E.164 phone, body: string }
 *   Email: { channel: "email", to: email, body: string, subject?: string }
 * Sends one SMS via Twilio or one email via Resend (admin / super_admin only).
 * Twilio auth: Account SID + token OR Account SID + API key SID + secret.
 */
export async function POST(request: NextRequest) {
  try {
    const token = bearer(request)
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const supabase = createServerClient()
    const {
      data: { user },
      error: uErr,
    } = await supabase.auth.getUser(token)
    if (uErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
    const role = (profile as { role?: string } | null)?.role
    if (role !== 'admin' && role !== 'super_admin') {
      return NextResponse.json({ error: 'Only administrators can send test messages' }, { status: 403 })
    }

    let bodyJson: unknown
    try {
      bodyJson = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    const o = bodyJson && typeof bodyJson === 'object' ? (bodyJson as Record<string, unknown>) : {}
    const channel = o.channel === 'email' ? 'email' : 'sms'
    const toRaw = typeof o.to === 'string' ? o.to : ''
    const textRaw = typeof o.body === 'string' ? o.body : ''
    const text = textRaw.trim().slice(0, MAX_BODY)

    if (!text.length) {
      return NextResponse.json({ error: 'Message cannot be empty' }, { status: 400 })
    }

    if (channel === 'email') {
      const email = toRaw.trim().toLowerCase()
      if (!email || !EMAIL_RE.test(email)) {
        return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
      }
      const subjectRaw = typeof o.subject === 'string' ? o.subject.trim() : ''
      const subject = subjectRaw.slice(0, 200) || 'Test message'
      try {
        await sendTestEmail({ to: email, subject, body: text })
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Email failed'
        if (msg === 'RESEND_NOT_CONFIGURED') {
          return NextResponse.json(
            {
              error: 'Email is not configured. Set RESEND_API_KEY (Resend).',
            },
            { status: 503 }
          )
        }
        console.error('POST /api/clinic/sms-test email', e)
        return NextResponse.json({ error: msg }, { status: 502 })
      }
      return NextResponse.json({ ok: true, channel: 'email' as const })
    }

    const to = normalizePhoneNumber(toRaw)
    if (!to.startsWith('+') || to.replace(/\D/g, '').length < 10) {
      return NextResponse.json(
        { error: 'Enter a valid phone number (e.g. +1 555 123 4567 or 10-digit US).' },
        { status: 400 }
      )
    }

    try {
      await sendTwilioSms({ to, body: text })
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'SMS failed'
      if (msg === 'TWILIO_NOT_CONFIGURED') {
        return NextResponse.json(
          {
            error:
              'Twilio SMS is not configured. Set TWILIO_ACCOUNT_SID plus either TWILIO_AUTH_TOKEN (or SUPABASE_AUTH_SMS_TWILIO_AUTH_TOKEN), or TWILIO_API_KEY_SID + TWILIO_API_KEY_SECRET. Also set TWILIO_SMS_FROM (E.164, e.g. +15551234567).',
          },
          { status: 503 }
        )
      }
      if (msg === 'TWILIO_FROM_NOT_SET') {
        return NextResponse.json(
          {
            error:
              'Twilio “From” number is not set. Add TWILIO_SMS_FROM with an E.164 number from your Twilio account (e.g. +15551234567).',
          },
          { status: 503 }
        )
      }
      console.error('POST /api/clinic/sms-test twilio', e)
      return NextResponse.json({ error: msg }, { status: 502 })
    }

    return NextResponse.json({ ok: true, channel: 'sms' as const })
  } catch (e) {
    console.error('POST /api/clinic/sms-test', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
