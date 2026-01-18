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

export function CallsTable() {
  const { calls, patients } = useAppStore()
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [filters, setFilters] = useState<CallFilters>({
    intent: 'all',
    outcome: 'all',
    escalated: 'all',
    search: '',
  })

  const filteredCalls = useMemo(() => {
    return calls
      .filter((call) => {
        if (filters.intent !== 'all' && call.intent !== filters.intent) return false
        if (filters.outcome !== 'all' && call.outcome !== filters.outcome) return false
        if (filters.escalated === 'yes' && !call.escalated) return false
        if (filters.escalated === 'no' && call.escalated) return false
        if (filters.search) {
          const search = filters.search.toLowerCase()
          return (
            call.callerName.toLowerCase().includes(search) ||
            call.phone.includes(search) ||
            call.summary.reason.toLowerCase().includes(search)
          )
        }
        return true
      })
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [calls, filters])

  const getPatientName = (patientId?: string) => {
    if (!patientId) return null
    const patient = patients.find((p) => p.id === patientId)
    return patient?.name || null
  }

  const getSentimentColor = (sentiment: Call['sentiment']) => {
    switch (sentiment) {
      case 'positive':
        return 'bg-success/10 text-success'
      case 'negative':
        return 'bg-destructive/10 text-destructive'
      default:
        return 'bg-muted text-muted-foreground'
    }
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

  return (
    <div className="space-y-4">
      <CallFiltersComponent filters={filters} onFiltersChange={setFilters} />

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Caller</TableHead>
              <TableHead className="hidden md:table-cell">Patient</TableHead>
              <TableHead className="hidden sm:table-cell">Intent</TableHead>
              <TableHead>Outcome</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden lg:table-cell">Duration</TableHead>
              <TableHead className="hidden lg:table-cell">Sentiment</TableHead>
              <TableHead className="hidden md:table-cell">Escalated</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredCalls.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
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
                  <TableCell>
                    <div>
                      <p className="font-medium">{call.callerName}</p>
                      <p className="text-xs text-muted-foreground">{call.phone}</p>
                    </div>
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
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDuration(call.durationSec)}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge className={getSentimentColor(call.sentiment)}>
                      {call.sentiment}
                    </Badge>
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
