'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAppStore } from '@/lib/store'
import {
  Phone,
  PhoneOff,
  Calendar,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react'

const kpiConfig = [
  {
    key: 'callsToday',
    title: 'Calls Today',
    icon: Phone,
    format: (v: number) => v.toString(),
  },
  {
    key: 'missedCallsPrevented',
    title: 'Missed Calls Prevented',
    icon: PhoneOff,
    format: (v: number) => v.toString(),
  },
  {
    key: 'appointmentsBooked',
    title: 'Appointments Booked',
    icon: Calendar,
    format: (v: number) => v.toString(),
  },
  {
    key: 'proactiveCheckInsCompleted',
    title: 'Check-ins Completed',
    icon: CheckCircle2,
    format: (v: number) => v.toString(),
  },
  {
    key: 'escalationsCreated',
    title: 'Escalations Created',
    icon: AlertTriangle,
    format: (v: number) => v.toString(),
  },
] as const

export function KPICards() {
  const { kpiData } = useAppStore()

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {kpiConfig.map((kpi) => {
        const Icon = kpi.icon
        const value = kpiData[kpi.key]

        return (
          <Card key={kpi.key}>
            <CardHeader className="space-y-0 pb-2">
              <div className="flex flex-row items-center justify-between gap-3">
                <CardTitle className="flex-1 min-w-0 text-sm font-medium leading-snug text-muted-foreground">
                  {kpi.title}
                </CardTitle>
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-950/50"
                  aria-hidden
                >
                  <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpi.format(value)}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
