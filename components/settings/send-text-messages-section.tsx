'use client'

import { useMemo, useState } from 'react'
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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import type {
  ClinicCallAiSettings,
  VoiceTextDeliveryChannels,
  VoiceTextMessageKind,
  VoiceTextMessageTemplate,
} from '@/lib/types'
import { TEXT_STYLE_OPTIONS } from '@/lib/voice-call-flow'
import {
  ChevronDown,
  Calendar,
  Loader2,
  Mail,
  MessageSquare,
  Plus,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase/client'

type Draft = {
  kind: VoiceTextMessageKind
  deliveryChannels: VoiceTextDeliveryChannels
  label: string
  message: string
  instructions: string
}

function newTemplateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `txt-${Date.now()}`
}

function previewLine(body: string, max = 140): string {
  const t = body.replace(/\s+/g, ' ').trim()
  return t.length > max ? `${t.slice(0, max)}…` : t
}

const emptyDraft = (kind: VoiceTextMessageKind): Draft =>
  kind === 'scheduling_link'
    ? {
        kind: 'scheduling_link',
        deliveryChannels: 'sms',
        label: 'Scheduling link',
        message: 'To schedule your appointment visit [add your scheduling link here]',
        instructions: 'Send this message if a caller is interested in scheduling an appointment',
      }
    : {
        kind: 'sms',
        deliveryChannels: 'sms',
        label: '',
        message: '',
        instructions: '',
      }

export function SendTextMessagesSection({
  callAi,
  onChange,
  onTemplatesCommit,
}: {
  callAi: ClinicCallAiSettings
  onChange: (next: ClinicCallAiSettings) => void
  /**
   * Persist templates to the server. Return true when the PATCH succeeded.
   */
  onTemplatesCommit?: (next: ClinicCallAiSettings) => boolean | Promise<boolean>
}) {
  const flow = callAi.callFlow
  const templates = callAi.textMessageTemplates ?? []
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const [testSmsOpen, setTestSmsOpen] = useState(false)
  const [testChannel, setTestChannel] = useState<'sms' | 'email'>('sms')
  const [testTo, setTestTo] = useState('')
  const [testSubject, setTestSubject] = useState('Test message')
  const [testBody, setTestBody] = useState('')
  const [testSending, setTestSending] = useState(false)

  const [dialogMode, setDialogMode] = useState<'closed' | 'add' | 'edit'>('closed')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(emptyDraft('sms'))
  const [templatePersisting, setTemplatePersisting] = useState(false)

  const applyTemplates = async (next: VoiceTextMessageTemplate[]): Promise<boolean> => {
    const updated = { ...callAi, textMessageTemplates: next }
    onChange(updated)
    if (!onTemplatesCommit) return true
    return onTemplatesCommit(updated)
  }

  const setFlow = (patch: Partial<ClinicCallAiSettings['callFlow']>) => {
    onChange({
      ...callAi,
      callFlow: { ...callAi.callFlow, ...patch },
    })
  }

  const openAdd = (kind: VoiceTextMessageKind) => {
    setEditingId(null)
    setDraft(emptyDraft(kind))
    setDialogMode('add')
  }

  const openEdit = (t: VoiceTextMessageTemplate) => {
    setEditingId(t.id)
    setDraft({
      kind: t.kind,
      deliveryChannels: t.deliveryChannels ?? 'sms',
      label: t.label,
      message: t.message,
      instructions: t.instructions,
    })
    setDialogMode('edit')
  }

  const closeDialog = () => {
    setDialogMode('closed')
    setEditingId(null)
  }

  const canSave = useMemo(() => {
    return (
      draft.label.trim().length > 0 &&
      draft.message.trim().length > 0 &&
      draft.instructions.trim().length > 0
    )
  }, [draft])

  const saveDraft = async () => {
    if (!canSave) return
    const base: VoiceTextMessageTemplate = {
      id: editingId ?? newTemplateId(),
      kind: draft.kind,
      label: draft.label.trim(),
      message: draft.message.trim(),
      instructions: draft.instructions.trim(),
      enabled: true,
      deliveryChannels: draft.deliveryChannels,
    }
    const nextList =
      dialogMode === 'edit' && editingId
        ? (() => {
            const prev = templates.find((x) => x.id === editingId)
            return templates.map((x) =>
              x.id === editingId ? { ...base, enabled: prev?.enabled ?? true } : x
            )
          })()
        : [...templates, { ...base, enabled: true }]
    setTemplatePersisting(true)
    try {
      const ok = await applyTemplates(nextList)
      if (ok) closeDialog()
    } finally {
      setTemplatePersisting(false)
    }
  }

  const toggleEnabled = (id: string, enabled: boolean) => {
    void applyTemplates(templates.map((t) => (t.id === id ? { ...t, enabled } : t)))
  }

  const remove = (id: string) => {
    void applyTemplates(templates.filter((t) => t.id !== id))
  }

  const isSchedulingUI = dialogMode !== 'closed' && draft.kind === 'scheduling_link'

  const sendTestMessage = async () => {
    const trimmedTo = testTo.trim()
    const trimmedBody = testBody.trim()
    if (!trimmedTo || !trimmedBody) {
      toast.error(testChannel === 'email' ? 'Enter an email and message' : 'Enter a phone number and message')
      return
    }
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      toast.error('Sign in required')
      return
    }
    setTestSending(true)
    try {
      const payload =
        testChannel === 'email'
          ? {
              channel: 'email' as const,
              to: trimmedTo,
              body: trimmedBody,
              subject: testSubject.trim() || 'Test message',
            }
          : { channel: 'sms' as const, to: trimmedTo, body: trimmedBody }

      const res = await fetch('/api/clinic/sms-test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        toast.error(data.error || (testChannel === 'email' ? 'Failed to send email' : 'Failed to send SMS'))
        return
      }
      if (testChannel === 'email') {
        toast.success('Email sent', {
          description: 'Check the inbox (and spam folder).',
          duration: 6000,
        })
      } else {
        toast.success('Twilio accepted the message', {
          description:
            'Delivery can take a few seconds. If nothing arrives: use E.164 (+country…). Trial accounts only reach verified numbers—check Twilio Console → Monitor → Logs.',
          duration: 8000,
        })
      }
      setTestSmsOpen(false)
    } catch {
      toast.error('Network error')
    } finally {
      setTestSending(false)
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border px-4 py-3 sm:px-5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2.5 text-left font-semibold text-foreground hover:opacity-90"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-foreground text-background">
                  <Plus className="h-4 w-4" strokeWidth={2.5} />
                </span>
                Add message
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[min(100vw-2rem,16rem)] rounded-xl p-1.5 shadow-lg">
              <DropdownMenuItem
                className="gap-2 rounded-lg cursor-pointer border border-transparent data-[highlighted]:border-blue-300/80 data-[highlighted]:bg-blue-50 dark:data-[highlighted]:bg-blue-950/40"
                onSelect={() => openAdd('sms')}
              >
                <MessageSquare className="h-4 w-4 shrink-0" />
                Custom message
              </DropdownMenuItem>
              <DropdownMenuItem className="gap-2 rounded-lg cursor-pointer" onSelect={() => openAdd('scheduling_link')}>
                <Calendar className="h-4 w-4 shrink-0" />
                Send scheduling link
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="divide-y divide-border">
          {templates.length === 0 ? (
            <p className="px-4 py-8 sm:px-5 text-sm text-muted-foreground text-center">
              No messages yet. Use <span className="font-medium text-foreground">Add message</span> to create texts or
              emails your receptionist can send after the call.
            </p>
          ) : (
            templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4"
              >
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-400 text-amber-950 shadow-sm"
                  aria-hidden
                >
                  <MessageSquare className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(t)}
                      className="text-left font-semibold underline decoration-foreground/30 underline-offset-2 hover:decoration-foreground/60"
                    >
                      {t.label || 'Untitled'}
                    </button>
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                      {(t.deliveryChannels ?? 'sms') === 'email' ? (
                        <Mail className="h-3 w-3" aria-hidden />
                      ) : (t.deliveryChannels ?? 'sms') === 'both' ? (
                        <>
                          <Smartphone className="h-3 w-3" aria-hidden />
                          <Mail className="h-3 w-3" aria-hidden />
                        </>
                      ) : (
                        <Smartphone className="h-3 w-3" aria-hidden />
                      )}
                      <span className="sr-only">Delivery: </span>
                      {(t.deliveryChannels ?? 'sms') === 'email'
                        ? 'Email'
                        : (t.deliveryChannels ?? 'sms') === 'both'
                          ? 'SMS & email'
                          : 'SMS'}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">{previewLine(t.message)}</p>
                </div>
                <Switch
                  checked={t.enabled !== false}
                  onCheckedChange={(c) => toggleEnabled(t.id, c === true)}
                  className="shrink-0 data-[state=checked]:bg-emerald-600"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => remove(t.id)}
                  aria-label={`Delete ${t.label || 'message'}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden border-l-4 border-l-emerald-500">
        <div className="px-4 py-4 sm:px-5 sm:py-5 flex flex-col sm:flex-row sm:items-center gap-4">
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm"
            aria-hidden
          >
            <MessageSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="font-semibold text-foreground">Send a test message</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Try SMS or email—useful while delivery settings or carrier registration are still pending.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 border-emerald-600/50 text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/50"
            onClick={() => setTestSmsOpen(true)}
          >
            Send message
          </Button>
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full max-w-2xl items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold hover:bg-muted/50"
          >
            <span>Default SMS behavior</span>
            <ChevronDown className={cn('h-4 w-4 transition-transform', advancedOpen ? 'rotate-180' : '')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-4 space-y-4 max-w-2xl">
          <p className="text-sm text-muted-foreground">
            Baseline rules for when the line may offer or send SMS (in addition to the templates above).
          </p>
          <div className="space-y-2">
            <Label>Style</Label>
            <Select
              value={flow.textStyle}
              onValueChange={(v) =>
                setFlow({ textStyle: v as ClinicCallAiSettings['callFlow']['textStyle'] })
              }
            >
              <SelectTrigger className="max-w-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TEXT_STYLE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Texting rules (optional)</Label>
            <Textarea
              rows={4}
              value={flow.textNotes}
              onChange={(e) => setFlow({ textNotes: e.target.value })}
              placeholder="Override or add specifics for your business…"
            />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={dialogMode !== 'closed'} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="sm:max-w-lg max-h-[min(90vh,720px)] flex flex-col gap-0 p-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-2 space-y-2 shrink-0">
            <DialogTitle className="text-lg font-bold leading-snug pr-8">
              {isSchedulingUI
                ? dialogMode === 'edit'
                  ? 'Edit scheduling link message'
                  : 'Add a scheduling link to send to callers.'
                : dialogMode === 'edit'
                  ? 'Edit message'
                  : 'Add a message for callers.'}
            </DialogTitle>
            {isSchedulingUI && dialogMode === 'add' ? (
              <p className="text-sm text-muted-foreground font-normal">
                When someone wants to schedule, your receptionist can send them your link by SMS or email (per your
                delivery setting below).
              </p>
            ) : null}
          </DialogHeader>
          <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1 min-h-0">
            <div className="space-y-2">
              <Label>Deliver via</Label>
              <Select
                value={draft.deliveryChannels}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, deliveryChannels: v as VoiceTextDeliveryChannels }))
                }
              >
                <SelectTrigger className="max-w-md">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sms">SMS only</SelectItem>
                  <SelectItem value="email">Email only</SelectItem>
                  <SelectItem value="both">SMS and email</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                After the call, we send only the channels the caller agreed to and we have contact info for.
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Information to send <span className="text-destructive">*</span>
              </Label>
              <Input
                value={draft.label}
                onChange={(e) => setDraft((d) => ({ ...d, label: e.target.value }))}
                placeholder="e.g. Pricing info"
              />
              <p className="text-xs text-muted-foreground">Simple name that describes what you&apos;re sharing</p>
            </div>
            <div className="space-y-2">
              <Label>
                {isSchedulingUI ? (
                  <>
                    Message with scheduling URL <span className="text-destructive">*</span>
                  </>
                ) : (
                  <>
                    Message <span className="text-destructive">*</span>
                  </>
                )}
              </Label>
              <Textarea
                rows={isSchedulingUI ? 4 : 5}
                value={draft.message}
                onChange={(e) => setDraft((d) => ({ ...d, message: e.target.value }))}
                placeholder={
                  isSchedulingUI
                    ? 'To schedule your appointment visit [add your scheduling link here]'
                    : 'You can view our full list of prices here: www.example.com/pricing'
                }
                className="resize-y min-h-[100px]"
              />
              {!isSchedulingUI ? (
                <p className="text-xs text-muted-foreground">
                  This is the body sent by SMS and/or plain-text email, depending on delivery.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>
                Additional instructions <span className="text-destructive">*</span>
              </Label>
              <Textarea
                rows={4}
                value={draft.instructions}
                onChange={(e) => setDraft((d) => ({ ...d, instructions: e.target.value }))}
                placeholder={
                  isSchedulingUI
                    ? 'e.g. Send this message if a caller is interested in scheduling an appointment'
                    : 'e.g. Send this message if the caller asks for pricing information'
                }
                className="resize-y min-h-[88px]"
              />
              <p className="text-xs text-muted-foreground">
                {isSchedulingUI
                  ? 'Give your agent context about when to send this message to callers.'
                  : 'Give your agent additional instructions on when the message should be sent.'}
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t border-border gap-2 sm:gap-2 shrink-0 bg-muted/20">
            <Button type="button" variant="secondary" onClick={closeDialog}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void saveDraft()}
              disabled={!canSave || templatePersisting}
              className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
            >
              {templatePersisting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : dialogMode === 'edit' ? (
                'Save changes'
              ) : (
                'Add message'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={testSmsOpen} onOpenChange={setTestSmsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send a test message</DialogTitle>
            <DialogDescription>
              Administrators can send a one-off test to the address or number you enter.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="flex rounded-lg border border-border p-1 bg-muted/40 gap-1">
              <button
                type="button"
                onClick={() => setTestChannel('sms')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  testChannel === 'sms'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Smartphone className="h-4 w-4 shrink-0" />
                SMS
              </button>
              <button
                type="button"
                onClick={() => setTestChannel('email')}
                className={cn(
                  'flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  testChannel === 'email'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <Mail className="h-4 w-4 shrink-0" />
                Email
              </button>
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-test-to">{testChannel === 'email' ? 'Your email' : 'Your phone number'}</Label>
              <Input
                id="msg-test-to"
                type={testChannel === 'email' ? 'email' : 'tel'}
                placeholder={testChannel === 'email' ? 'you@example.com' : '+1 555 123 4567'}
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                autoComplete={testChannel === 'email' ? 'email' : 'tel'}
              />
            </div>
            {testChannel === 'email' ? (
              <div className="space-y-2">
                <Label htmlFor="msg-test-subject">Subject</Label>
                <Input
                  id="msg-test-subject"
                  type="text"
                  placeholder="Test message"
                  value={testSubject}
                  onChange={(e) => setTestSubject(e.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="msg-test-body">{testChannel === 'email' ? 'Body' : 'Message'}</Label>
              <Textarea
                id="msg-test-body"
                rows={4}
                placeholder={
                  testChannel === 'email'
                    ? 'Type the email body you want to test…'
                    : 'Type the SMS you want to test…'
                }
                value={testBody}
                onChange={(e) => setTestBody(e.target.value)}
                className="resize-y min-h-[100px]"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="secondary" onClick={() => setTestSmsOpen(false)} disabled={testSending}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void sendTestMessage()}
              disabled={testSending || !testTo.trim() || !testBody.trim()}
              className="bg-emerald-600 hover:bg-emerald-600/90 text-white"
            >
              {testSending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send message'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
