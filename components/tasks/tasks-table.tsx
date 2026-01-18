'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '@/lib/store'
import { formatDateTime, formatDistanceToNow, formatDuration } from '@/lib/format'
import { CallbackTask, CallbackAttempt, CallbackAttemptOutcome } from '@/lib/types'
import { triggerOutboundCall, CallDynamicVariables } from '@/lib/call-trigger'
import {
  Search,
  Plus,
  Phone,
  PhoneOff,
  PhoneMissed,
  Voicemail,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  User,
  RotateCcw,
  History,
  ArrowRight,
  Trash2,
} from 'lucide-react'
import Link from 'next/link'

const priorityConfig = {
  high: { label: 'High', color: 'bg-destructive/10 text-destructive', icon: AlertTriangle },
  medium: { label: 'Medium', color: 'bg-warning/10 text-warning', icon: Clock },
  low: { label: 'Low', color: 'bg-muted text-muted-foreground', icon: Clock },
}

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-warning/10 text-warning' },
  in_progress: { label: 'In Progress', color: 'bg-info/10 text-info' },
  completed: { label: 'Completed', color: 'bg-success/10 text-success' },
  cancelled: { label: 'Cancelled', color: 'bg-muted text-muted-foreground' },
  max_attempts_reached: { label: 'Max Attempts', color: 'bg-destructive/10 text-destructive' },
}

const outcomeConfig: Record<CallbackAttemptOutcome, { label: string; icon: typeof Phone; color: string }> = {
  answered: { label: 'Answered', icon: Phone, color: 'text-success' },
  voicemail: { label: 'Voicemail', icon: Voicemail, color: 'text-warning' },
  no_answer: { label: 'No Answer', icon: PhoneMissed, color: 'text-muted-foreground' },
  busy: { label: 'Busy', icon: PhoneOff, color: 'text-destructive' },
  wrong_number: { label: 'Wrong Number', icon: XCircle, color: 'text-destructive' },
}

export function TasksTable() {
  const { callbackTasks, patients, updateCallbackTask, addCallbackTask, removeCallbackTask, addActivityEvent, agentConfig } = useAppStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [newTaskPatientId, setNewTaskPatientId] = useState('')
  const [newTaskCallReason, setNewTaskCallReason] = useState('')
  const [newTaskCallGoal, setNewTaskCallGoal] = useState('')
  const [newTaskPriority, setNewTaskPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [newTaskMaxAttempts, setNewTaskMaxAttempts] = useState<number>(agentConfig.callbackSettings.maxAttempts)
  
  // Call choice dialog state
  const [isCallChoiceDialogOpen, setIsCallChoiceDialogOpen] = useState(false)
  const [callChoiceTask, setCallChoiceTask] = useState<CallbackTask | null>(null)
  
  // Redial dialog state
  const [isRedialDialogOpen, setIsRedialDialogOpen] = useState(false)
  const [redialTask, setRedialTask] = useState<CallbackTask | null>(null)
  const [redialOutcome, setRedialOutcome] = useState<CallbackAttemptOutcome>('no_answer')
  const [redialNotes, setRedialNotes] = useState('')
  const [redialDuration, setRedialDuration] = useState('')
  
  // AI call triggering state
  const [isTriggeringCall, setIsTriggeringCall] = useState(false)

  // Task detail sheet state
  const [selectedTask, setSelectedTask] = useState<CallbackTask | null>(null)
  
  // Delete confirmation dialog state
  const [taskToDelete, setTaskToDelete] = useState<CallbackTask | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState<'first' | 'second'>('first')

  const filteredTasks = callbackTasks.filter((task) => {
    const matchesSearch =
      task.patientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.callReason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.callGoal.toLowerCase().includes(searchQuery.toLowerCase())
    
    // Derive status for filtering
    const hasAnsweredAttempt = task.attempts.some(a => a.outcome === 'answered')
    const isExhausted = task.attempts.length >= task.maxAttempts && !hasAnsweredAttempt
    const hasAttempts = task.attempts.length > 0
    const derivedStatus: CallbackTask['status'] = hasAnsweredAttempt 
      ? 'completed' 
      : isExhausted 
      ? 'max_attempts_reached' 
      : hasAttempts 
      ? 'in_progress' 
      : 'pending'
    
    const matchesStatus = statusFilter === 'all' || derivedStatus === statusFilter
    const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter
    return matchesSearch && matchesStatus && matchesPriority
  })

  const handleStatusChange = (taskId: string, newStatus: CallbackTask['status']) => {
    const task = callbackTasks.find((t) => t.id === taskId)
    if (!task) return

    updateCallbackTask(taskId, { status: newStatus })
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'callback',
      description: `Callback task ${newStatus === 'completed' ? 'completed' : newStatus === 'cancelled' ? 'cancelled' : 'updated'}`,
      timestamp: new Date(),
      patientName: task.patientName,
      patientId: task.patientId,
    })

    toast.success('Task Updated', {
      description: `Task has been marked as ${newStatus.replace('_', ' ')}.`,
    })
  }

  const handleLogRedial = () => {
    if (!redialTask) return

    const newAttempt: CallbackAttempt = {
      attemptNumber: redialTask.attempts.length + 1,
      timestamp: new Date(),
      outcome: redialOutcome,
      notes: redialNotes || undefined,
      durationSec: redialDuration ? parseInt(redialDuration) * 60 : undefined,
    }

    const updatedAttempts = [...redialTask.attempts, newAttempt]
    const maxAttempts = redialTask.maxAttempts || agentConfig.callbackSettings.maxAttempts

    let newStatus: CallbackTask['status'] = 'in_progress'
    let nextAttemptAt: Date | undefined

    if (redialOutcome === 'answered') {
      newStatus = 'completed'
    } else if (redialOutcome === 'wrong_number') {
      newStatus = 'cancelled'
    } else if (updatedAttempts.length >= maxAttempts) {
      newStatus = 'max_attempts_reached'
    } else {
      // Schedule next attempt
      nextAttemptAt = new Date(Date.now() + agentConfig.callbackSettings.redialIntervalMinutes * 60 * 1000)
    }

    updateCallbackTask(redialTask.id, {
      attempts: updatedAttempts,
      status: newStatus,
      nextAttemptAt,
    })

    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'callback',
      description: `Callback attempt ${newAttempt.attemptNumber}: ${outcomeConfig[redialOutcome].label}${newStatus === 'completed' ? ' - Task completed' : newStatus === 'max_attempts_reached' ? ' - Max attempts reached' : ''}`,
      timestamp: new Date(),
      patientName: redialTask.patientName,
      patientId: redialTask.patientId,
    })

    toast.success('Attempt Logged', {
      description: newStatus === 'completed' 
        ? 'Call answered - task completed!' 
        : newStatus === 'max_attempts_reached'
        ? 'Maximum attempts reached for this task.'
        : `Attempt ${newAttempt.attemptNumber} logged. Next attempt scheduled.`,
    })

    setIsRedialDialogOpen(false)
    setRedialTask(null)
    setRedialOutcome('no_answer')
    setRedialNotes('')
    setRedialDuration('')
  }

  const handleCreateTask = () => {
    if (!newTaskPatientId || !newTaskCallReason.trim() || !newTaskCallGoal.trim()) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields: Patient, Call Reason, and Call Goal.',
      })
      return
    }

    const patient = patients.find((p) => p.id === newTaskPatientId)
    if (!patient) return

    const newTask: CallbackTask = {
      id: `task-${Date.now()}`,
      patientId: newTaskPatientId,
      patientName: patient.name,
      phone: patient.phone,
      callReason: newTaskCallReason.trim(),
      callGoal: newTaskCallGoal.trim(),
      priority: newTaskPriority,
      status: 'pending',
      createdAt: new Date(),
      dueAt: new Date(Date.now() + (newTaskPriority === 'high' ? 60 * 60 * 1000 : newTaskPriority === 'medium' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000)),
      attempts: [],
      maxAttempts: newTaskMaxAttempts,
    }

    addCallbackTask(newTask)
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'callback',
      description: `Callback task created: ${newTaskCallReason.trim()}`,
      timestamp: new Date(),
      patientName: patient.name,
      patientId: patient.id,
    })

    toast.success('Task Created', {
      description: `Callback task created for ${patient.name}.`,
    })

    setIsCreateDialogOpen(false)
    setNewTaskPatientId('')
    setNewTaskCallReason('')
    setNewTaskCallGoal('')
    setNewTaskPriority('medium')
    setNewTaskMaxAttempts(agentConfig.callbackSettings.maxAttempts)
  }
  
  const handleDeleteTask = (task: CallbackTask) => {
    setTaskToDelete(task)
    setDeleteConfirmStep('first')
    setIsDeleteConfirmOpen(true)
  }
  
  const handleConfirmDelete = () => {
    if (!taskToDelete) return
    
    if (deleteConfirmStep === 'first') {
      setDeleteConfirmStep('second')
    } else {
      removeCallbackTask(taskToDelete.id)
      addActivityEvent({
        id: `event-${Date.now()}`,
        type: 'callback',
        description: `Callback task deleted: ${taskToDelete.callReason}`,
        timestamp: new Date(),
        patientName: taskToDelete.patientName,
        patientId: taskToDelete.patientId,
      })
      toast.success('Task Deleted', {
        description: `Callback task for ${taskToDelete.patientName} has been removed.`,
      })
      setIsDeleteConfirmOpen(false)
      setTaskToDelete(null)
      setDeleteConfirmStep('first')
    }
  }

  const openCallChoiceDialog = (task: CallbackTask) => {
    setCallChoiceTask(task)
    setIsCallChoiceDialogOpen(true)
  }

  const openRedialDialog = (task: CallbackTask) => {
    setRedialTask(task)
    setIsRedialDialogOpen(true)
    setIsCallChoiceDialogOpen(false)
  }

  const handleTriggerAICall = async () => {
    const outboundAgentId = agentConfig.elevenLabsOutboundAgentId || agentConfig.elevenLabsAgentId
    if (!callChoiceTask || !outboundAgentId || !agentConfig.elevenLabsPhoneNumberId) {
      toast.error('Configuration Error', {
        description: 'Eleven Labs outbound agent not configured. Please configure in Settings.',
      })
      setIsCallChoiceDialogOpen(false)
      return
    }

    setIsTriggeringCall(true)

    try {
      // Prepare dynamic variables using stored values (required fields)
      const dynamicVars: CallDynamicVariables = {
        patient_name: callChoiceTask.patientName,
        clinic_name: agentConfig.clinicName,
        call_reason: callChoiceTask.callReason,
        call_goal: callChoiceTask.callGoal,
      }

      const result = await triggerOutboundCall(
        callChoiceTask.phone,
        outboundAgentId,
        agentConfig.elevenLabsPhoneNumberId,
        dynamicVars
      )

      if (result.success) {
        // Get current task to access attempts array
        const currentTask = callbackTasks.find(t => t.id === callChoiceTask.id)
        if (!currentTask) return

        // Create new attempt record for the triggered call
        const newAttempt: CallbackAttempt = {
          attemptNumber: currentTask.attempts.length + 1,
          timestamp: new Date(),
          outcome: 'answered', // AI call was successfully initiated
          notes: `AI call triggered via Eleven Labs. Conversation ID: ${result.conversation_id}`,
        }

        const updatedAttempts = [...currentTask.attempts, newAttempt]
        
        // Check if max attempts reached
        let newStatus: CallbackTask['status'] = 'in_progress'
        if (updatedAttempts.length >= currentTask.maxAttempts) {
          newStatus = 'max_attempts_reached'
        }

        // Mark task as in_progress (or max_attempts_reached) and add attempt
        updateCallbackTask(callChoiceTask.id, { 
          status: newStatus,
          attempts: updatedAttempts,
          conversationId: result.conversation_id, // Store conversation_id for webhook matching
        })

        // Add activity event
        addActivityEvent({
          id: `event-${Date.now()}`,
          type: 'callback',
          description: `AI call triggered for ${callChoiceTask.patientName}`,
          timestamp: new Date(),
          patientName: callChoiceTask.patientName,
          patientId: callChoiceTask.patientId,
        })

        toast.success('Call Triggered', {
          description: `AI call initiated for ${callChoiceTask.patientName}. Conversation ID: ${result.conversation_id}`,
        })

        setIsCallChoiceDialogOpen(false)
        setCallChoiceTask(null)
      } else {
        toast.error('Call Failed', {
          description: result.error || 'Failed to trigger AI call',
        })
      }
    } catch (error) {
      console.error('Error triggering AI call:', error)
      toast.error('Call Failed', {
        description: 'An error occurred while triggering the call',
      })
    } finally {
      setIsTriggeringCall(false)
    }
  }

  // Derive counts from attempts instead of stored status
  const pendingCount = callbackTasks.filter((t) => {
    const hasAnswered = t.attempts.some(a => a.outcome === 'answered')
    const isExhausted = t.attempts.length >= t.maxAttempts && !hasAnswered
    return !hasAnswered && !isExhausted
  }).length
  const highPriorityCount = callbackTasks.filter((t) => {
    const hasAnswered = t.attempts.some(a => a.outcome === 'answered')
    const isExhausted = t.attempts.length >= t.maxAttempts && !hasAnswered
    return !hasAnswered && !isExhausted && t.priority === 'high'
  }).length
  const maxAttemptsCount = callbackTasks.filter((t) => {
    const hasAnswered = t.attempts.some(a => a.outcome === 'answered')
    return t.attempts.length >= t.maxAttempts && !hasAnswered
  }).length

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
                <Clock className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{pendingCount}</p>
                <p className="text-sm text-muted-foreground">Active Tasks</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{highPriorityCount}</p>
                <p className="text-sm text-muted-foreground">High Priority</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <PhoneMissed className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p className="text-2xl font-bold">{maxAttemptsCount}</p>
                <p className="text-sm text-muted-foreground">Max Attempts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {callbackTasks.filter((t) => t.attempts.some(a => a.outcome === 'answered')).length}
                </p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Create Button */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Callback Tasks</CardTitle>
              <CardDescription>
                Track and manage patient callback attempts. Max {agentConfig.callbackSettings.maxAttempts} attempts, {agentConfig.callbackSettings.redialIntervalMinutes} min between calls.
              </CardDescription>
            </div>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Callback Task</DialogTitle>
                  <DialogDescription>
                    Schedule a new callback task for a patient.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>
                      Patient <span className="text-destructive">*</span>
                    </Label>
                    <Select value={newTaskPatientId} onValueChange={setNewTaskPatientId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a patient" />
                      </SelectTrigger>
                      <SelectContent>
                        {patients.map((patient) => (
                          <SelectItem key={patient.id} value={patient.id}>
                            {patient.name} - {patient.phone}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Call Reason <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      value={newTaskCallReason}
                      onChange={(e) => setNewTaskCallReason(e.target.value)}
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
                      value={newTaskCallGoal}
                      onChange={(e) => setNewTaskCallGoal(e.target.value)}
                      placeholder="e.g., Schedule a hearing aid fitting"
                      rows={3}
                    />
                    <p className="text-xs text-muted-foreground">
                      This will be passed to the AI agent as the call goal
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <Select value={newTaskPriority} onValueChange={(v) => setNewTaskPriority(v as typeof newTaskPriority)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="high">High - Within 1 hour</SelectItem>
                        <SelectItem value="medium">Medium - Within 24 hours</SelectItem>
                        <SelectItem value="low">Low - Within 48 hours</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Max Attempts
                    </Label>
                    <Input
                      type="number"
                      min="1"
                      max="10"
                      value={newTaskMaxAttempts}
                      onChange={(e) => {
                        const value = parseInt(e.target.value)
                        if (!isNaN(value) && value >= 1 && value <= 10) {
                          setNewTaskMaxAttempts(value)
                        }
                      }}
                      placeholder={`Default: ${agentConfig.callbackSettings.maxAttempts}`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Maximum number of call attempts before task is marked as exhausted (1-10)
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    onClick={handleCreateTask} 
                    disabled={!newTaskPatientId || !newTaskCallReason.trim() || !newTaskCallGoal.trim()}
                  >
                    Create Task
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col gap-4 mb-6 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
                <SelectItem value="max_attempts_reached">Max Attempts</SelectItem>
              </SelectContent>
            </Select>
            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-full sm:w-[150px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead>Attempts</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead className="hidden lg:table-cell">Next Action</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center">
                      No tasks found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTasks.map((task) => {
                    const priority = priorityConfig[task.priority]
                    // Derive status from attempts instead of stored status
                    const hasAnsweredAttempt = task.attempts.some(a => a.outcome === 'answered')
                    const isExhausted = task.attempts.length >= task.maxAttempts && !hasAnsweredAttempt
                    const hasAttempts = task.attempts.length > 0
                    
                    let derivedStatus: CallbackTask['status']
                    if (hasAnsweredAttempt) {
                      derivedStatus = 'completed'
                    } else if (isExhausted) {
                      derivedStatus = 'max_attempts_reached'
                    } else if (hasAttempts) {
                      derivedStatus = 'in_progress'
                    } else {
                      derivedStatus = 'pending'
                    }
                    
                    const status = statusConfig[derivedStatus]
                    const isOverdue = task.dueAt && (derivedStatus === 'pending' || derivedStatus === 'in_progress') && new Date(task.dueAt) < new Date()
                    const canRedial = (derivedStatus === 'pending' || derivedStatus === 'in_progress') && task.attempts.length < task.maxAttempts

                    return (
                      <TableRow 
                        key={task.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => setSelectedTask(task)}
                      >
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{task.patientName}</span>
                            <span className="text-xs text-muted-foreground">{task.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-xs">
                          <p className="truncate text-sm">{task.callReason}</p>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{task.attempts.length}</span>
                            <span className="text-muted-foreground">/</span>
                            <span className="text-muted-foreground">{task.maxAttempts}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={priority.color}>{priority.label}</Badge>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {task.nextAttemptAt && (derivedStatus === 'pending' || derivedStatus === 'in_progress') ? (
                            <span className={`text-sm ${new Date(task.nextAttemptAt) < new Date() ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                              {new Date(task.nextAttemptAt) < new Date() ? 'Due now' : formatDistanceToNow(task.nextAttemptAt)}
                            </span>
                          ) : isOverdue ? (
                            <span className="text-sm text-destructive font-medium">Overdue</span>
                          ) : derivedStatus === 'completed' ? (
                            <Badge className={status.color}>{status.label}</Badge>
                          ) : derivedStatus === 'max_attempts_reached' ? (
                            <Badge className={status.color}>{status.label}</Badge>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                            {canRedial && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => openCallChoiceDialog(task)}
                                className="h-8"
                              >
                                <Phone className="h-4 w-4 mr-1" />
                                Call
                              </Button>
                            )}
                            {/* Status is now derived from attempts - no manual complete button needed */}
                            {/* Delete button for all tasks */}
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteTask(task)
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                              title="Delete Task"
                            >
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                            
                            {/* Reopen button for completed tasks (if needed) */}
                            {derivedStatus === 'completed' && (
                              <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={(e) => {
                                  e.stopPropagation()
                                  // Remove the answered attempt to reopen
                                  const updatedAttempts = task.attempts.filter(a => a.outcome !== 'answered')
                                  updateCallbackTask(task.id, { attempts: updatedAttempts })
                                }}
                                className="h-8 w-8 p-0"
                                title="Reopen Task"
                              >
                                <RotateCcw className="h-4 w-4" />
                                <span className="sr-only">Reopen</span>
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Call Choice Dialog */}
      <Dialog open={isCallChoiceDialogOpen} onOpenChange={setIsCallChoiceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Choose Call Type</DialogTitle>
            <DialogDescription>
              {callChoiceTask && (
                <>
                  How would you like to handle the call for {callChoiceTask.patientName}?
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <Button
              onClick={handleTriggerAICall}
              disabled={isTriggeringCall}
              className="w-full h-12 justify-start"
              variant="default"
            >
              <Phone className="h-5 w-5 mr-3" />
              <div className="flex flex-col items-start">
                <span className="font-medium">Trigger AI Call Immediately</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Use Eleven Labs to automatically call the patient
                </span>
              </div>
            </Button>
            <Button
              onClick={() => callChoiceTask && openRedialDialog(callChoiceTask)}
              className="w-full h-12 justify-start"
              variant="outline"
            >
              <Phone className="h-5 w-5 mr-3" />
              <div className="flex flex-col items-start">
                <span className="font-medium">Log Human Call Details</span>
                <span className="text-xs text-muted-foreground font-normal">
                  Record details of a call you made manually
                </span>
              </div>
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallChoiceDialogOpen(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Redial Dialog */}
      <Dialog open={isRedialDialogOpen} onOpenChange={setIsRedialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log Call Attempt</DialogTitle>
            <DialogDescription>
              {redialTask && (
                <>
                  Calling {redialTask.patientName} at {redialTask.phone}
                  <br />
                  This will be attempt {redialTask.attempts.length + 1} of {redialTask.maxAttempts}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Call Outcome</Label>
              <Select value={redialOutcome} onValueChange={(v) => setRedialOutcome(v as CallbackAttemptOutcome)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered - Patient reached</SelectItem>
                  <SelectItem value="voicemail">Voicemail - Left message</SelectItem>
                  <SelectItem value="no_answer">No Answer - Ring, no pickup</SelectItem>
                  <SelectItem value="busy">Busy - Line busy</SelectItem>
                  <SelectItem value="wrong_number">Wrong Number</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {redialOutcome === 'answered' && (
              <div className="space-y-2">
                <Label>Call Duration (minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  value={redialDuration}
                  onChange={(e) => setRedialDuration(e.target.value)}
                  placeholder="e.g., 5"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                value={redialNotes}
                onChange={(e) => setRedialNotes(e.target.value)}
                placeholder="Any notes about this call attempt..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRedialDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleLogRedial}>
              Log Attempt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={(open) => {
        if (!open) {
          setIsDeleteConfirmOpen(false)
          setTaskToDelete(null)
          setDeleteConfirmStep('first')
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              {deleteConfirmStep === 'first' ? 'Delete Task?' : 'Confirm Deletion'}
            </DialogTitle>
            <DialogDescription>
              {deleteConfirmStep === 'first' ? (
                <>
                  Are you sure you want to delete this callback task for {taskToDelete?.patientName}?
                  <br />
                  <br />
                  This action cannot be undone. Click "Continue" to proceed to final confirmation.
                </>
              ) : (
                <>
                  <strong>Final confirmation required.</strong>
                  <br />
                  <br />
                  This will permanently delete the callback task for {taskToDelete?.patientName}.
                  <br />
                  <br />
                  Task: {taskToDelete?.callReason}
                  <br />
                  Attempts: {taskToDelete?.attempts.length} / {taskToDelete?.maxAttempts}
                  <br />
                  <br />
                  This action cannot be undone.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setIsDeleteConfirmOpen(false)
                setTaskToDelete(null)
                setDeleteConfirmStep('first')
              }}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleConfirmDelete}
            >
              {deleteConfirmStep === 'first' ? 'Continue' : 'Delete Permanently'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Detail Sheet */}
      <Sheet open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selectedTask && (() => {
            // Get the latest task from the store to ensure we have up-to-date data
            const currentTask = callbackTasks.find(t => t.id === selectedTask.id) || selectedTask
            return (
            <>
              <SheetHeader className="px-6 pt-6 pb-4">
                <SheetTitle>Task Details</SheetTitle>
                <SheetDescription>
                  Callback task for {currentTask.patientName}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6 px-6 pb-6">
                {/* Patient Info */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Patient Information</h4>
                  <div className="grid gap-3">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-muted-foreground">Name</span>
                      <Link href={`/patients/${currentTask.patientId}`} className="text-sm font-medium text-primary hover:underline">
                        {currentTask.patientName}
                      </Link>
                    </div>
                    <div className="flex justify-between items-center py-1">
                      <span className="text-sm text-muted-foreground">Phone</span>
                      <span className="text-sm font-medium">{currentTask.phone}</span>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Task Info */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-muted-foreground">Task Details</h4>
                  <div className="space-y-3">
                    <p className="text-sm leading-relaxed">{currentTask.callReason}</p>
                    <div className="flex gap-2">
                      <Badge className={priorityConfig[currentTask.priority].color}>
                        {priorityConfig[currentTask.priority].label} Priority
                      </Badge>
                      {(() => {
                        const hasAnswered = currentTask.attempts.some(a => a.outcome === 'answered')
                        const isExhausted = currentTask.attempts.length >= currentTask.maxAttempts && !hasAnswered
                        const hasAttempts = currentTask.attempts.length > 0
                        const derivedStatus: CallbackTask['status'] = hasAnswered 
                          ? 'completed' 
                          : isExhausted 
                          ? 'max_attempts_reached' 
                          : hasAttempts 
                          ? 'in_progress' 
                          : 'pending'
                        return (
                          <Badge className={statusConfig[derivedStatus].color}>
                            {statusConfig[derivedStatus].label}
                          </Badge>
                        )
                      })()}
                    </div>
                  </div>
                  <div className="grid gap-3 text-sm pt-2">
                    <div className="flex justify-between items-center py-1">
                      <span className="text-muted-foreground">Created</span>
                      <span className="font-medium">{formatDateTime(currentTask.createdAt)}</span>
                    </div>
                    {currentTask.dueAt && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">Due</span>
                        <span className="font-medium">{formatDateTime(currentTask.dueAt)}</span>
                      </div>
                    )}
                    {currentTask.callId && (
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground">Related Call</span>
                        <Link href="/calls" className="text-primary hover:underline font-medium">
                          View Call
                        </Link>
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                {/* Attempt History */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm text-muted-foreground flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Attempt History
                    </h4>
                    <span className="text-sm text-muted-foreground">
                      {currentTask.attempts.length} / {currentTask.maxAttempts} attempts
                    </span>
                  </div>

                  {currentTask.attempts.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-2">No attempts yet</p>
                  ) : (
                    <div className="space-y-3">
                      {currentTask.attempts.map((attempt, index) => {
                        const config = outcomeConfig[attempt.outcome]
                        const Icon = config.icon
                        return (
                          <div key={index} className="flex gap-4 p-4 rounded-lg bg-muted/50">
                            <div className={`flex-shrink-0 ${config.color}`}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">Attempt {attempt.attemptNumber}</span>
                                <span className="text-xs text-muted-foreground">
                                  {formatDistanceToNow(attempt.timestamp)}
                                </span>
                              </div>
                              <p className="text-sm">{config.label}</p>
                              {attempt.durationSec && (
                                <p className="text-xs text-muted-foreground">
                                  Duration: {formatDuration(attempt.durationSec)}
                                </p>
                              )}
                              {attempt.notes && (
                                <p className="text-sm text-muted-foreground leading-relaxed">{attempt.notes}</p>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <Separator />
                <div className="flex flex-col gap-3 pt-2">
                  {(() => {
                    const hasAnswered = currentTask.attempts.some(a => a.outcome === 'answered')
                    const isExhausted = currentTask.attempts.length >= currentTask.maxAttempts && !hasAnswered
                    const isActive = !hasAnswered && !isExhausted
                    
                    return (
                      <>
                        {isActive && (
                          <Button 
                            className="w-full h-11" 
                            onClick={() => {
                              openCallChoiceDialog(currentTask)
                              setSelectedTask(null)
                            }}
                            disabled={currentTask.attempts.length >= currentTask.maxAttempts}
                          >
                            <Phone className="h-4 w-4 mr-2" />
                            Call
                          </Button>
                        )}
                        
                        {/* Delete button for all tasks */}
                        <Button 
                          variant="destructive" 
                          className="w-full h-11" 
                          onClick={() => {
                            handleDeleteTask(currentTask)
                            setSelectedTask(null)
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete Task
                        </Button>
                        
                        {isExhausted && (
                          <p className="text-xs text-muted-foreground text-center">
                            This task has reached the maximum number of attempts.
                          </p>
                        )}
                        {hasAnswered && (
                          <p className="text-xs text-success text-center">
                            Task completed - call was answered.
                          </p>
                        )}
                      </>
                    )
                  })()}
                </div>

                <div className="pt-2">
                  <Button variant="outline" asChild className="w-full h-11 bg-transparent">
                    <Link href={`/patients/${currentTask.patientId}`}>
                      <User className="h-4 w-4 mr-2" />
                      View Patient Profile
                      <ArrowRight className="h-4 w-4 ml-auto" />
                    </Link>
                  </Button>
                </div>
              </div>
            </>
            )
          })()}
        </SheetContent>
      </Sheet>
    </div>
  )
}
