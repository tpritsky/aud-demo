'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from '@/lib/format'
import { PhoneCall as PhoneCallback, AlertTriangle } from 'lucide-react'
import { Patient, CallbackTask } from '@/lib/types'
import { toast } from 'sonner'

export function HighRiskPatients() {
  const { patients, addCallbackTask, addActivityEvent, agentConfig } = useAppStore()
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null)
  const [callReason, setCallReason] = useState('')
  const [callGoal, setCallGoal] = useState('')
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  const highRiskPatients = patients
    .filter((p) => p.riskScore >= 50)
    .sort((a, b) => b.riskScore - a.riskScore)

  const handleScheduleCallback = (patient: Patient) => {
    setSelectedPatient(patient)
    setCallReason('Follow up after hearing test')
    setCallGoal('Address patient concerns and schedule follow-up')
    setIsDialogOpen(true)
  }

  const handleConfirmCallback = async () => {
    if (!selectedPatient || !callReason.trim() || !callGoal.trim()) {
      toast.error('Validation Error', {
        description: 'Please fill in Call Reason and Call Goal fields.',
      })
      return
    }

    try {
      const priority = selectedPatient.riskScore >= 70 ? 'high' : 'medium'
      const dueTime = priority === 'high' ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000

      const newTask: CallbackTask = {
        id: `task-${Date.now()}`,
        patientId: selectedPatient.id,
        patientName: selectedPatient.name,
        phone: selectedPatient.phone,
        callReason: callReason.trim(),
        callGoal: callGoal.trim(),
        priority,
        status: 'pending',
        createdAt: new Date(),
        dueAt: new Date(Date.now() + dueTime),
        attempts: [],
        maxAttempts: agentConfig.callbackSettings.maxAttempts,
      }

      await addCallbackTask(newTask)
      // Activity event is created by the store function

      setIsDialogOpen(false)
      setSelectedPatient(null)
      setCallReason('')
      setCallGoal('')
    } catch (error) {
      console.error('Error creating callback task:', error)
      toast.error('Failed to create callback task', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred',
      })
    }
  }

  const getRiskBadgeVariant = (score: number) => {
    if (score >= 70) return 'destructive'
    if (score >= 50) return 'secondary'
    return 'outline'
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning" />
            <CardTitle className="text-base font-semibold">High-Risk Patients</CardTitle>
          </div>
          <Badge variant="secondary">{highRiskPatients.length} patients</Badge>
        </CardHeader>
        <CardContent>
          {highRiskPatients.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No high-risk patients at this time
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Patient</TableHead>
                  <TableHead>Risk Score</TableHead>
                  <TableHead className="hidden md:table-cell">Reason</TableHead>
                  <TableHead className="hidden sm:table-cell">Last Contact</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {highRiskPatients.map((patient) => (
                  <TableRow key={patient.id}>
                    <TableCell className="font-medium">{patient.name}</TableCell>
                    <TableCell>
                      <Badge variant={getRiskBadgeVariant(patient.riskScore)}>
                        {patient.riskScore}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="text-sm text-muted-foreground line-clamp-1">
                        {patient.riskReasons.join(', ')}
                      </span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {formatDistanceToNow(patient.lastContactAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleScheduleCallback(patient)}
                      >
                        <PhoneCallback className="h-4 w-4 mr-1" />
                        <span className="hidden sm:inline">Schedule Callback</span>
                        <span className="sm:hidden">Call</span>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Callback</DialogTitle>
            <DialogDescription>
              Create a callback task for {selectedPatient?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>
                Call Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
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
              <Label>
                Call Goal <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={callGoal}
                onChange={(e) => setCallGoal(e.target.value)}
                placeholder="e.g., Schedule a hearing aid fitting"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                This will be passed to the AI agent as the call goal
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleConfirmCallback}
              disabled={!callReason.trim() || !callGoal.trim()}
            >
              Create Task
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
