'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ALLOWED_CLINIC_VERTICALS,
} from '@/lib/clinic-call-ai'
import type { ClinicCallAiSettings, ClinicVertical, VoiceKnowledgeItem } from '@/lib/types'
import {
  NOTIFICATION_STYLE_OPTIONS,
  QUESTION_STYLE_OPTIONS,
  SCHEDULING_STYLE_OPTIONS,
  TRANSFER_STYLE_OPTIONS,
  mergeVoiceCallFlow,
} from '@/lib/voice-call-flow'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { KnowledgeScheduleFields } from '@/components/settings/knowledge-schedule-fields'
import { defaultKnowledgeSchedule } from '@/lib/knowledge-schedule'
import { CirclePlus, ChevronDown, Sparkles, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const VERTICAL_LABELS: Record<ClinicVertical, string> = {
  audiology: 'Audiology / hearing',
  ortho: 'Orthopedics',
  law: 'Legal',
  general: 'General business',
  hospital: 'Hospital / health system',
  rehab: 'Rehabilitation / therapy',
}

export type ReceptionistNavKey =
  | 'business'
  | 'knowledge'
  | 'questions'
  | 'transfer'
  | 'texts'
  | 'scheduling'
  | 'notifications'
  | 'extras'

type NavKey = ReceptionistNavKey

const NAV: { key: NavKey; label: string }[] = [
  { key: 'business', label: 'Business type' },
  { key: 'knowledge', label: 'Knowledge' },
  { key: 'questions', label: 'Ask questions' },
  { key: 'transfer', label: 'Transfer calls' },
  { key: 'texts', label: 'Text & email' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'notifications', label: 'Notifications' },
  { key: 'extras', label: 'Extra notes' },
]

function sortKnowledge(items: VoiceKnowledgeItem[]): VoiceKnowledgeItem[] {
  return [...items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
}

function newKnowledgeItem(sortIndex: number): VoiceKnowledgeItem {
  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`,
    title: '',
    body: '',
    enabled: true,
    sortOrder: sortIndex,
  }
}

export interface ReceptionistCallSetupProps {
  callAi: ClinicCallAiSettings
  vertical: ClinicVertical
  onChange: (next: ClinicCallAiSettings) => void
  canChangeVertical: boolean
  onVerticalChange?: (v: ClinicVertical) => void
  /** No outer card or inner nav — parent supplies which section is visible (Agent workspace). */
  embedded?: boolean
  activeSection?: ReceptionistNavKey
  /** With embedded + knowledge: omit local title blurb so parent can show a hero header. */
  denseKnowledgeHeader?: boolean
}

export function ReceptionistCallSetup({
  callAi,
  vertical,
  onChange,
  canChangeVertical,
  onVerticalChange,
  embedded = false,
  activeSection = 'business',
  denseKnowledgeHeader = false,
}: ReceptionistCallSetupProps) {
  const [nav, setNav] = useState<NavKey>('business')
  const currentNav: NavKey = embedded ? activeSection : nav
  const [editItem, setEditItem] = useState<VoiceKnowledgeItem | null>(null)
  const [editIsNew, setEditIsNew] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  useEffect(() => {
    if (!editItem) {
      setAdvancedOpen(false)
      return
    }
    setAdvancedOpen(editItem.restrictByTime === true)
  }, [editItem?.id])

  const flow = useMemo(() => mergeVoiceCallFlow(undefined, callAi.callFlow), [callAi.callFlow])

  const setFlow = (patch: Partial<ClinicCallAiSettings['callFlow']>) => {
    onChange({
      ...callAi,
      callFlow: mergeVoiceCallFlow(callAi.callFlow, patch),
    })
  }

  const items = sortKnowledge(callAi.knowledgeItems || [])

  const saveEdit = () => {
    if (!editItem) return
    const title = editItem.title.trim()
    const body = editItem.body.trim()
    if (!title || !body) return
    let list = [...(callAi.knowledgeItems || [])]
    if (editIsNew) {
      list.push({
        ...editItem,
        title,
        body,
        sortOrder: list.length,
        enabled: true,
      })
    } else {
      list = list.map((x) => (x.id === editItem.id ? { ...editItem, title, body } : x))
    }
    onChange({ ...callAi, knowledgeItems: list })
    setEditItem(null)
  }

  const preview = (body: string) => {
    const t = body.replace(/\s+/g, ' ').trim()
    return t.length > 180 ? `${t.slice(0, 180)}…` : t
  }

  const panel = (
    <div className="min-w-0 flex-1 p-4 sm:p-5">
          {currentNav === 'business' && (
            <div className="space-y-4 max-w-lg">
              <div>
                <h3 className="text-lg font-semibold tracking-tight">Business type</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  Sets industry defaults for tone and what matters on the line. You can still customize everything else.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Type of business</Label>
                <Select
                  value={vertical}
                  onValueChange={(v) => onVerticalChange?.(v as ClinicVertical)}
                  disabled={!canChangeVertical}
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ALLOWED_CLINIC_VERTICALS.map((v) => (
                      <SelectItem key={v} value={v}>
                        {VERTICAL_LABELS[v]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!canChangeVertical ? (
                  <p className="text-xs text-muted-foreground">Only administrators can change this.</p>
                ) : null}
              </div>
            </div>
          )}

          {currentNav === 'knowledge' && (
            <div className="space-y-4">
              {!(embedded && denseKnowledgeHeader) ? (
                <div>
                  <h3 className="text-lg font-semibold tracking-tight">Knowledge</h3>
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                    Facts and instructions the receptionist can rely on — hours, services, locations, policies, FAQs.
                    Toggle off anything you don&apos;t want used on calls.
                  </p>
                </div>
              ) : null}

              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setEditIsNew(true)
                  setEditItem(newKnowledgeItem(items.length))
                }}
              >
                <CirclePlus className="h-4 w-4" />
                Add knowledge
              </Button>

              <ul className="space-y-2">
                {items.length === 0 ? (
                  <li className="text-sm text-muted-foreground border border-dashed border-border rounded-lg p-6 text-center bg-card">
                    No knowledge cards yet. Add them below, repopulate from a website above, or use{' '}
                    <strong>Analyze &amp; prefill</strong> when your business is first set up — cards will appear here
                    automatically.
                  </li>
                ) : null}
                {items.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                  >
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        setEditIsNew(false)
                        setEditItem({ ...row })
                      }}
                    >
                      <span className="font-semibold text-[15px] leading-snug text-foreground underline-offset-2 hover:underline block truncate">
                        {row.title || 'Untitled'}
                      </span>
                      <span className="text-sm text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                        {preview(row.body)}
                      </span>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={row.enabled !== false}
                        onCheckedChange={(c) =>
                          onChange({
                            ...callAi,
                            knowledgeItems: (callAi.knowledgeItems || []).map((x) =>
                              x.id === row.id ? { ...x, enabled: c } : x
                            ),
                          })
                        }
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() =>
                          onChange({
                            ...callAi,
                            knowledgeItems: (callAi.knowledgeItems || []).filter((x) => x.id !== row.id),
                          })
                        }
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {currentNav === 'questions' && (
            <FlowSection
              title="Ask questions"
              description="How curious the receptionist should be before routing or scheduling."
              select={
                <Select
                  value={flow.questionStyle}
                  onValueChange={(v) =>
                    setFlow({ questionStyle: v as ClinicCallAiSettings['callFlow']['questionStyle'] })
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUESTION_STYLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              notesLabel="Your notes (optional)"
              notes={flow.questionNotes}
              onNotes={(questionNotes) => setFlow({ questionNotes })}
            />
          )}

          {currentNav === 'transfer' && (
            <FlowSection
              title="Transfer calls"
              description="Whether to push live transfers, callbacks, or both."
              select={
                <Select
                  value={flow.transferStyle}
                  onValueChange={(v) =>
                    setFlow({ transferStyle: v as ClinicCallAiSettings['callFlow']['transferStyle'] })
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_STYLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              notesLabel="Transfer details (optional)"
              notes={flow.transferNotes}
              onNotes={(transferNotes) => setFlow({ transferNotes })}
              hint="Mention departments, extensions, or when not to transfer."
            />
          )}

          {currentNav === 'scheduling' && (
            <FlowSection
              title="Scheduling"
              description="How aggressively to nail down a time vs. collecting availability."
              select={
                <Select
                  value={flow.schedulingStyle}
                  onValueChange={(v) =>
                    setFlow({ schedulingStyle: v as ClinicCallAiSettings['callFlow']['schedulingStyle'] })
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEDULING_STYLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              notesLabel="Scheduling details (optional)"
              notes={flow.schedulingNotes}
              onNotes={(schedulingNotes) => setFlow({ schedulingNotes })}
            />
          )}

          {currentNav === 'notifications' && (
            <FlowSection
              title="Notifications"
              description="How sharply to escalate to staff for urgent or sensitive topics."
              select={
                <Select
                  value={flow.notificationStyle}
                  onValueChange={(v) =>
                    setFlow({
                      notificationStyle: v as ClinicCallAiSettings['callFlow']['notificationStyle'],
                    })
                  }
                >
                  <SelectTrigger className="max-w-md">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {NOTIFICATION_STYLE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              }
              notesLabel="What counts as urgent here (optional)"
              notes={flow.notificationNotes}
              onNotes={(notificationNotes) => setFlow({ notificationNotes })}
            />
          )}

          {currentNav === 'extras' && (
            <div className="space-y-6 max-w-2xl">
              <div>
                <h3 className="text-base font-medium">Extra notes</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Optional free-form additions layered on top of the presets above. Most teams only need a line or two
                  per field.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Inbound — extra guidance</Label>
                <Textarea
                  rows={4}
                  placeholder="Anything specific to how incoming calls should open or close…"
                  value={callAi.inboundPlaybook}
                  onChange={(e) => onChange({ ...callAi, inboundPlaybook: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Outbound / callbacks — extra guidance</Label>
                <Textarea
                  rows={4}
                  placeholder="How staff-initiated or returned calls should sound…"
                  value={callAi.outboundPlaybook}
                  onChange={(e) => onChange({ ...callAi, outboundPlaybook: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ending calls</Label>
                <Textarea
                  rows={3}
                  placeholder="When to wrap up politely, what to confirm first…"
                  value={callAi.hangupGuidance}
                  onChange={(e) => onChange({ ...callAi, hangupGuidance: e.target.value })}
                />
              </div>
            </div>
          )}
    </div>
  )

  const dialog = (
      <Dialog
        open={!!editItem}
        onOpenChange={(o) => {
          if (!o) {
            setEditItem(null)
            setAdvancedOpen(false)
          }
        }}
      >
        <DialogContent className="flex max-h-[min(90vh,880px)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editIsNew ? 'Add knowledge' : 'Edit knowledge'}</DialogTitle>
          </DialogHeader>
          {editItem ? (
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-2 pr-1">
              <div className="space-y-2">
                <Label>
                  Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={editItem.title}
                  onChange={(e) => setEditItem({ ...editItem, title: e.target.value })}
                  placeholder="e.g. Office hours, Practice areas"
                />
                <p className="text-xs text-muted-foreground">
                  Name this so you can find it later (e.g. &quot;Holiday hours&quot; or &quot;Pricing&quot;).
                </p>
              </div>
              <div className="space-y-2">
                <Label>
                  Content <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  rows={8}
                  value={editItem.body}
                  onChange={(e) => setEditItem({ ...editItem, body: e.target.value })}
                  placeholder="Plain text or simple bullets. What callers should know."
                  className="font-mono text-sm"
                />
              </div>

              <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen} className="rounded-lg border border-border">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-muted/50"
                  >
                    <span>Advanced</span>
                    <ChevronDown
                      className={cn('h-4 w-4 shrink-0 transition-transform', advancedOpen ? 'rotate-180' : '')}
                    />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="border-t border-border px-3 pb-3 pt-1">
                  <div className="space-y-3 pt-2">
                    <label className="flex cursor-pointer items-start gap-3">
                      <Checkbox
                        checked={editItem.restrictByTime === true}
                        onCheckedChange={(c) => {
                          const on = c === true
                          if (!on) {
                            setEditItem({
                              ...editItem,
                              restrictByTime: false,
                              knowledgeTimezone: undefined,
                              knowledgeSchedule: undefined,
                            })
                            return
                          }
                          setAdvancedOpen(true)
                          setEditItem({
                            ...editItem,
                            restrictByTime: true,
                            knowledgeTimezone: editItem.knowledgeTimezone?.trim() || 'America/New_York',
                            knowledgeSchedule: editItem.knowledgeSchedule || defaultKnowledgeSchedule(),
                          })
                        }}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-sm font-semibold leading-snug">Restrict knowledge by time</span>
                        <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                          Set when this knowledge should be used by the agent.
                        </span>
                      </span>
                    </label>
                    {editItem.restrictByTime ? (
                      <KnowledgeScheduleFields item={editItem} onChange={setEditItem} />
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </div>
          ) : null}
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={() => setEditItem(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveEdit} disabled={!editItem?.title.trim() || !editItem?.body.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  )

  if (embedded) {
    return (
      <>
        {panel}
        {dialog}
      </>
    )
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold tracking-tight">Phone receptionist</h2>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          — What callers hear and how the line behaves
        </span>
      </div>

      <div className="flex flex-col lg:flex-row min-h-[420px]">
        <nav
          className="flex lg:flex-col gap-0.5 p-2 lg:p-2.5 lg:w-[13.5rem] shrink-0 border-b lg:border-b-0 lg:border-r bg-zinc-50/90 dark:bg-zinc-900/25 overflow-x-auto lg:overflow-y-auto"
          aria-label="Receptionist sections"
        >
          {NAV.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setNav(item.key)}
              className={`whitespace-nowrap text-left rounded-lg px-3 py-2.5 text-[15px] leading-tight transition-colors lg:w-full ${
                nav === item.key
                  ? 'bg-card font-semibold text-foreground shadow-sm border border-border/80'
                  : 'font-medium text-muted-foreground hover:text-foreground hover:bg-zinc-100/90 dark:hover:bg-zinc-800/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {panel}
      </div>

      {dialog}
    </div>
  )
}

function FlowSection(props: {
  title: string
  description: string
  select: ReactNode
  notesLabel: string
  notes: string
  onNotes: (v: string) => void
  hint?: string
}) {
  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">{props.title}</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{props.description}</p>
      </div>
      <div className="space-y-2">{props.select}</div>
      {props.hint ? <p className="text-xs text-muted-foreground">{props.hint}</p> : null}
      <div className="space-y-2">
        <Label>{props.notesLabel}</Label>
        <Textarea
          rows={4}
          value={props.notes}
          onChange={(e) => props.onNotes(e.target.value)}
          placeholder="Override or add specifics for your business…"
        />
      </div>
    </div>
  )
}
