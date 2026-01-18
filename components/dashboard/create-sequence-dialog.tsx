'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { PatientTag, ProactiveSequence } from '@/lib/types'
import { toast } from 'sonner'
import Link from 'next/link'

export function CreateSequenceDialog() {
  const { addSequence } = useAppStore()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [audienceTag, setAudienceTag] = useState<PatientTag>('New Fit')

  const handleCreate = () => {
    const newSequence: ProactiveSequence = {
      id: `seq-${Date.now()}`,
      name,
      audienceTag,
      active: false,
      steps: [
        {
          day: 1,
          channel: 'call',
          goal: 'Initial check-in',
          script: `Hi {patient_name}, this is a courtesy call from your clinic. How are you doing today?`,
          questions: ['General satisfaction'],
          triggers: ['Any issues reported'],
        },
      ],
    }

    addSequence(newSequence)
    toast.success('Sequence Created', {
      description: `"${name}" has been created. Configure steps in Settings.`,
    })
    setOpen(false)
    setName('')
    setAudienceTag('New Fit')
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Create Proactive Check-in Sequence
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Check-in Sequence</DialogTitle>
          <DialogDescription>
            Set up a new proactive outreach sequence for patients.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Sequence Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., New Patient Week 2"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="audience">Target Audience</Label>
            <Select value={audienceTag} onValueChange={(v) => setAudienceTag(v as PatientTag)}>
              <SelectTrigger>
                <SelectValue placeholder="Select audience" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="New Fit">New Fit Patients</SelectItem>
                <SelectItem value="Existing">Existing Patients</SelectItem>
                <SelectItem value="High Risk">High Risk Patients</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={!name}>
            Create Sequence
          </Button>
        </DialogFooter>
        <p className="text-xs text-muted-foreground text-center">
          After creating, configure detailed steps in{' '}
          <Link href="/settings" className="text-primary hover:underline">
            Settings &rarr; Proactive Check-ins
          </Link>
        </p>
      </DialogContent>
    </Dialog>
  )
}
