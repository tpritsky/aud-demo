'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from '@/lib/format'
import { Phone, CheckCircle2, AlertTriangle, PhoneCall as PhoneCallback, Calendar, ArrowRight } from 'lucide-react'
import { ActivityEvent } from '@/lib/types'
import Link from 'next/link'

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
    icon: PhoneCallback,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  appointment: {
    icon: Calendar,
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
}

export function ActivityFeed() {
  const { activityEvents, callbackTasks } = useAppStore()
  const recentEvents = activityEvents.slice(0, 10)
  const pendingTasksCount = callbackTasks.filter((t) => t.status === 'pending').length

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base font-semibold">Today&apos;s Activity</CardTitle>
        {pendingTasksCount > 0 && (
          <Button variant="ghost" size="sm" asChild className="text-xs">
            <Link href="/tasks">
              {pendingTasksCount} Tasks
              <ArrowRight className="ml-1 h-3 w-3" />
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {recentEvents.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No activity yet today
          </p>
        ) : (
          <div className="space-y-4">
            {recentEvents.map((event) => {
              const config = eventConfig[event.type]
              const Icon = config.icon

              return (
                <div key={event.id} className="flex items-start gap-3">
                  <div className={`rounded-lg p-2 ${config.bgColor}`}>
                    <Icon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-tight">
                      {event.description}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {event.patientName && (
                        <Badge variant="secondary" className="text-xs">
                          {event.patientName}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(event.timestamp)}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
