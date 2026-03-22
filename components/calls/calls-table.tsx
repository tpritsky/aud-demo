'use client'

import { useState, useMemo } from 'react'
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
import { Call } from '@/lib/types'
import { CallFilters, CallFiltersComponent } from './call-filters'
import { CallDetailDrawer } from './call-detail-drawer'
import { ChevronRight, AlertTriangle } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'

type CallSort = 'recent' | 'urgency' | 'value'

export function CallsTable() {
  const { calls, patients } = useAppStore()
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [sortBy, setSortBy] = useState<CallSort>('urgency')
  const [filters, setFilters] = useState<CallFilters>({
    intent: 'all',
    outcome: 'all',
    escalated: 'all',
    search: '',
  })

  const tierRank = (n: 1 | 2 | 3 | 4 | null | undefined) => (n == null ? 0 : n)

  const filteredCalls = useMemo(() => {
    const filtered = calls.filter((call) => {
      if (filters.intent !== 'all' && call.intent !== filters.intent) return false
      if (filters.outcome !== 'all' && call.outcome !== filters.outcome) return false
      if (filters.escalated === 'yes' && !call.escalated) return false
      if (filters.escalated === 'no' && call.escalated) return false
      if (filters.search) {
        const search = filters.search.toLowerCase()
        const aiText = [call.aiBriefSummary, ...(call.aiTags || []), call.aiCallerName, call.aiCallerPhone]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return (
          call.callerName.toLowerCase().includes(search) ||
          call.phone.includes(search) ||
          call.summary.reason.toLowerCase().includes(search) ||
          aiText.includes(search)
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
        <CallFiltersComponent filters={filters} onFiltersChange={setFilters} />
        <div className="flex items-center gap-2 shrink-0">
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
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
                <TableCell colSpan={12} className="h-24 text-center">
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
