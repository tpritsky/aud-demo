'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AdoptionSignals } from '@/lib/types'
import {
  CheckCircle2,
  XCircle,
  Clock,
  Volume2,
  Bluetooth,
  HelpCircle,
} from 'lucide-react'

interface AdoptionSignalsWidgetProps {
  signals: AdoptionSignals
}

export function AdoptionSignalsWidget({ signals }: AdoptionSignalsWidgetProps) {
  const getStatusIcon = (value: boolean | null) => {
    if (value === null) return <HelpCircle className="h-4 w-4 text-muted-foreground" />
    if (value) return <CheckCircle2 className="h-4 w-4 text-success" />
    return <XCircle className="h-4 w-4 text-destructive" />
  }

  const getStatusBadge = (value: boolean | null, trueLabel: string, falseLabel: string) => {
    if (value === null) return <Badge variant="outline">Unknown</Badge>
    if (value)
      return (
        <Badge className="bg-success/10 text-success">{trueLabel}</Badge>
      )
    return <Badge variant="destructive">{falseLabel}</Badge>
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Adoption Signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Wore Today */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(signals.woreToday)}
            <span className="text-sm">Wore Today</span>
          </div>
          {getStatusBadge(signals.woreToday, 'Yes', 'No')}
        </div>

        {/* Hours Worn */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">Est. Hours Worn</span>
          </div>
          {signals.estimatedHoursWorn !== null ? (
            <Badge
              className={
                signals.estimatedHoursWorn >= 8
                  ? 'bg-success/10 text-success'
                  : signals.estimatedHoursWorn >= 4
                    ? 'bg-warning/10 text-warning'
                    : 'bg-destructive/10 text-destructive'
              }
            >
              {signals.estimatedHoursWorn}h
            </Badge>
          ) : (
            <Badge variant="outline">Unknown</Badge>
          )}
        </div>

        {/* Comfort Issues */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon(!signals.comfortIssues)}
            <span className="text-sm">Comfort Issues</span>
          </div>
          {getStatusBadge(!signals.comfortIssues, 'None', 'Yes')}
        </div>

        {/* Sound Clarity Issues */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Volume2
              className={`h-4 w-4 ${signals.soundClarityIssues ? 'text-destructive' : 'text-success'}`}
            />
            <span className="text-sm">Sound Clarity Issues</span>
          </div>
          {getStatusBadge(!signals.soundClarityIssues, 'None', 'Yes')}
        </div>

        {/* Bluetooth/App Issues */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bluetooth
              className={`h-4 w-4 ${signals.bluetoothAppIssues ? 'text-destructive' : 'text-success'}`}
            />
            <span className="text-sm">Bluetooth/App Issues</span>
          </div>
          {getStatusBadge(!signals.bluetoothAppIssues, 'None', 'Yes')}
        </div>
      </CardContent>
    </Card>
  )
}
