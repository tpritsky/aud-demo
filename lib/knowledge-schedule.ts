import type { KnowledgeDayKey, KnowledgeDaySchedule, VoiceKnowledgeItem } from '@/lib/types'

export const KNOWLEDGE_DAY_ORDER: KnowledgeDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

export const KNOWLEDGE_DAY_LABEL: Record<KnowledgeDayKey, string> = {
  mon: 'Monday',
  tue: 'Tuesday',
  wed: 'Wednesday',
  thu: 'Thursday',
  fri: 'Friday',
  sat: 'Saturday',
  sun: 'Sunday',
}

const DEFAULT_SLOT = { start: '00:00', end: '23:59' }

/** Full-week default: every day enabled, all day. */
export function defaultKnowledgeSchedule(): Record<KnowledgeDayKey, KnowledgeDaySchedule> {
  const row: KnowledgeDaySchedule = { enabled: true, slots: [{ ...DEFAULT_SLOT }] }
  return {
    mon: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    tue: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    wed: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    thu: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    fri: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    sat: { ...row, slots: [{ ...DEFAULT_SLOT }] },
    sun: { ...row, slots: [{ ...DEFAULT_SLOT }] },
  }
}

/** Human-readable line injected above card body for the live agent + Claude. */
export function formatKnowledgeScheduleHint(item: VoiceKnowledgeItem): string | null {
  if (!item.restrictByTime) return null
  const tz = item.knowledgeTimezone?.trim() || 'America/New_York'
  const sched = item.knowledgeSchedule
  if (!sched) {
    return `[Schedule: use only during configured hours (${tz})]`
  }
  const parts: string[] = []
  for (const day of KNOWLEDGE_DAY_ORDER) {
    const d = sched[day]
    if (!d?.enabled) continue
    const slots = d.slots?.length ? d.slots : [{ ...DEFAULT_SLOT }]
    const slotStr = slots
      .map((s) => `${formatHm(s.start)}–${formatHm(s.end)}`)
      .join(', ')
    parts.push(`${KNOWLEDGE_DAY_LABEL[day]}: ${slotStr}`)
  }
  if (!parts.length) return `[Schedule: no active days — do not use this knowledge until staff updates it] (${tz})`
  return `[Schedule — only use this knowledge during: ${parts.join('; ')} (${tz})]`
}

function formatHm(hhmm: string): string {
  const t = hhmm.trim()
  const m = /^(\d{1,2}):(\d{2})$/.exec(t)
  if (!m) return t
  let h = parseInt(m[1], 10)
  const min = m[2]
  const ap = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${min} ${ap}`
}
