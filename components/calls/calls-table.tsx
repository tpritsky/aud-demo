'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { formatDateTime, formatDuration } from '@/lib/format'
import { Call, CallLogSavedView } from '@/lib/types'
import { CallFilters, CallFiltersComponent } from './call-filters'
import { CallDetailDrawer } from './call-detail-drawer'
import {
  ChevronRight,
  AlertTriangle,
  Download,
  BookmarkPlus,
  Trash2,
  ChevronDown,
} from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { downloadCallsCsv, downloadCallsJson } from '@/lib/call-export-csv'
import { CallInsightsStrip } from './call-insights-strip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { userClinicSettingsUrl } from '@/lib/view-as-clinic-api'

type CallSort = 'recent' | 'urgency' | 'value'

function serializeFilters(f: CallFilters): CallLogSavedView['filters'] {
  return {
    intent: f.intent,
    outcome: f.outcome,
    escalated: f.escalated,
    direction: f.direction,
    minUrgency: f.minUrgency,
    search: f.search,
  }
}

function deserializeFilters(f: CallLogSavedView['filters']): CallFilters {
  return {
    intent: f.intent as CallFilters['intent'],
    outcome: f.outcome as CallFilters['outcome'],
    escalated: f.escalated as CallFilters['escalated'],
    direction: f.direction as CallFilters['direction'],
    minUrgency: f.minUrgency as CallFilters['minUrgency'],
    search: f.search,
  }
}

const SCOPE_CLINIC = 'c' as const
const SCOPE_PERSONAL = 'p' as const

function savedKey(scope: typeof SCOPE_CLINIC | typeof SCOPE_PERSONAL, id: string) {
  return `${scope}:${id}`
}

function parseSavedKey(key: string): { scope: typeof SCOPE_CLINIC | typeof SCOPE_PERSONAL; id: string } | null {
  const m = /^([cp]):(.+)$/.exec(key)
  if (!m) return null
  const scope = m[1] === 'c' ? SCOPE_CLINIC : SCOPE_PERSONAL
  return { scope, id: m[2] }
}

export function CallsTable() {
  const { calls, patients, profile, viewAs } = useAppStore()
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState<CallSort>('urgency')
  const [filters, setFilters] = useState<CallFilters>({
    intent: 'all',
    outcome: 'all',
    escalated: 'all',
    direction: 'all',
    minUrgency: 'all',
    search: '',
  })
  const [clinicSavedViews, setClinicSavedViews] = useState<CallLogSavedView[]>([])
  const [personalSavedViews, setPersonalSavedViews] = useState<CallLogSavedView[]>([])
  const [activeSavedKey, setActiveSavedKey] = useState<string>('')
  const [saveDialogOpen, setSaveDialogOpen] = useState(false)
  const [newViewName, setNewViewName] = useState('')
  const [saveTargetScope, setSaveTargetScope] = useState<'personal' | 'clinic'>('personal')

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

  useEffect(() => {
    if (!profile?.clinicId) return
    ;(async () => {
      try {
        const res = await authFetch(userClinicSettingsUrl(viewAs?.userId))
        const data = await res.json()
        if (res.ok) {
          if (Array.isArray(data.callLogSavedViews)) setClinicSavedViews(data.callLogSavedViews)
          if (Array.isArray(data.personalCallLogSavedViews)) {
            setPersonalSavedViews(data.personalCallLogSavedViews)
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }, [authFetch, profile?.clinicId, viewAs?.userId])

  const persistClinicViews = async (next: CallLogSavedView[]) => {
    const res = await authFetch(userClinicSettingsUrl(viewAs?.userId), {
      method: 'PATCH',
      body: JSON.stringify({ callLogSavedViews: next }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save clinic views')
    setClinicSavedViews(data.callLogSavedViews || next)
  }

  const persistPersonalViews = async (next: CallLogSavedView[]) => {
    const res = await authFetch('/api/profile/preferences', {
      method: 'PATCH',
      body: JSON.stringify({ callLogSavedViews: next }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save personal views')
    setPersonalSavedViews(data.callLogSavedViews || next)
  }

  const onFiltersChange = (next: CallFilters) => {
    setFilters(next)
    setActiveSavedKey('')
  }

  const isAdmin = profile?.role === 'admin'

  const tierRank = (n: 1 | 2 | 3 | 4 | null | undefined) => (n == null ? 0 : n)

  const filteredCalls = useMemo(() => {
    const filtered = calls.filter((call) => {
      if (filters.intent !== 'all' && call.intent !== filters.intent) return false
      if (filters.outcome !== 'all' && call.outcome !== filters.outcome) return false
      if (filters.escalated === 'yes' && !call.escalated) return false
      if (filters.escalated === 'no' && call.escalated) return false
      if (filters.direction !== 'all') {
        const d = call.callDirection || 'unknown'
        if (d !== filters.direction) return false
      }
      if (filters.minUrgency !== 'all') {
        const min = parseInt(filters.minUrgency, 10) as 1 | 2 | 3 | 4
        if (tierRank(call.aiResponseUrgency) < min) return false
      }
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const aiText = [call.aiBriefSummary, ...(call.aiTags || []), call.aiCallerName, call.aiCallerPhone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        const tx = (call.transcript || '').toLowerCase()
        return (
          call.callerName.toLowerCase().includes(search) ||
          call.phone.includes(search) ||
          call.summary.reason.toLowerCase().includes(search) ||
          aiText.includes(search) ||
          tx.includes(search)
        )
      }
      return true
    })

    const byRecent = (a: Call, b: Call) => b.timestamp.getTime() - a.timestamp.getTime()
    const byUrgency = (a: Call, b: Call) => {
      const d = tierRank(b.aiResponseUrgency) - tierRank(a.aiResponseUrgency)
      if (d !== 0) return d
      return byRecent(a, b)
    }
    const byValue = (a: Call, b: Call) => {
      const d = tierRank(b.aiBusinessValue) - tierRank(a.aiBusinessValue)
      if (d !== 0) return d
      return byRecent(a, b)
    }

    if (sortBy === 'urgency') return [...filtered].sort(byUrgency)
    if (sortBy === 'value') return [...filtered].sort(byValue)
    return [...filtered].sort(byRecent)
  }, [calls, filters, sortBy])

  const getPatientName = (patientId?: string) => {
    if (!patientId) return null
    const patient = patients.find((p) => p.id === patientId)
    return patient?.name || null
  }

  const getOutcomeColor = (outcome: Call['outcome']) => {
    switch (outcome) {
      case 'resolved':
        return 'bg-success/10 text-success'
      case 'escalated':
        return 'bg-destructive/10 text-destructive'
      case 'transferred':
        return 'bg-warning/10 text-warning'
      default:
        return 'bg-secondary text-secondary-foreground'
    }
  }

  const getStatusColor = (status: Call['status']) => {
    switch (status) {
      case 'new':
        return 'bg-info/10 text-info'
      case 'in_progress':
        return 'bg-warning/10 text-warning'
      case 'pending_callback':
        return 'bg-secondary text-secondary-foreground'
      case 'resolved':
        return 'bg-success/10 text-success'
      case 'escalated':
        return 'bg-destructive/10 text-destructive'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const formatIntent = (intent: string) => {
    return intent
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleRowClick = (call: Call) => {
    setSelectedCall(call)
    setIsDrawerOpen(true)
  }

  const urgencyBadge = (u: Call['aiResponseUrgency']) => {
    if (u == null) return <span className="text-muted-foreground text-xs">—</span>
    const label = `P${u}`
    const cls =
      u >= 4
        ? 'bg-destructive/15 text-destructive'
        : u === 3
          ? 'bg-orange-500/15 text-orange-700 dark:text-orange-400'
          : u === 2
            ? 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
            : 'bg-muted text-muted-foreground'
    return <Badge className={cls}>{label}</Badge>
  }

  const valueBadge = (v: Call['aiBusinessValue']) => {
    if (v == null) return <span className="text-muted-foreground text-xs">—</span>
    const label = `V${v}`
    const cls =
      v >= 4
        ? 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-300'
        : v === 3
          ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
          : v === 2
            ? 'bg-secondary text-secondary-foreground'
            : 'bg-muted text-muted-foreground'
    return <Badge className={cls}>{label}</Badge>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <CallFiltersComponent filters={filters} onFiltersChange={onFiltersChange} />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:flex-wrap shrink-0">
          {profile?.clinicId ? (
            <div className="flex flex-col gap-1">
              <Label className="text-muted-foreground text-xs">Saved view</Label>
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={activeSavedKey || '_custom'}
                  onValueChange={(v) => {
                    if (v === '_custom') {
                      setActiveSavedKey('')
                      return
                    }
                    const parsed = parseSavedKey(v)
                    if (!parsed) return
                    const list = parsed.scope === SCOPE_CLINIC ? clinicSavedViews : personalSavedViews
                    const vdef = list.find((x) => x.id === parsed.id)
                    if (vdef) {
                      setFilters(deserializeFilters(vdef.filters))
                      setActiveSavedKey(v)
                    }
                  }}
                >
                  <SelectTrigger className="w-[220px]">
                    <SelectValue placeholder="Custom" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_custom">Custom (unsaved)</SelectItem>
                    {clinicSavedViews.map((sv) => (
                      <SelectItem key={savedKey(SCOPE_CLINIC, sv.id)} value={savedKey(SCOPE_CLINIC, sv.id)}>
                        {sv.name} (clinic)
                      </SelectItem>
                    ))}
                    {personalSavedViews.map((sv) => (
                      <SelectItem key={savedKey(SCOPE_PERSONAL, sv.id)} value={savedKey(SCOPE_PERSONAL, sv.id)}>
                        {sv.name} (mine)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1"
                  onClick={() => {
                    setNewViewName('')
                    setSaveTargetScope('personal')
                    setSaveDialogOpen(true)
                  }}
                >
                  <BookmarkPlus className="h-3.5 w-3.5" />
                  Save view
                </Button>
                {activeSavedKey ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="gap-1 text-destructive"
                    onClick={async () => {
                      const parsed = parseSavedKey(activeSavedKey)
                      if (!parsed) return
                      try {
                        if (parsed.scope === SCOPE_CLINIC) {
                          const next = clinicSavedViews.filter((s) => s.id !== parsed.id)
                          await persistClinicViews(next)
                        } else {
                          const next = personalSavedViews.filter((s) => s.id !== parsed.id)
                          await persistPersonalViews(next)
                        }
                        setActiveSavedKey('')
                        toast.success('View removed')
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : 'Failed')
                      }
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="flex items-center gap-2">
            <Label htmlFor="call-sort" className="text-muted-foreground whitespace-nowrap text-sm">
              Sort
            </Label>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as CallSort)}>
              <SelectTrigger id="call-sort" className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="urgency">Urgency (AI, high first)</SelectItem>
                <SelectItem value="value">Business value (AI, high first)</SelectItem>
                <SelectItem value="recent">Most recent</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="secondary" size="sm" className="gap-1">
                <Download className="h-3.5 w-3.5" />
                Export
                <ChevronDown className="h-3.5 w-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() =>
                  downloadCallsCsv(
                    filteredCalls,
                    `calls-export-${new Date().toISOString().slice(0, 10)}.csv`,
                    'excerpt'
                  )
                }
              >
                CSV (summary + excerpt)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  downloadCallsCsv(
                    filteredCalls,
                    `calls-full-transcript-${new Date().toISOString().slice(0, 10)}.csv`,
                    'full_transcript'
                  )
                }
              >
                CSV (full transcript)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  downloadCallsJson(
                    filteredCalls,
                    `calls-export-${new Date().toISOString().slice(0, 10)}.json`
                  )
                }
              >
                JSON
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save filter view</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="e.g. High urgency inbound"
              value={newViewName}
              onChange={(e) => setNewViewName(e.target.value)}
            />
            {isAdmin ? (
              <div className="space-y-1">
                <Label className="text-muted-foreground text-xs">Save as</Label>
                <Select
                  value={saveTargetScope}
                  onValueChange={(v) => setSaveTargetScope(v as 'personal' | 'clinic')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="personal">Only me</SelectItem>
                    <SelectItem value="clinic">Whole clinic (admins)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Saved to your account. Admins can add clinic-wide views.</p>
            )}
          </div>
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const name = newViewName.trim()
                if (!name) {
                  toast.error('Enter a name')
                  return
                }
                const scope = isAdmin && saveTargetScope === 'clinic' ? 'clinic' : 'personal'
                try {
                  const id = crypto.randomUUID()
                  const row = { id, name, filters: serializeFilters(filters) }
                  if (scope === 'clinic') {
                    const next = [...clinicSavedViews, row]
                    await persistClinicViews(next)
                    setActiveSavedKey(savedKey(SCOPE_CLINIC, id))
                    toast.success('Clinic-wide view saved')
                  } else {
                    const next = [...personalSavedViews, row]
                    await persistPersonalViews(next)
                    setActiveSavedKey(savedKey(SCOPE_PERSONAL, id))
                    toast.success('Personal view saved')
                  }
                  setSaveDialogOpen(false)
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Failed to save')
                }
              }}
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CallInsightsStrip calls={filteredCalls} />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead className="w-[88px] hidden sm:table-cell">Dir</TableHead>
              <TableHead className="w-[72px]">Urg.</TableHead>
              <TableHead className="w-[72px]">Value</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className="hidden lg:table-cell max-w-[200px]">AI summary</TableHead>
              <TableHead className="hidden md:table-cell">Patient</TableHead>
              <TableHead className="hidden sm:table-cell">Intent</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden xl:table-cell">Duration</TableHead>
              <TableHead className="hidden md:table-cell">Escalated</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={13} className="h-24 text-center">
                  No calls found matching your filters.
                </TableCell>
              </TableRow>
            ) : (
              filteredCalls.map((call) => (
                <TableRow
                  key={call.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(call)}
                >
                  <TableCell className="font-medium">
                    {formatDateTime(call.timestamp)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="outline" className="text-[10px] font-normal capitalize">
                      {call.callDirection || 'unknown'}
                    </Badge>
                  </TableCell>
                  <TableCell>{urgencyBadge(call.aiResponseUrgency)}</TableCell>
                  <TableCell>{valueBadge(call.aiBusinessValue)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{call.callerName}</p>
                      <p className="text-xs text-muted-foreground">{call.phone}</p>
                      {call.aiProcessingStatus && call.aiProcessingStatus !== 'completed' ? (
                        <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                          AI: {call.aiProcessingStatus.replace('_', ' ')}
                        </p>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell max-w-[200px]">
                    <p className="text-sm line-clamp-2 text-muted-foreground">
                      {call.aiBriefSummary || '—'}
                    </p>
                    {call.aiTags && call.aiTags.length > 0 ? (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {call.aiTags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px] px-1 py-0 font-normal">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {getPatientName(call.patientId) || (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge variant="secondary">{formatIntent(call.intent)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={getOutcomeColor(call.outcome)}>
                      {call.outcome.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <Badge className={getStatusColor(call.status)}>
                      {call.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell text-muted-foreground">
                    {formatDuration(call.durationSec)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {call.escalated ? (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredCalls.length} of {calls.length} calls
      </div>

      <CallDetailDrawer
        call={selectedCall}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </div>
  )
}
