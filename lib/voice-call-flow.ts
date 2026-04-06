import type { VoiceCallFlowSettings } from '@/lib/types'

export function mergeVoiceCallFlow(
  existing: Partial<VoiceCallFlowSettings> | undefined | null,
  patch: Partial<VoiceCallFlowSettings> | undefined | null
): VoiceCallFlowSettings {
  return {
    ...DEFAULT_VOICE_CALL_FLOW,
    ...(existing ?? {}),
    ...(patch ?? {}),
  }
}

/** Always injected — voice-optimized email/phone verification before send. */
const CONTACT_READBACK_RULES = `After the caller gives their phone number or email for SMS, email, or a follow-up, **read it back** and get a clear yes before you call any send tool or promise delivery.

**Phone numbers:** Read back **digit by digit** (or short groups of 3–4). Ask if that is correct.

**Email — local part (before @):** Spell **letter by letter and character by character** (digits as words; say "dot", "underscore", "hyphen" for symbols). Do this **after** they have told you the address.

**Email — domain (after @):**
- **Well-known providers** — say the domain as a **short phrase**, not letter-by-letter: gmail.com, googlemail.com, yahoo.com, ymail.com, outlook.com, hotmail.com, live.com, msn.com, icloud.com, me.com, mac.com, aol.com, proton.me, protonmail.com, mail.com, gmx.com, zoho.com, fastmail.com. Example: local part spelled out, then "at gmail dot com" (not g-m-a-i-l).
- **Custom or business domains** (not in that list, or .co.uk / similar, or easy to confuse): spell the **full domain** letter-by-letter with "dot" between parts until they confirm.

Finish with one yes/no: is that all correct? Only then send.`

export const DEFAULT_VOICE_CALL_FLOW: VoiceCallFlowSettings = {
  questionStyle: 'balanced',
  questionNotes: '',
  transferStyle: 'let_caller_choose',
  transferNotes: '',
  textStyle: 'confirm_only',
  textNotes: '',
  schedulingStyle: 'collect_times',
  schedulingNotes: '',
  notificationStyle: 'standard',
  notificationNotes: '',
}

const Q_PRESET: Record<VoiceCallFlowSettings['questionStyle'], string> = {
  light:
    'Ask only what you need to route the call: name, best callback number, and a short reason for the call.',
  balanced:
    'Ask clarifying questions when unclear, but keep the call moving. Confirm spelling for names when relevant.',
  thorough:
    'Take time to understand the situation before offering transfer or callback. Summarize what you heard back to the caller.',
}

const T_PRESET: Record<VoiceCallFlowSettings['transferStyle'], string> = {
  offer_transfer: 'When appropriate, offer a live transfer to the right person or queue.',
  callback_first:
    'Prefer scheduling a clear callback window over cold transfers unless the caller insists on holding.',
  let_caller_choose:
    'When both are possible, briefly explain options and let the caller pick transfer vs scheduled callback.',
}

const TX_PRESET: Record<VoiceCallFlowSettings['textStyle'], string> = {
  confirm_only:
    'Only send texts or emails the caller clearly agrees to, not unsolicited marketing. Send **during the call** as soon as they agree and contact details are confirmed (use the live tool when it exists).',
  send_summary:
    'You may send a short SMS or email summary or link when the caller opts in — **during the call** via the live tool when available.',
  minimal: 'Avoid texting unless the caller explicitly asks for a text.',
}

const S_PRESET: Record<VoiceCallFlowSettings['schedulingStyle'], string> = {
  collect_times: 'Collect 2–3 windows that work for the caller; staff or scheduling tools finalize the slot.',
  book_specific:
    'If times are on the website or in knowledge, offer specific openings; otherwise collect availability.',
  staff_followup:
    'Do not promise a slot; capture urgency and availability and hand off to staff to schedule.',
}

const N_PRESET: Record<VoiceCallFlowSettings['notificationStyle'], string> = {
  urgent_only: 'Flag staff immediately for safety, legal deadlines, or explicit “emergency” language.',
  standard: 'Use normal urgency for missed appointments, billing disputes, and clinical discomfort.',
  quiet:
    'Bias toward routine handling; reserve escalation for clear red flags described in your knowledge or notes.',
}

/** Plain-language block injected into the managed voice prompt + dynamic context. */
export function expandVoiceCallFlowToGuidance(flow: VoiceCallFlowSettings | undefined): string {
  const f = flow ?? DEFAULT_VOICE_CALL_FLOW
  const parts = [
    '### Questions',
    Q_PRESET[f.questionStyle],
    f.questionNotes?.trim() ? `Additional notes: ${f.questionNotes.trim()}` : '',
    '',
    '### Transfers & handoffs',
    T_PRESET[f.transferStyle],
    f.transferNotes?.trim() ? `Additional notes: ${f.transferNotes.trim()}` : '',
    '',
    '### Text messages',
    TX_PRESET[f.textStyle],
    f.textNotes?.trim() ? `Additional notes: ${f.textNotes.trim()}` : '',
    '',
    '### Scheduling',
    S_PRESET[f.schedulingStyle],
    f.schedulingNotes?.trim() ? `Additional notes: ${f.schedulingNotes.trim()}` : '',
    '',
    '### Staff notifications',
    N_PRESET[f.notificationStyle],
    f.notificationNotes?.trim() ? `Additional notes: ${f.notificationNotes.trim()}` : '',
    '',
    '### Contact confirmation',
    CONTACT_READBACK_RULES,
  ]
  return parts.filter((p) => p !== '').join('\n')
}

export const QUESTION_STYLE_OPTIONS: { value: VoiceCallFlowSettings['questionStyle']; label: string }[] = [
  { value: 'light', label: 'Light — essentials only' },
  { value: 'balanced', label: 'Balanced — clarify when needed' },
  { value: 'thorough', label: 'Thorough — understand before routing' },
]

export const TRANSFER_STYLE_OPTIONS: { value: VoiceCallFlowSettings['transferStyle']; label: string }[] = [
  { value: 'offer_transfer', label: 'Offer live transfer when it fits' },
  { value: 'callback_first', label: 'Prefer scheduled callback' },
  { value: 'let_caller_choose', label: 'Offer both; caller decides' },
]

export const TEXT_STYLE_OPTIONS: { value: VoiceCallFlowSettings['textStyle']; label: string }[] = [
  { value: 'confirm_only', label: 'Confirmations only' },
  { value: 'send_summary', label: 'Optional summary / link SMS' },
  { value: 'minimal', label: 'Rarely text' },
]

export const SCHEDULING_STYLE_OPTIONS: { value: VoiceCallFlowSettings['schedulingStyle']; label: string }[] = [
  { value: 'collect_times', label: 'Collect availability windows' },
  { value: 'book_specific', label: 'Offer specific times when known' },
  { value: 'staff_followup', label: 'Staff schedules — capture intent only' },
]

export const NOTIFICATION_STYLE_OPTIONS: { value: VoiceCallFlowSettings['notificationStyle']; label: string }[] = [
  { value: 'urgent_only', label: 'Escalate urgent signals only' },
  { value: 'standard', label: 'Standard triage' },
  { value: 'quiet', label: 'Quieter — fewer escalations' },
]
