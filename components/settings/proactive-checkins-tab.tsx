'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
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
} from '@/components/ui/dialog'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Checkbox } from '@/components/ui/checkbox'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { ProactiveSequence, SequenceStep, Channel, PatientTag } from '@/lib/types'
import {
  Plus,
  Phone,
  MessageSquare,
  Edit,
  Eye,
  Trash2,
  Calendar,
} from 'lucide-react'
// useToast not needed - using toast directly from sonner

const questionOptions = [
  'Wore today?',
  'Hours worn',
  'Comfort issues',
  'Sound clarity issues',
  'Bluetooth issues',
  'General satisfaction',
  'Additional concerns',
]

const triggerOptions = [
  'Not wearing',
  'Significant discomfort',
  'Pain or discomfort',
  'Less than 4 hours daily',
  'Usage below 6 hours',
  'Any issues reported',
  'Requests call',
  'Issue not resolved',
  'New concerns',
  'Multiple issues reported',
]

const goalOptions = [
  'Initial check-in',
  'Comfort and usage check',
  'Quick check-in',
  'Week summary',
  'Monthly wellness check',
  'Immediate outreach',
  'Follow-up resolution',
]

export function ProactiveCheckInsTab() {
  const { sequences, updateSequence, addSequence } = useAppStore()
  const [isEditing, setIsEditing] = useState<string | null>(null)
  const [isPreviewing, setIsPreviewing] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newSequence, setNewSequence] = useState<Partial<ProactiveSequence>>({
    name: '',
    audienceTag: 'New Fit',
    steps: [],
  })

  const handleToggleActive = (sequence: ProactiveSequence) => {
    updateSequence(sequence.id, { active: !sequence.active })
    toast.success(sequence.active ? 'Sequence Deactivated' : 'Sequence Activated', {
      description: `"${sequence.name}" is now ${sequence.active ? 'inactive' : 'active'}.`,
    })
  }

  const handleCreateSequence = () => {
    if (!newSequence.name) return

    const sequence: ProactiveSequence = {
      id: `seq-${Date.now()}`,
      name: newSequence.name,
      audienceTag: newSequence.audienceTag || 'New Fit',
      active: false,
      steps: newSequence.steps || [],
    }

    addSequence(sequence)
    toast.success('Sequence Created', {
      description: `"${sequence.name}" has been created.`,
    })
    setIsCreating(false)
    setNewSequence({ name: '', audienceTag: 'New Fit', steps: [] })
  }

  const handleAddStep = (sequenceId: string) => {
    const sequence = sequences.find((s) => s.id === sequenceId)
    if (!sequence) return

    const newStep: SequenceStep = {
      day: (sequence.steps.length > 0 ? Math.max(...sequence.steps.map((s) => s.day)) : 0) + 1,
      channel: 'call',
      goal: 'Initial check-in',
      script: 'Hi {patient_name}, this is a courtesy call from your clinic.',
      questions: [],
      triggers: [],
    }

    updateSequence(sequenceId, { steps: [...sequence.steps, newStep] })
  }

  const handleUpdateStep = (
    sequenceId: string,
    stepIndex: number,
    updates: Partial<SequenceStep>
  ) => {
    const sequence = sequences.find((s) => s.id === sequenceId)
    if (!sequence) return

    const newSteps = sequence.steps.map((step, i) =>
      i === stepIndex ? { ...step, ...updates } : step
    )
    updateSequence(sequenceId, { steps: newSteps })
  }

  const handleDeleteStep = (sequenceId: string, stepIndex: number) => {
    const sequence = sequences.find((s) => s.id === sequenceId)
    if (!sequence) return

    const newSteps = sequence.steps.filter((_, i) => i !== stepIndex)
    updateSequence(sequenceId, { steps: newSteps })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Check-in Sequences</h3>
          <p className="text-sm text-muted-foreground">
            Configure automated outreach sequences for different patient groups.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New Sequence
        </Button>
      </div>

      {/* Sequences List */}
      {sequences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground mb-4">No sequences configured yet.</p>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Sequence
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sequences.map((sequence) => (
            <Card key={sequence.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      {sequence.name}
                      <Badge className={getTagColor(sequence.audienceTag)}>
                        {sequence.audienceTag}
                      </Badge>
                    </CardTitle>
                    <CardDescription>
                      {sequence.steps.length} steps over{' '}
                      {Math.max(...sequence.steps.map((s) => s.day), 0)} days
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={sequence.active}
                      onCheckedChange={() => handleToggleActive(sequence)}
                    />
                    <Badge variant={sequence.active ? 'default' : 'secondary'}>
                      {sequence.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {/* Steps Editor */}
                {isEditing === sequence.id ? (
                  <div className="space-y-4">
                    <Accordion type="single" collapsible className="w-full">
                      {sequence.steps.map((step, index) => (
                        <AccordionItem key={index} value={`step-${index}`}>
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline">Day {step.day}</Badge>
                              {step.channel === 'call' ? (
                                <Phone className="h-4 w-4" />
                              ) : (
                                <MessageSquare className="h-4 w-4" />
                              )}
                              <span className="text-sm">{step.goal}</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-4 pt-2">
                              <div className="grid gap-4 sm:grid-cols-3">
                                <div className="space-y-2">
                                  <Label>Day</Label>
                                  <Input
                                    type="number"
                                    min="1"
                                    value={step.day}
                                    onChange={(e) =>
                                      handleUpdateStep(sequence.id, index, {
                                        day: parseInt(e.target.value) || 1,
                                      })
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Channel</Label>
                                  <Select
                                    value={step.channel}
                                    onValueChange={(v) =>
                                      handleUpdateStep(sequence.id, index, {
                                        channel: v as Channel,
                                      })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="call">Phone Call</SelectItem>
                                      <SelectItem value="sms">SMS</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Goal</Label>
                                  <Select
                                    value={step.goal}
                                    onValueChange={(v) =>
                                      handleUpdateStep(sequence.id, index, { goal: v })
                                    }
                                  >
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {goalOptions.map((goal) => (
                                        <SelectItem key={goal} value={goal}>
                                          {goal}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label>Script</Label>
                                <Textarea
                                  value={step.script}
                                  onChange={(e) =>
                                    handleUpdateStep(sequence.id, index, {
                                      script: e.target.value,
                                    })
                                  }
                                  rows={3}
                                  placeholder="Use {patient_name} for personalization"
                                />
                              </div>

                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                  <Label>Questions to Collect</Label>
                                  <div className="space-y-2 rounded-lg border p-3">
                                    {questionOptions.map((q) => (
                                      <div key={q} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`q-${index}-${q}`}
                                          checked={step.questions.includes(q)}
                                          onCheckedChange={(checked) => {
                                            const questions = checked
                                              ? [...step.questions, q]
                                              : step.questions.filter((x) => x !== q)
                                            handleUpdateStep(sequence.id, index, { questions })
                                          }}
                                        />
                                        <label
                                          htmlFor={`q-${index}-${q}`}
                                          className="text-sm"
                                        >
                                          {q}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="space-y-2">
                                  <Label>Escalation Triggers</Label>
                                  <div className="space-y-2 rounded-lg border p-3 max-h-48 overflow-y-auto">
                                    {triggerOptions.map((t) => (
                                      <div key={t} className="flex items-center gap-2">
                                        <Checkbox
                                          id={`t-${index}-${t}`}
                                          checked={step.triggers.includes(t)}
                                          onCheckedChange={(checked) => {
                                            const triggers = checked
                                              ? [...step.triggers, t]
                                              : step.triggers.filter((x) => x !== t)
                                            handleUpdateStep(sequence.id, index, { triggers })
                                          }}
                                        />
                                        <label
                                          htmlFor={`t-${index}-${t}`}
                                          className="text-sm"
                                        >
                                          {t}
                                        </label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>

                              <div className="flex justify-end">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteStep(sequence.id, index)}
                                >
                                  <Trash2 className="h-4 w-4 mr-1" />
                                  Delete Step
                                </Button>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>

                    <div className="flex items-center justify-between pt-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleAddStep(sequence.id)}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Step
                      </Button>
                      <Button size="sm" onClick={() => setIsEditing(null)}>
                        Done Editing
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Steps Preview */}
                    <div className="flex flex-wrap gap-2">
                      {sequence.steps.map((step, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm"
                        >
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span>Day {step.day}</span>
                          {step.channel === 'call' ? (
                            <Phone className="h-4 w-4" />
                          ) : (
                            <MessageSquare className="h-4 w-4" />
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(sequence.id)}
                      >
                        <Edit className="h-4 w-4 mr-1" />
                        Edit Steps
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsPreviewing(sequence.id)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        Preview
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Sequence Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Sequence</DialogTitle>
            <DialogDescription>
              Set up a new proactive check-in sequence for a patient group.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Sequence Name</Label>
              <Input
                value={newSequence.name}
                onChange={(e) => setNewSequence({ ...newSequence, name: e.target.value })}
                placeholder="e.g., New Patient Month 1"
              />
            </div>
            <div className="space-y-2">
              <Label>Target Audience</Label>
              <Select
                value={newSequence.audienceTag}
                onValueChange={(v) =>
                  setNewSequence({ ...newSequence, audienceTag: v as PatientTag })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="New Fit">New Fit Patients</SelectItem>
                  <SelectItem value="Existing">Existing Patients</SelectItem>
                  <SelectItem value="High Risk">High Risk Patients</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreating(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateSequence} disabled={!newSequence.name}>
              Create Sequence
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!isPreviewing} onOpenChange={() => setIsPreviewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Sequence Preview</DialogTitle>
            <DialogDescription>
              See what patients will experience at each step.
            </DialogDescription>
          </DialogHeader>
          {isPreviewing && (
            <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
              {sequences
                .find((s) => s.id === isPreviewing)
                ?.steps.map((step, index) => (
                  <div key={index} className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">Day {step.day}</Badge>
                      <Badge className={step.channel === 'call' ? 'bg-primary/10 text-primary' : 'bg-info/10 text-info'}>
                        {step.channel === 'call' ? (
                          <>
                            <Phone className="h-3 w-3 mr-1" />
                            Phone Call
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-3 w-3 mr-1" />
                            SMS
                          </>
                        )}
                      </Badge>
                      <span className="text-sm font-medium">{step.goal}</span>
                    </div>
                    <Separator />
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm italic">
                        &ldquo;{step.script.replace('{patient_name}', 'John Smith')}&rdquo;
                      </p>
                    </div>
                    {step.questions.length > 0 && (
                      <div className="text-sm">
                        <span className="font-medium">Collects:</span>{' '}
                        {step.questions.join(', ')}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsPreviewing(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
