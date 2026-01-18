'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { Label } from '@/components/ui/label'
import { useAppStore } from '@/lib/store'
import { formatDistanceToNow } from '@/lib/format'
import { Patient, PatientTag, AdoptionSignals } from '@/lib/types'
import { ChevronRight, X, AlertTriangle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { normalizePhoneNumber, formatPhoneDisplay } from '@/lib/phone-format'

export function PatientsTable() {
  const { patients, addPatient, addActivityEvent } = useAppStore()
  const [search, setSearch] = useState('')
  const [tagFilter, setTagFilter] = useState<PatientTag | 'all'>('all')
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  
  // New patient form state
  const [newPatientName, setNewPatientName] = useState('')
  const [newPatientPhone, setNewPatientPhone] = useState('')
  const [newPatientEmail, setNewPatientEmail] = useState('')
  const [newPatientTags, setNewPatientTags] = useState<PatientTag[]>([])
  const [newPatientDeviceBrand, setNewPatientDeviceBrand] = useState('')
  const [newPatientDeviceModel, setNewPatientDeviceModel] = useState('')
  const [newPatientFittingDate, setNewPatientFittingDate] = useState('')
  const [newPatientProactiveCheckIns, setNewPatientProactiveCheckIns] = useState(false)

  const filteredPatients = useMemo(() => {
    return patients
      .filter((patient) => {
        if (tagFilter !== 'all' && !patient.tags.includes(tagFilter)) return false
        if (search) {
          const searchLower = search.toLowerCase()
          return (
            patient.name.toLowerCase().includes(searchLower) ||
            patient.phone.includes(search) ||
            patient.email.toLowerCase().includes(searchLower)
          )
        }
        return true
      })
      .sort((a, b) => b.lastContactAt.getTime() - a.lastContactAt.getTime())
  }, [patients, search, tagFilter])

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

  const getRiskBadge = (score: number) => {
    if (score >= 70) return <Badge variant="destructive">{score}</Badge>
    if (score >= 50) return <Badge className="bg-warning/10 text-warning">{score}</Badge>
    return <Badge variant="secondary">{score}</Badge>
  }

  const handleCreatePatient = () => {
    if (!newPatientName.trim() || !newPatientPhone.trim() || !newPatientEmail.trim()) {
      toast.error('Validation Error', {
        description: 'Please fill in all required fields (Name, Phone, Email).',
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newPatientEmail)) {
      toast.error('Invalid Email', {
        description: 'Please enter a valid email address.',
      })
      return
    }

    // Default adoption signals
    const defaultAdoptionSignals: AdoptionSignals = {
      woreToday: null,
      estimatedHoursWorn: null,
      comfortIssues: false,
      soundClarityIssues: false,
      bluetoothAppIssues: false,
    }

    // Calculate initial risk score (default to low)
    const initialRiskScore = 20
    const initialRiskReasons: string[] = []

    // If no tags selected, default to "Existing"
    const tags = newPatientTags.length > 0 ? newPatientTags : ['Existing' as PatientTag]

    // Normalize phone number to E.164 format
    const normalizedPhone = normalizePhoneNumber(newPatientPhone)

    const newPatient: Patient = {
      id: `patient-${Date.now()}`,
      name: newPatientName.trim(),
      phone: normalizedPhone,
      email: newPatientEmail.trim(),
      tags,
      riskScore: initialRiskScore,
      riskReasons: initialRiskReasons,
      lastContactAt: new Date(),
      adoptionSignals: defaultAdoptionSignals,
      proactiveCheckInsEnabled: newPatientProactiveCheckIns,
      deviceBrand: newPatientDeviceBrand.trim() || undefined,
      deviceModel: newPatientDeviceModel.trim() || undefined,
      fittingDate: newPatientFittingDate ? new Date(newPatientFittingDate) : undefined,
    }

    addPatient(newPatient)
    addActivityEvent({
      id: `event-${Date.now()}`,
      type: 'new_patient',
      description: `New patient added: ${newPatient.name}`,
      timestamp: new Date(),
      patientName: newPatient.name,
      patientId: newPatient.id,
    })

    toast.success('Patient Created', {
      description: `${newPatient.name} has been added to the directory.`,
    })

    // Reset form
    setIsCreateDialogOpen(false)
    setNewPatientName('')
    setNewPatientPhone('')
    setNewPatientEmail('')
    setNewPatientTags([])
    setNewPatientDeviceBrand('')
    setNewPatientDeviceModel('')
    setNewPatientFittingDate('')
    setNewPatientProactiveCheckIns(false)
  }

  const toggleTag = (tag: PatientTag) => {
    setNewPatientTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const hasFilters = search !== '' || tagFilter !== 'all'

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center flex-1">
          <Input
            placeholder="Search patients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full sm:w-64"
          />
          <Select value={tagFilter} onValueChange={(v) => setTagFilter(v as PatientTag | 'all')}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Filter by tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Patients</SelectItem>
              <SelectItem value="New Fit">New Fit</SelectItem>
              <SelectItem value="Existing">Existing</SelectItem>
              <SelectItem value="High Risk">High Risk</SelectItem>
            </SelectContent>
          </Select>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setTagFilter('all')
              }}
            >
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
          )}
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Patient
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Patient</DialogTitle>
              <DialogDescription>
                Add a new patient to the directory. All fields marked with * are required.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
              {/* Required Fields */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={newPatientName}
                    onChange={(e) => setNewPatientName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">
                    Phone <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={newPatientPhone}
                    onChange={(e) => setNewPatientPhone(e.target.value)}
                    onBlur={(e) => {
                      // Format after user finishes entering
                      const normalized = normalizePhoneNumber(e.target.value)
                      if (normalized) {
                        // Display in formatted form
                        const formatted = formatPhoneDisplay(normalized)
                        setNewPatientPhone(formatted)
                      }
                    }}
                    placeholder="+1 (555) 123-4567 or 555-123-4567"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter phone number in any format. It will be formatted automatically.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={newPatientEmail}
                  onChange={(e) => setNewPatientEmail(e.target.value)}
                  placeholder="john.doe@example.com"
                />
              </div>

              {/* Tags */}
              <div className="space-y-2">
                <Label>Tags</Label>
                <div className="flex flex-wrap gap-2">
                  {(['New Fit', 'Existing', 'High Risk'] as PatientTag[]).map((tag) => (
                    <Button
                      key={tag}
                      type="button"
                      variant={newPatientTags.includes(tag) ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleTag(tag)}
                    >
                      {tag}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  If no tags are selected, patient will be tagged as "Existing"
                </p>
              </div>

              {/* Device Information */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="deviceBrand">Device Brand</Label>
                  <Input
                    id="deviceBrand"
                    value={newPatientDeviceBrand}
                    onChange={(e) => setNewPatientDeviceBrand(e.target.value)}
                    placeholder="e.g., Phonak"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="deviceModel">Device Model</Label>
                  <Input
                    id="deviceModel"
                    value={newPatientDeviceModel}
                    onChange={(e) => setNewPatientDeviceModel(e.target.value)}
                    placeholder="e.g., Audeo P90"
                  />
                </div>
              </div>

              {/* Fitting Date */}
              <div className="space-y-2">
                <Label htmlFor="fittingDate">Fitting Date</Label>
                <Input
                  id="fittingDate"
                  type="date"
                  value={newPatientFittingDate}
                  onChange={(e) => setNewPatientFittingDate(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Required for proactive check-ins to be scheduled
                </p>
              </div>

              {/* Proactive Check-ins */}
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="proactiveCheckIns"
                  checked={newPatientProactiveCheckIns}
                  onChange={(e) => setNewPatientProactiveCheckIns(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <Label htmlFor="proactiveCheckIns" className="cursor-pointer">
                  Enable proactive check-ins
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreatePatient}>Create Patient</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Patient</TableHead>
              <TableHead className="hidden sm:table-cell">Tags</TableHead>
              <TableHead className="hidden md:table-cell">Device</TableHead>
              <TableHead>Risk</TableHead>
              <TableHead className="hidden lg:table-cell">Last Contact</TableHead>
              <TableHead className="hidden md:table-cell">Check-ins</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredPatients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center">
                  No patients found.
                </TableCell>
              </TableRow>
            ) : (
              filteredPatients.map((patient) => (
                <TableRow key={patient.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{patient.name}</p>
                      <p className="text-xs text-muted-foreground">{patient.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {patient.tags.map((tag) => (
                        <Badge key={tag} className={getTagColor(tag)}>
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {patient.deviceBrand && patient.deviceModel ? (
                      <span className="text-sm">
                        {patient.deviceBrand} {patient.deviceModel}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {getRiskBadge(patient.riskScore)}
                      {patient.riskScore >= 50 && (
                        <AlertTriangle className="h-3 w-3 text-warning" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {formatDistanceToNow(patient.lastContactAt)}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {patient.proactiveCheckInsEnabled ? (
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        Active
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Disabled</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" asChild>
                      <Link href={`/patients/${patient.id}`}>
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filteredPatients.length} of {patients.length} patients
      </div>
    </div>
  )
}
