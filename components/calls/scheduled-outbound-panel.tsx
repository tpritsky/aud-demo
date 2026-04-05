'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { ScheduledOutboundCall } from '@/lib/types'
import { formatDateTime } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { userScheduledOutboundEventsUrl, userScheduledOutboundUrl } from '@/lib/view-as-clinic-api'
import { CalendarClock, ChevronDown, ChevronRight, Loader2, PhoneOutgoing } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'

type AuditEventRow = {
  id: string
  event_type: string
  detail: unknown
  created_at: string
}

function ScheduledAuditList({
  events,
  loading,
}: {
  events: AuditEventRow[] | undefined
  loading: boolean
}) {
  if (loading) {
    return <p className="text-xs text-muted-foreground py-1">Loading…</p>
  }
  if (!events || events.length === 0) {
    return <p className="text-xs text-muted-foreground py-1">No audit events yet.</p>
  }
  return (
    <ul className="space-y-2 max-h-48 overflow-auto text-xs">
      {events.map((ev) => (
        <li key={ev.id} className="border-l-2 border-border pl-2">
          <span className="font-medium">{ev.event_type}</span>
          <span className="text-muted-foreground"> · {formatDateTime(new Date(ev.created_at))}</span>
          {ev.detail != null ? (
            <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
              {typeof ev.detail === 'string' ? ev.detail : JSON.stringify(ev.detail, null, 2)}
            </pre>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export function ScheduledOutboundPanel() {
  const { profile, viewAs } = useAppStore()
  const [myUserId, setMyUserId] = useState<string | null>(null)
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null)
  const [auditById, setAuditById] = useState<Record<string, AuditEventRow[]>>({})
  const [auditLoading, setAuditLoading] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [rows, setRows] = useState<ScheduledOutboundCall[]>([])
  const [to, setTo] = useState('')
  const [whenLocal, setWhenLocal] = useState('')
  const [goal, setGoal] = useState('')
  const [reason, setReason] = useState('')
  const [extra, setExtra] = useState('')
  const [maxAttempts, setMaxAttempts] = useState(3)

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not signed in')
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  }, [])

  const load = useCallback(async () => {
    if (!profile?.clinicId) {
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const res = await authFetch(userScheduledOutboundUrl(viewAs?.userId))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setRows(data.calls || [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load scheduled calls')
    } finally {
      setLoading(false)
    }
  }, [authFetch, profile?.clinicId, viewAs?.userId])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setMyUserId(data.session?.user.id ?? null)
    })
  }, [])

  const fetchAudit = async (id: string) => {
    if (auditById[id]) return
    setAuditLoading(id)
    try {
      const res = await authFetch(userScheduledOutboundEventsUrl(id, viewAs?.userId))
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load audit')
      const list = Array.isArray(data.events) ? data.events : []
      setAuditById((prev) => ({ ...prev, [id]: list as AuditEventRow[] }))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Audit failed')
    } finally {
      setAuditLoading(null)
    }
  }

  const impersonatedOrSelfId = viewAs?.userId ?? myUserId
  const canManageRow = (createdBy: string) =>
    profile?.role === 'admin' ||
    (impersonatedOrSelfId != null && createdBy === impersonatedOrSelfId)

  const schedule = async () => {
    if (!whenLocal || !to.trim() || !goal.trim()) {
      toast.error('Phone, goal, and date/time are required')
      return
    }
    const iso = new Date(whenLocal).toISOString()
    setSaving(true)
    try {
      const res = await authFetch(userScheduledOutboundUrl(viewAs?.userId), {
        method: 'POST',
        body: JSON.stringify({
          to_number: to,
          scheduled_for: iso,
          call_goal: goal,
          call_reason: reason || undefined,
          extra_context: extra || undefined,
          max_attempts: maxAttempts,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to schedule')
      toast.success('Outbound call scheduled')
      setTo('')
      setGoal('')
      setReason('')
      setExtra('')
      setWhenLocal('')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Schedule failed')
    } finally {
      setSaving(false)
    }
  }

  const cancel = async (id: string) => {
    try {
      const res = await authFetch(userScheduledOutboundUrl(viewAs?.userId), {
        method: 'PATCH',
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Cancel failed')
      toast.success('Cancelled')
      await load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Cancel failed')
    }
  }

  if (!profile?.clinicId) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarClock className="h-5 w-5" />
          Scheduled outbound calls
        </CardTitle>
        <CardDescription>
          Workers and admins can queue a dial for a future time. Requires clinic voice agent IDs in Super Admin → business
          settings, <code className="text-xs">ELEVENLABS_API_KEY</code> on the server, and{' '}
          <code className="text-xs">CRON_SECRET</code> + Vercel Cron on{' '}
          <code className="text-xs">/api/cron/scheduled-outbound</code>. Optional:{' '}
          <code className="text-xs">QSTASH_TOKEN</code> + public app URL schedules one-shot dispatch via Upstash (cron still
          recommended as backup).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2 sm:col-span-2">
            <Label>Phone</Label>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="+1…" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>When (local)</Label>
            <Input type="datetime-local" value={whenLocal} onChange={(e) => setWhenLocal(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Call goal (for the agent)</Label>
            <Input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Confirm follow-up appointment…" />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Reason (optional)</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Staff note…" />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label>Extra context (optional)</Label>
            <Textarea rows={2} value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Payer, provider name, etc." />
          </div>
          <div className="space-y-2 sm:col-span-1">
            <Label>Max retries</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={maxAttempts}
              onChange={(e) => setMaxAttempts(Math.min(10, Math.max(1, parseInt(e.target.value, 10) || 3)))}
            />
          </div>
        </div>
        <Button type="button" onClick={schedule} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <PhoneOutgoing className="h-4 w-4" />}
          Schedule call
        </Button>

        <div className="border-t pt-4">
          <h4 className="text-sm font-medium mb-2">Queue</h4>
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled outbound calls.</p>
          ) : (
            <ul className="space-y-2 max-h-[28rem] overflow-auto">
              {rows.map((r) => (
                <li key={r.id} className="rounded-md border text-sm">
                  {canManageRow(r.createdBy) ? (
                    <Collapsible
                      open={expandedAuditId === r.id}
                      onOpenChange={(open) => {
                        setExpandedAuditId(open ? r.id : null)
                        if (open) void fetchAudit(r.id)
                      }}
                    >
                      <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium">{r.toNumber}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDateTime(r.scheduledFor)} · {r.status}
                            {r.attemptCount != null && r.maxAttempts != null
                              ? ` · attempts ${r.attemptCount}/${r.maxAttempts}`
                              : ''}
                            {r.nextRetryAt ? ` · next retry ${formatDateTime(r.nextRetryAt)}` : ''}
                          </p>
                          <p className="text-xs mt-0.5 line-clamp-2">{r.callGoal}</p>
                          {r.errorMessage ? (
                            <p className="text-xs text-destructive mt-1 line-clamp-2">{r.errorMessage}</p>
                          ) : null}
                        </div>
                        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
                          <CollapsibleTrigger asChild>
                            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 text-xs">
                              {expandedAuditId === r.id ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                              Audit
                            </Button>
                          </CollapsibleTrigger>
                          {r.status === 'scheduled' ? (
                            <Button type="button" variant="outline" size="sm" onClick={() => cancel(r.id)}>
                              Cancel
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <CollapsibleContent className="border-t bg-muted/15 px-3 py-2">
                        <ScheduledAuditList
                          events={auditById[r.id]}
                          loading={auditLoading === r.id}
                        />
                      </CollapsibleContent>
                    </Collapsible>
                  ) : (
                    <div className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{r.toNumber}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateTime(r.scheduledFor)} · {r.status}
                          {r.attemptCount != null && r.maxAttempts != null
                            ? ` · attempts ${r.attemptCount}/${r.maxAttempts}`
                            : ''}
                          {r.nextRetryAt ? ` · next retry ${formatDateTime(r.nextRetryAt)}` : ''}
                        </p>
                        <p className="text-xs mt-0.5 line-clamp-2">{r.callGoal}</p>
                        {r.errorMessage ? (
                          <p className="text-xs text-destructive mt-1 line-clamp-2">{r.errorMessage}</p>
                        ) : null}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
