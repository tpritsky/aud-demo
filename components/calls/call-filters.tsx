'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { CallDirection, CallIntent, CallOutcome } from '@/lib/types'

export interface CallFilters {
  intent: CallIntent | 'all'
  outcome: CallOutcome | 'all'
  escalated: 'all' | 'yes' | 'no'
  direction: CallDirection | 'all'
  minUrgency: 'all' | '1' | '2' | '3' | '4'
  search: string
}

interface CallFiltersProps {
  filters: CallFilters
  onFiltersChange: (filters: CallFilters) => void
}

const intentOptions: { value: CallIntent | 'all'; label: string }[] = [
  { value: 'all', label: 'All Intents' },
  { value: 'scheduling', label: 'Scheduling' },
  { value: 'reschedule', label: 'Reschedule' },
  { value: 'cancel', label: 'Cancel' },
  { value: 'new_patient', label: 'New Patient' },
  { value: 'device_troubleshooting', label: 'Device Troubleshooting' },
  { value: 'billing', label: 'Billing' },
  { value: 'general_inquiry', label: 'General Inquiry' },
]

const outcomeOptions: { value: CallOutcome | 'all'; label: string }[] = [
  { value: 'all', label: 'All Outcomes' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'escalated', label: 'Escalated' },
  { value: 'callback_scheduled', label: 'Callback Scheduled' },
  { value: 'voicemail', label: 'Voicemail' },
  { value: 'no_answer', label: 'No Answer' },
  { value: 'transferred', label: 'Transferred' },
]

export function CallFiltersComponent({ filters, onFiltersChange }: CallFiltersProps) {
  const hasActiveFilters =
    filters.intent !== 'all' ||
    filters.outcome !== 'all' ||
    filters.escalated !== 'all' ||
    filters.direction !== 'all' ||
    filters.minUrgency !== 'all' ||
    filters.search !== ''

  const clearFilters = () => {
    onFiltersChange({
      intent: 'all',
      outcome: 'all',
      escalated: 'all',
      direction: 'all',
      minUrgency: 'all',
      search: '',
    })
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:flex-wrap">
      <Input
        placeholder="Search name, phone, summary, transcript, AI…"
        value={filters.search}
        onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
        className="w-full sm:w-72"
      />

      <Select
        value={filters.intent}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, intent: value as CallIntent | 'all' })
        }
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Intent" />
        </SelectTrigger>
        <SelectContent>
          {intentOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.outcome}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, outcome: value as CallOutcome | 'all' })
        }
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Outcome" />
        </SelectTrigger>
        <SelectContent>
          {outcomeOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={filters.escalated}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, escalated: value as 'all' | 'yes' | 'no' })
        }
      >
        <SelectTrigger className="w-full sm:w-36">
          <SelectValue placeholder="Escalated" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="yes">Escalated</SelectItem>
          <SelectItem value="no">Not Escalated</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.direction}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, direction: value as CallDirection | 'all' })
        }
      >
        <SelectTrigger className="w-full sm:w-40">
          <SelectValue placeholder="Direction" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any direction</SelectItem>
          <SelectItem value="inbound">Inbound</SelectItem>
          <SelectItem value="outbound">Outbound</SelectItem>
          <SelectItem value="unknown">Unknown</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.minUrgency}
        onValueChange={(value) =>
          onFiltersChange({ ...filters, minUrgency: value as CallFilters['minUrgency'] })
        }
      >
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Min urgency" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any urgency</SelectItem>
          <SelectItem value="4">P4+</SelectItem>
          <SelectItem value="3">P3+</SelectItem>
          <SelectItem value="2">P2+</SelectItem>
          <SelectItem value="1">P1+</SelectItem>
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={clearFilters}>
          <X className="h-4 w-4 mr-1" />
          Clear
        </Button>
      )}
    </div>
  )
}
