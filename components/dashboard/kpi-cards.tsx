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
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    key: 'missedCallsPrevented',
    title: 'Missed Calls Prevented',
    icon: PhoneOff,
    format: (v: number) => v.toString(),
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    key: 'appointmentsBooked',
    title: 'Appointments Booked',
    icon: Calendar,
    format: (v: number) => v.toString(),
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
  {
    key: 'proactiveCheckInsCompleted',
    title: 'Check-ins Completed',
    icon: CheckCircle2,
    format: (v: number) => v.toString(),
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    key: 'escalationsCreated',
    title: 'Escalations Created',
    icon: AlertTriangle,
    format: (v: number) => v.toString(),
    color: 'text-warning',
    bgColor: 'bg-warning/10',
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {kpi.title}
              </CardTitle>
              <div className={`rounded-lg p-2 ${kpi.bgColor}`}>
                <Icon className={`h-4 w-4 ${kpi.color}`} />
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
