'use client'

import { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Call, CallbackTask, CallStatus } from '@/lib/types'
import { formatDateTime, formatDuration } from '@/lib/format'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import {
  ChevronDown,
  ChevronUp,
  Phone,
  Clock,
  User,
  FileText,
  Download,
  PhoneCall,
} from 'lucide-react'

interface CallDetailDrawerProps {
  call: Call | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const statusOptions: { value: CallStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-info/10 text-info' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-warning/10 text-warning' },
  { value: 'pending_callback', label: 'Pending Callback', color: 'bg-secondary text-secondary-foreground' },
  { value: 'resolved', label: 'Resolved', color: 'bg-success/10 text-success' },
  { value: 'escalated', label: 'Escalated', color: 'bg-destructive/10 text-destructive' },
]

export function CallDetailDrawer({ call, open, onOpenChange }: CallDetailDrawerProps) {
  const { calls, addCallbackTask, addActivityEvent, patients, updateCall, agentConfig } = useAppStore()
  const [isTranscriptOpen, setIsTranscriptOpen] = useState(false)
  const [isCallbackDialogOpen, setIsCallbackDialogOpen] = useState(false)
  const [callbackCallReason, setCallbackCallReason] = useState('')
  const [callbackCallGoal, setCallbackCallGoal] = useState('')

  // Get the latest call from the store to ensure we have the most up-to-date data
  const currentCall = call ? calls.find((c) => c.id === call.id) || call : null

  if (!currentCall) return null

  const patient = currentCall.patientId ? patients.find((p) => p.id === currentCall.patientId) : null

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

  const formatIntent = (intent: string) => {
    return intent
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  const handleStatusChange = (newStatus: CallStatus) => {
    updateCall(currentCall.id, { status: newStatus })
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'call',
      description: `Call status changed to ${newStatus.replace('_', ' ')}`,
      timestamp: new Date(),
      patientName: currentCall.callerName,
      patientId: currentCall.patientId,
    })
    toast.success('Status Updated', {
      description: `Call status has been changed to ${newStatus.replace('_', ' ')}.`,
    })
  }

  const handleCreateCallback = () => {
    const { callbackSettings } = agentConfig
    const priority = currentCall.escalated ? 'high' : callbackSettings.priorityByDefault
    const dueTime = priority === 'high' ? 60 * 60 * 1000 : priority === 'medium' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000

    if (!callbackCallReason.trim() || !callbackCallGoal.trim()) {
      toast.error('Validation Error', {
        description: 'Please fill in Call Reason and Call Goal fields.',
      })
      return
    }

    const newTask: CallbackTask = {
      id: `task-${Date.now()}`,
      patientId: currentCall.patientId || '',
      patientName: currentCall.callerName,
      phone: currentCall.phone,
      callReason: callbackCallReason.trim(),
      callGoal: callbackCallGoal.trim(),
      priority,
      status: 'pending',
      createdAt: new Date(),
      dueAt: new Date(Date.now() + dueTime),
      callId: currentCall.id,
      attempts: [],
      maxAttempts: callbackSettings.maxAttempts,
    }

    addCallbackTask(newTask)

    // Update call status to pending_callback
    updateCall(currentCall.id, { status: 'pending_callback' })

    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'callback',
      description: `Callback task created from call`,
      timestamp: new Date(),
      patientName: currentCall.callerName,
      patientId: currentCall.patientId,
    })

    toast.success('Callback Task Created', {
      description: `Task created for ${currentCall.callerName}`,
    })

    setIsCallbackDialogOpen(false)
    setCallbackCallReason('')
    setCallbackCallGoal('')
  }

  const handleExportSummary = () => {
    const summary = `
CALL SUMMARY
============
Caller: ${currentCall.callerName}
Phone: ${currentCall.phone}
Time: ${formatDateTime(currentCall.timestamp)}
Duration: ${formatDuration(currentCall.durationSec)}
Intent: ${formatIntent(currentCall.intent)}
Outcome: ${currentCall.outcome}
Status: ${currentCall.status}
Sentiment: ${currentCall.sentiment}
Escalated: ${currentCall.escalated ? 'Yes' : 'No'}

REASON
------
${currentCall.summary.reason}

RESOLUTION
----------
${currentCall.summary.resolution}

NEXT STEPS
----------
${currentCall.summary.nextSteps || 'None specified'}

ENTITIES
--------
${Object.entries(currentCall.entities)
  .filter(([_, v]) => v)
  .map(([k, v]) => `${k}: ${v}`)
  .join('\n')}
    `.trim()

    const blob = new Blob([summary], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `call-summary-${currentCall.id}.txt`
    a.click()
    URL.revokeObjectURL(url)

    toast.success('Summary Exported', {
      description: 'Call summary has been downloaded.',
    })
  }

  const currentStatus = statusOptions.find((s) => s.value === currentCall.status) || statusOptions[0]

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader className="px-6 pt-6 pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              Call Details
            </SheetTitle>
            <SheetDescription>
              {formatDateTime(currentCall.timestamp)}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-2 space-y-6 px-6 pb-6">
            {/* Caller Info */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Caller Information</h3>
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium text-base">{currentCall.callerName}</p>
                  <p className="text-sm text-muted-foreground">{currentCall.phone}</p>
                </div>
              </div>
              {patient && (
                <Badge variant="outline" className="mt-2">Patient: {patient.name}</Badge>
              )}
            </div>

            <Separator />

            {/* Status Dropdown */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
              <Select value={currentCall.status} onValueChange={(v) => handleStatusChange(v as CallStatus)}>
                <SelectTrigger className="w-full h-11">
                  <SelectValue>
                    <Badge className={currentStatus.color}>
                      {currentStatus.label}
                    </Badge>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <Badge className={status.color}>{status.label}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Call Metadata */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Duration</p>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{formatDuration(currentCall.durationSec)}</span>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Intent</p>
                <Badge variant="secondary">{formatIntent(currentCall.intent)}</Badge>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Outcome</p>
                <Badge className={getOutcomeColor(currentCall.outcome)}>
                  {currentCall.outcome.replace('_', ' ')}
                </Badge>
              </div>
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Sentiment</p>
                <Badge className={getSentimentColor(currentCall.sentiment)}>
                  {currentCall.sentiment}
                </Badge>
              </div>
              {currentCall.escalated && (
                <div className="col-span-2 pt-2">
                  <Badge variant="destructive">Escalated</Badge>
                </div>
              )}
            </div>

            <Separator />

            {/* Summary */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Call Summary
              </h3>
              <div className="space-y-4 rounded-lg bg-muted/50 p-5">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Reason</p>
                  <p className="text-sm leading-relaxed">{currentCall.summary.reason}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">Resolution</p>
                  <p className="text-sm leading-relaxed">{currentCall.summary.resolution}</p>
                </div>
                {currentCall.summary.nextSteps && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Next Steps</p>
                    <p className="text-sm leading-relaxed">{currentCall.summary.nextSteps}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Entities */}
            {Object.values(currentCall.entities).some(Boolean) && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground">Extracted Entities</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {currentCall.entities.deviceBrand && (
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Device Brand</p>
                        <p className="text-sm font-medium">{currentCall.entities.deviceBrand}</p>
                      </div>
                    )}
                    {currentCall.entities.deviceModel && (
                      <div className="rounded-lg bg-muted/50 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Device Model</p>
                        <p className="text-sm font-medium">{currentCall.entities.deviceModel}</p>
                      </div>
                    )}
                    {currentCall.entities.issueType && (
                      <div className="col-span-2 rounded-lg bg-muted/50 p-4">
                        <p className="text-xs text-muted-foreground mb-1">Issue Type</p>
                        <p className="text-sm font-medium">{currentCall.entities.issueType}</p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Transcript */}
            <Separator />
            <Collapsible open={isTranscriptOpen} onOpenChange={setIsTranscriptOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between">
                  <span>View Transcript</span>
                  {isTranscriptOpen ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="rounded-lg bg-muted/50 p-5 max-h-64 overflow-y-auto">
                  <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
                    {currentCall.transcript}
                  </pre>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Actions */}
            <Separator />
            <div className="flex flex-col gap-3 pt-2">
              <Button onClick={() => setIsCallbackDialogOpen(true)} className="w-full h-11">
                <PhoneCall className="h-4 w-4 mr-2" />
                Create Callback Task
              </Button>
              <Button variant="outline" onClick={handleExportSummary} className="w-full h-11 bg-transparent">
                <Download className="h-4 w-4 mr-2" />
                Export Summary
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Callback Dialog */}
      <Dialog open={isCallbackDialogOpen} onOpenChange={setIsCallbackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Callback Task</DialogTitle>
            <DialogDescription>
              Schedule a callback for {currentCall.callerName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Call Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={callbackCallReason}
                onChange={(e) => setCallbackCallReason(e.target.value)}
                placeholder="e.g., Follow up after hearing test"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be passed to the AI agent as the call reason
              </p>
            </div>
            <div className="space-y-2">
              <Label>
                Call Goal <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={callbackCallGoal}
                onChange={(e) => setCallbackCallGoal(e.target.value)}
                placeholder="e.g., Schedule a hearing aid fitting"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be passed to the AI agent as the call goal
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallbackDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleCreateCallback}
              disabled={!callbackCallReason.trim() || !callbackCallGoal.trim()}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
