'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { formatDate, formatDateTime, formatDuration } from '@/lib/format'
import { Patient, PatientTag, Call } from '@/lib/types'
import { AdoptionSignalsWidget } from './adoption-signals-widget'
import { PatientTimeline } from './patient-timeline'
import { ScheduleCallbackForm } from './schedule-callback-form'
import { CallDetailDrawer } from '@/components/calls/call-detail-drawer'
import {
  User,
  Phone,
  Mail,
  Calendar,
  Headphones,
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react'
import Link from 'next/link'

interface PatientDetailProps {
  patient: Patient
}

const getTagColor = (tag: PatientTag) => {
  switch (tag) {
    case 'New Fit':
      return 'bg-primary/10 text-primary'
    case 'High Risk':
      return 'bg-destructive/10 text-destructive'
    default:
      return 'bg-secondary text-secondary-foreground'
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

const formatIntent = (intent: string) => {
  return intent
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

export function PatientDetail({ patient }: PatientDetailProps) {
  const { updatePatient, addActivityEvent, calls, callbackTasks, sequences } = useAppStore()
  const [selectedCall, setSelectedCall] = useState<Call | null>(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)

  // Get calls for this patient
  const patientCalls = calls.filter((c) => c.patientId === patient.id)

  // Get tasks for this patient
  const patientTasks = callbackTasks.filter((t) => t.patientId === patient.id)
  const pendingTasks = patientTasks.filter((t) => t.status === 'pending')

  const handleToggleCheckIns = (checked: boolean) => {
    updatePatient(patient.id, { proactiveCheckInsEnabled: checked })
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'checkin',
      description: checked
        ? 'Proactive check-ins enabled'
        : 'Proactive check-ins disabled',
      timestamp: new Date(),
      patientName: patient.name,
      patientId: patient.id,
    })
    toast.success(checked ? 'Check-ins Enabled' : 'Check-ins Disabled', {
      description: `Proactive check-ins have been ${checked ? 'enabled' : 'disabled'} for ${patient.name}.`,
    })
  }

  const handleViewCall = (call: Call) => {
    setSelectedCall(call)
    setIsDrawerOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Button variant="ghost" asChild>
        <Link href="/patients">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Patients
        </Link>
      </Button>

      {/* Patient Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Patient Info */}
            <div className="flex items-start gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <User className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <div>
                  <h1 className="text-2xl font-bold">{patient.name}</h1>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {patient.tags.map((tag) => (
                      <Badge key={tag} className={getTagColor(tag)}>
                        {tag}
                      </Badge>
                    ))}
                    {patient.riskScore >= 50 && (
                      <Badge variant="destructive">Risk: {patient.riskScore}</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {patient.phone}
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {patient.email}
                  </div>
                </div>
              </div>
            </div>

            {/* Proactive Check-ins Toggle */}
            <div className="flex items-center gap-3 rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="checkins-toggle" className="text-base font-medium">
                  Proactive Check-ins
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable automated wellness calls/SMS
                </p>
              </div>
              <Switch
                id="checkins-toggle"
                checked={patient.proactiveCheckInsEnabled}
                onCheckedChange={handleToggleCheckIns}
              />
            </div>
          </div>

          <Separator className="my-6" />

          {/* Proactive Check-in Sequences Selection */}
          {patient.proactiveCheckInsEnabled && (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="space-y-2">
                <Label className="text-base font-medium">Check-in Sequences</Label>
                <p className="text-sm text-muted-foreground">
                  Select which proactive check-in sequences apply to this patient. If none are selected, sequences will be matched by patient tags.
                </p>
              </div>
              <div className="space-y-2 mt-4">
                {sequences.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">
                    No sequences available. Create sequences in Settings.
                  </p>
                ) : (
                  <>
                    {/* Active sequences first */}
                    {sequences
                      .filter((seq) => seq.active)
                      .map((sequence) => {
                        const isSelected = patient.selectedSequenceIds?.includes(sequence.id) ?? false
                        return (
                          <div
                            key={sequence.id}
                            className="flex items-center space-x-2 p-3 rounded-md border bg-background hover:bg-muted/50 transition-colors"
                          >
                            <input
                              type="checkbox"
                              id={`sequence-${sequence.id}`}
                              checked={isSelected}
                              onChange={(e) => {
                                const currentIds = patient.selectedSequenceIds || []
                                const newIds = e.target.checked
                                  ? [...currentIds, sequence.id]
                                  : currentIds.filter((id) => id !== sequence.id)
                                updatePatient(patient.id, { selectedSequenceIds: newIds })
                                toast.success('Sequences Updated', {
                                  description: `Check-in sequences have been updated for ${patient.name}.`,
                                })
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                            <label
                              htmlFor={`sequence-${sequence.id}`}
                              className="flex-1 cursor-pointer"
                            >
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{sequence.name}</p>
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {sequence.steps.length} step{sequence.steps.length !== 1 ? 's' : ''} • Tag: {sequence.audienceTag}
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Badge variant="default" className="ml-2">
                                    Active
                                  </Badge>
                                  {isSelected && (
                                    <Badge variant="secondary">Selected</Badge>
                                  )}
                                </div>
                              </div>
                            </label>
                          </div>
                        )
                      })}
                    
                    {/* Inactive sequences (if any) */}
                    {sequences.filter((seq) => !seq.active).length > 0 && (
                      <>
                        <Separator className="my-3" />
                        <p className="text-xs text-muted-foreground font-medium mb-2">Inactive Sequences</p>
                        {sequences
                          .filter((seq) => !seq.active)
                          .map((sequence) => {
                            const isSelected = patient.selectedSequenceIds?.includes(sequence.id) ?? false
                            return (
                              <div
                                key={sequence.id}
                                className="flex items-center space-x-2 p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition-colors opacity-75"
                              >
                                <input
                                  type="checkbox"
                                  id={`sequence-${sequence.id}`}
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const currentIds = patient.selectedSequenceIds || []
                                    const newIds = e.target.checked
                                      ? [...currentIds, sequence.id]
                                      : currentIds.filter((id) => id !== sequence.id)
                                    updatePatient(patient.id, { selectedSequenceIds: newIds })
                                    toast.success('Sequences Updated', {
                                      description: e.target.checked 
                                        ? `"${sequence.name}" selected for ${patient.name}. Note: This sequence is inactive and won't trigger check-ins until activated in Settings.`
                                        : `Check-in sequences have been updated for ${patient.name}.`,
                                    })
                                  }}
                                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <label
                                  htmlFor={`sequence-${sequence.id}`}
                                  className="flex-1 cursor-pointer"
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{sequence.name}</p>
                                      <p className="text-xs text-muted-foreground mt-0.5">
                                        {sequence.steps.length} step{sequence.steps.length !== 1 ? 's' : ''} • Tag: {sequence.audienceTag}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="secondary" className="ml-2">
                                        Inactive
                                      </Badge>
                                      {isSelected && (
                                        <Badge variant="outline">Selected</Badge>
                                      )}
                                    </div>
                                  </div>
                                </label>
                              </div>
                            )
                          })}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          <Separator className="my-6" />

          {/* Device & Fitting Info */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {patient.deviceBrand && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Device</p>
                <div className="flex items-center gap-2">
                  <Headphones className="h-4 w-4 text-primary" />
                  <span className="font-medium">
                    {patient.deviceBrand} {patient.deviceModel}
                  </span>
                </div>
              </div>
            )}
            {patient.fittingDate && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Fitting Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDate(patient.fittingDate)}</span>
                </div>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Last Contact</p>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{formatDate(patient.lastContactAt)}</span>
              </div>
            </div>
            {patient.riskReasons.length > 0 && (
              <div className="space-y-1 sm:col-span-2 lg:col-span-1">
                <p className="text-xs text-muted-foreground">Risk Factors</p>
                <p className="text-sm">{patient.riskReasons.join(', ')}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pending Tasks Alert */}
      {pendingTasks.length > 0 && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-warning">
                  {pendingTasks.length} Pending Callback Task{pendingTasks.length > 1 ? 's' : ''}
                </h3>
                <ul className="mt-2 space-y-1">
                  {pendingTasks.map((task) => (
                    <li key={task.id} className="text-sm text-muted-foreground flex items-center gap-2">
                      <Clock className="h-3 w-3" />
                      <span className="font-medium">{task.priority.toUpperCase()}:</span> {task.callReason}
                    </li>
                  ))}
                </ul>
                <Button size="sm" variant="outline" asChild className="mt-3 bg-transparent">
                  <Link href="/tasks">View All Tasks</Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calls History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Call History ({patientCalls.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {patientCalls.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No calls recorded for this patient.
            </p>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Intent</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {patientCalls.map((call) => (
                    <TableRow key={call.id}>
                      <TableCell className="whitespace-nowrap">
                        {formatDateTime(call.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{formatIntent(call.intent)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className={getOutcomeColor(call.outcome)}>
                          {call.outcome.replace('_', ' ')}
                        </Badge>
                        {call.escalated && (
                          <Badge variant="destructive" className="ml-1">Escalated</Badge>
                        )}
                      </TableCell>
                      <TableCell>{formatDuration(call.durationSec)}</TableCell>
                      <TableCell className="max-w-xs">
                        <p className="truncate">{call.summary.reason}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="outline" onClick={() => handleViewCall(call)} className="bg-transparent">
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Timeline */}
        <div className="lg:col-span-2">
          <PatientTimeline patientId={patient.id} />
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          <AdoptionSignalsWidget signals={patient.adoptionSignals} />
          <ScheduleCallbackForm patient={patient} />
        </div>
      </div>

      {/* Call Detail Drawer */}
      <CallDetailDrawer
        call={selectedCall}
        open={isDrawerOpen}
        onOpenChange={setIsDrawerOpen}
      />
    </div>
  )
}
