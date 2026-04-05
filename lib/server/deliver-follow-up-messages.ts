import { sendTestEmail } from '@/lib/email/send-test-email'
import { normalizePhoneNumber } from '@/lib/phone-format'
import type { VoiceTextMessageTemplate, VoiceTextDeliveryChannels } from '@/lib/types'
import type { FollowUpMessageIntent } from '@/lib/ai/call-post-process'
import { sendTwilioSms } from '@/lib/server/twilio-sms'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function effectiveDelivery(t: VoiceTextMessageTemplate): VoiceTextDeliveryChannels {
  return t.deliveryChannels ?? 'sms'
}

function resolveCallerE164(callerPhoneFromResult: string | null, callRowPhone: string | null): string | null {
  for (const raw of [callerPhoneFromResult, callRowPhone]) {
    if (!raw?.trim()) continue
    const n = normalizePhoneNumber(raw)
    if (n.startsWith('+') && n.replace(/\D/g, '').length >= 10) return n
  }
  return null
}

/**
 * After post-call analysis, send SMS and/or email for templates the model marked as consented.
 * Failures are logged; callers are not blocked.
 */
export async function deliverFollowUpMessagesAfterCall(opts: {
  templates: VoiceTextMessageTemplate[]
  intents: FollowUpMessageIntent[]
  callerPhoneFromResult: string | null
  callRowPhone: string | null
  clinicName?: string
}): Promise<void> {
  const byId = new Map(opts.templates.map((t) => [t.id, t]))
  const e164 = resolveCallerE164(opts.callerPhoneFromResult, opts.callRowPhone)

  for (const intent of opts.intents.slice(0, 5)) {
    if (!intent.caller_confirmed) continue
    const tpl = byId.get(intent.template_id)
    if (!tpl || tpl.enabled === false) continue

    const delivery = effectiveDelivery(tpl)
    let wantSms = intent.send_sms && (delivery === 'sms' || delivery === 'both')
    let wantEmail = intent.send_email && (delivery === 'email' || delivery === 'both')
    if (delivery === 'sms') wantEmail = false
    if (delivery === 'email') wantSms = false

    const body = tpl.message.trim().slice(0, 1600)

    if (wantSms) {
      if (!e164) {
        console.warn('[deliverFollowUp] skip SMS (no valid phone)', tpl.id)
        continue
      }
      try {
        await sendTwilioSms({ to: e164, body })
      } catch (e) {
        console.error('[deliverFollowUp] SMS failed', tpl.id, e)
      }
    }

    if (wantEmail) {
      const email = intent.destination_email?.trim().toLowerCase() ?? ''
      if (!email || !EMAIL_RE.test(email)) {
        console.warn('[deliverFollowUp] skip email (no valid address)', tpl.id)
        continue
      }
      const subjectBase = tpl.label.trim() || 'Message from your call'
      const subject = `${opts.clinicName?.trim() ? `${opts.clinicName.trim()} — ` : ''}${subjectBase}`.slice(0, 200)
      try {
        await sendTestEmail({
          to: email,
          subject,
          body: tpl.message.trim().slice(0, 8000),
        })
      } catch (e) {
        console.error('[deliverFollowUp] email failed', tpl.id, e)
      }
    }
  }
}
