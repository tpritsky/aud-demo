import { sendTestEmail } from '@/lib/email/send-test-email'
import { normalizePhoneNumber } from '@/lib/phone-format'
import type { VoiceTextMessageTemplate, VoiceTextDeliveryChannels } from '@/lib/types'
import type { FollowUpMessageIntent } from '@/lib/ai/call-post-process'
import { sendTwilioSms } from '@/lib/server/twilio-sms'
import type { SupabaseClient } from '@supabase/supabase-js'

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

export type LiveFollowUpToolParams = {
  template_id: string
  caller_confirmed: boolean
  send_sms?: boolean
  send_email?: boolean
  destination_email?: string
  caller_phone_e164?: string
}

/**
 * Send one follow-up during a live ConvAI call (webhook tool). Records a row so post-call delivery skips duplicates.
 */
export async function deliverFollowUpFromLiveTool(opts: {
  supabase: SupabaseClient
  conversationId: string
  clinicName?: string
  templates: VoiceTextMessageTemplate[]
  params: LiveFollowUpToolParams
}): Promise<{ ok: true; result: string } | { ok: false; result: string }> {
  const { supabase, conversationId, clinicName, templates, params } = opts
  if (!params.caller_confirmed) {
    return { ok: false, result: 'Not sent: caller_confirmed must be true.' }
  }
  const tpl = templates.find((t) => t.id === params.template_id)
  if (!tpl || tpl.enabled === false) {
    return { ok: false, result: 'Not sent: unknown or disabled template_id.' }
  }

  const delivery = effectiveDelivery(tpl)
  let wantSms = params.send_sms === true && (delivery === 'sms' || delivery === 'both')
  let wantEmail = params.send_email === true && (delivery === 'email' || delivery === 'both')
  if (delivery === 'sms') wantEmail = false
  if (delivery === 'email') wantSms = false

  if (!wantSms && !wantEmail) {
    return {
      ok: false,
      result:
        'Not sent: choose send_sms and/or send_email consistent with this template’s delivery channels.',
    }
  }

  const body = tpl.message.trim().slice(0, 1600)
  const sent: string[] = []

  if (wantSms) {
    const raw = params.caller_phone_e164?.trim() ?? ''
    const e164 = raw ? normalizePhoneNumber(raw) : ''
    if (!e164.startsWith('+') || e164.replace(/\D/g, '').length < 10) {
      return { ok: false, result: 'Not sent: need a valid E.164 caller_phone_e164 for SMS.' }
    }
    try {
      await sendTwilioSms({ to: e164, body })
      sent.push('SMS')
    } catch (e) {
      console.error('[deliverFollowUp live] SMS failed', tpl.id, e)
      return { ok: false, result: 'SMS send failed; try again or send after the call.' }
    }
  }

  if (wantEmail) {
    if (!process.env.RESEND_API_KEY?.trim()) {
      return {
        ok: false,
        result:
          'Email is not configured: set RESEND_API_KEY on the server (same as Settings → test message).',
      }
    }
    const email = params.destination_email?.trim().toLowerCase() ?? ''
    if (!email || !EMAIL_RE.test(email)) {
      return { ok: false, result: 'Not sent: need a valid destination_email for email delivery.' }
    }
    const subjectBase = tpl.label.trim() || 'Message from your call'
    const subject = `${clinicName?.trim() ? `${clinicName.trim()} — ` : ''}${subjectBase}`.slice(0, 200)
    try {
      await sendTestEmail({
        to: email,
        subject,
        body: tpl.message.trim().slice(0, 8000),
      })
      sent.push('email')
    } catch (e) {
      console.error('[deliverFollowUp live] email failed', tpl.id, e)
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes('RESEND_NOT_CONFIGURED')) {
        return {
          ok: false,
          result:
            'Email provider (Resend) is not configured. An admin must set RESEND_API_KEY — same as the dashboard test message.',
        }
      }
      const short = msg.replace(/\s+/g, ' ').trim().slice(0, 200)
      return {
        ok: false,
        result: short
          ? `Email failed (${short}). Apologize briefly. Staff: check Resend dashboard, RESEND_API_KEY, and RESEND_FROM_EMAIL on a verified domain.`
          : 'Email send failed; try again or send after the call.',
      }
    }
  }

  const { error: dedupeErr } = await supabase.from('convai_live_follow_up_sends').upsert(
    { conversation_id: conversationId, template_id: tpl.id },
    { onConflict: 'conversation_id,template_id' }
  )
  if (dedupeErr) {
    console.warn('[deliverFollowUp live] dedupe insert:', dedupeErr.message)
  }

  return {
    ok: true,
    result: `Sent ${sent.join(' and ')} for “${tpl.label.trim()}”.`,
  }
}
