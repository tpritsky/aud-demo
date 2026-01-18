'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow, formatDateTime } from '@/lib/format'
import {
  Phone,
  CheckCircle2,
  AlertTriangle,
  PhoneCall,
  Calendar,
  UserPlus,
} from 'lucide-react'
import { ActivityEvent, CallOutcome } from '@/lib/types'

interface PatientTimelineProps {
  patientId: string
}

const eventConfig: Record<
  ActivityEvent['type'],
  { icon: typeof Phone; color: string; bgColor: string }
> = {
  call: {
    icon: Phone,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  checkin: {
    icon: CheckCircle2,
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  escalation: {
    icon: AlertTriangle,
    color: 'text-destructive',
    bgColor: 'bg-destructive/10',
  },
  callback: {
    icon: PhoneCall,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  appointment: {
    icon: Calendar,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  new_patient: {
    icon: UserPlus,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
}

type TimelineItem = {
  id: string
  type: ActivityEvent['type']
  description: string
  timestamp: Date
  isCall: boolean
  outcome?: CallOutcome
}

export function PatientTimeline({ patientId }: PatientTimelineProps) {
  const { activityEvents, calls } = useAppStore()

  // Get events for this patient
  const patientEvents = activityEvents.filter((e) => e.patientId === patientId)
  const patientCalls = calls.filter((c) => c.patientId === patientId)

  // Combine into timeline
  const timelineItems: TimelineItem[] = [
    ...patientEvents.map((e) => ({
      id: e.id,
      type: e.type,
      description: e.description,
      timestamp: e.timestamp,
      isCall: false,
    })),
    ...patientCalls.map((c) => ({
      id: c.id,
      type: 'call' as const,
      description: `Call: ${c.summary.reason}`,
      timestamp: c.timestamp,
      isCall: true,
      outcome: c.outcome,
    })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Interaction Timeline</CardTitle>
      </CardHeader>
      <CardContent>
        {timelineItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No interactions recorded yet.
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {timelineItems.slice(0, 10).map((item) => {
                const config = eventConfig[item.type]
                const Icon = config.icon

                return (
                  <div key={item.id} className="relative flex items-start gap-4 pl-10">
                    {/* Timeline dot */}
                    <div
                      className={`absolute left-2 top-1 flex h-5 w-5 items-center justify-center rounded-full ${config.bgColor}`}
                    >
                      <Icon className={`h-3 w-3 ${config.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium leading-tight">
                        {item.description}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.timestamp)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          ({formatDistanceToNow(item.timestamp)})
                        </span>
                        {item.outcome && (
                          <Badge variant="secondary" className="text-xs">
                            {item.outcome}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
