'use client'

import React from "react"

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { CallbackTask, Patient } from '@/lib/types'
import { PhoneCall } from 'lucide-react'
import { useToast } from 'sonner' // Import useToast from sonner

interface ScheduleCallbackFormProps {
  patient: Patient
}

export function ScheduleCallbackForm({ patient }: ScheduleCallbackFormProps) {
  const { addCallbackTask, addActivityEvent, agentConfig } = useAppStore() // Declare useToast
  const [callReason, setCallReason] = useState('')
  const [callGoal, setCallGoal] = useState('')
  const [priority, setPriority] = useState<'high' | 'medium' | 'low'>('medium')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!callReason.trim() || !callGoal.trim()) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields: Call Reason and Call Goal.',
      })
      return
    }

    setIsSubmitting(true)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 500))

    const dueTime = priority === 'high' ? 60 * 60 * 1000 : priority === 'medium' ? 24 * 60 * 60 * 1000 : 48 * 60 * 60 * 1000

    const newTask: CallbackTask = {
      id: `task-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.name,
      phone: patient.phone,
      callReason: callReason.trim(),
      callGoal: callGoal.trim(),
      priority,
      status: 'pending',
      createdAt: new Date(),
      dueAt: new Date(Date.now() + dueTime),
      attempts: [],
      maxAttempts: agentConfig.callbackSettings.maxAttempts,
    }

    addCallbackTask(newTask)
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'callback',
      description: `Callback scheduled: ${callReason.trim()}`,
      timestamp: new Date(),
      patientName: patient.name,
      patientId: patient.id,
    })

    toast.success('Callback Scheduled', {
      description: `A ${priority} priority callback has been scheduled for ${patient.name}.`,
    })

    setCallReason('')
    setCallGoal('')
    setPriority('medium')
    setIsSubmitting(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <PhoneCall className="h-5 w-5" />
          Schedule Callback
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="callReason">
              Call Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="callReason"
              value={callReason}
              onChange={(e) => setCallReason(e.target.value)}
              placeholder="e.g., Follow up after hearing test"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be passed to the AI agent as the call reason
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="callGoal">
              Call Goal <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="callGoal"
              value={callGoal}
              onChange={(e) => setCallGoal(e.target.value)}
              placeholder="e.g., Schedule a hearing aid fitting"
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              This will be passed to the AI agent as the call goal
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="priority">Priority</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as typeof priority)}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Within 1 hour</SelectItem>
                <SelectItem value="medium">Medium - Within 24 hours</SelectItem>
                <SelectItem value="low">Low - Within 48 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={!callReason.trim() || !callGoal.trim() || isSubmitting}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Callback'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
