'use client'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { KnowledgeDayKey, KnowledgeDaySchedule, VoiceKnowledgeItem } from '@/lib/types'
import {
  KNOWLEDGE_DAY_LABEL,
  KNOWLEDGE_DAY_ORDER,
  defaultKnowledgeSchedule,
} from '@/lib/knowledge-schedule'
import { COMMON_TIMEZONES } from '@/lib/timezone-options'
import { Plus, Trash2 } from 'lucide-react'

type Props = {
  item: VoiceKnowledgeItem
  onChange: (next: VoiceKnowledgeItem) => void
}

function ensureSchedule(item: VoiceKnowledgeItem): Record<KnowledgeDayKey, KnowledgeDaySchedule> {
  const base = defaultKnowledgeSchedule()
  if (!item.knowledgeSchedule) return base
  for (const k of KNOWLEDGE_DAY_ORDER) {
    const row = item.knowledgeSchedule[k]
    if (row) {
      base[k] = {
        enabled: row.enabled,
        slots:
          row.slots?.length && row.slots.every((s) => s.start && s.end)
            ? row.slots.map((s) => ({ start: s.start, end: s.end }))
            : [{ start: '00:00', end: '23:59' }],
      }
    }
  }
  return base
}

export function KnowledgeScheduleFields({ item, onChange }: Props) {
  const tz = item.knowledgeTimezone?.trim() || 'America/New_York'
  const sched = ensureSchedule(item)

  const patchSchedule = (next: Record<KnowledgeDayKey, KnowledgeDaySchedule>) => {
    onChange({ ...item, knowledgeSchedule: next })
  }

  const setDay = (day: KnowledgeDayKey, row: KnowledgeDaySchedule) => {
    patchSchedule({ ...sched, [day]: row })
  }

  const setSlot = (day: KnowledgeDayKey, index: number, field: 'start' | 'end', value: string) => {
    const row = sched[day]
    const slots = [...(row.slots || [])]
    if (!slots[index]) return
    slots[index] = { ...slots[index], [field]: value }
    setDay(day, { ...row, slots })
  }

  const addSlot = (day: KnowledgeDayKey) => {
    const row = sched[day]
    const slots = [...(row.slots || []), { start: '09:00', end: '17:00' }]
    setDay(day, { ...row, slots })
  }

  const removeSlot = (day: KnowledgeDayKey, index: number) => {
    const row = sched[day]
    const slots = (row.slots || []).filter((_, i) => i !== index)
    setDay(day, { ...row, slots: slots.length ? slots : [{ start: '00:00', end: '23:59' }] })
  }

  const tzOptions = Array.from(new Set([...(COMMON_TIMEZONES.includes(tz) ? [] : [tz]), ...COMMON_TIMEZONES]))

  return (
    <div className="space-y-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Label htmlFor="knowledge-tz" className="text-sm font-semibold">
            Timezone
          </Label>
          <span className="text-xs text-muted-foreground">Change when this knowledge applies</span>
        </div>
        <Select value={tz} onValueChange={(v) => onChange({ ...item, knowledgeTimezone: v })}>
          <SelectTrigger id="knowledge-tz" className="w-full max-w-md">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-h-72">
            {tzOptions.map((z) => (
              <SelectItem key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        {KNOWLEDGE_DAY_ORDER.map((day) => {
          const row = sched[day]
          return (
            <div
              key={day}
              className="flex flex-col gap-2 rounded-md border border-border/80 bg-card p-3 sm:flex-row sm:flex-wrap sm:items-center"
            >
              <div className="flex min-w-[8rem] items-center gap-2">
                <Switch
                  checked={row.enabled}
                  onCheckedChange={(c) => setDay(day, { ...row, enabled: c })}
                />
                <span className="text-sm font-semibold text-foreground">{KNOWLEDGE_DAY_LABEL[day]}</span>
              </div>
              {row.enabled ? (
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  {(row.slots || [{ start: '00:00', end: '23:59' }]).map((slot, si) => (
                    <div key={si} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) => setSlot(day, si, 'start', e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      <span className="text-xs font-medium text-muted-foreground">to</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) => setSlot(day, si, 'end', e.target.value)}
                        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                      />
                      {(row.slots?.length || 0) > 1 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-9 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeSlot(day, si)}
                          aria-label="Remove time range"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      ) : null}
                    </div>
                  ))}
                  <div className="flex justify-end sm:justify-start">
                    <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => addSlot(day)}>
                      <Plus className="h-4 w-4" />
                      Add range
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}
