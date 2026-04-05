'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AgentConfig } from '@/lib/types'
import { ConvaiLinePhoneField, type ConvaiLinePhoneFieldMode } from '@/components/settings/convai-line-phone-field'

export type ClinicFactsFields = Pick<AgentConfig, 'clinicName' | 'phoneNumber' | 'hoursOpen' | 'hoursClose'>

type Props = {
  value: ClinicFactsFields
  onChange: (next: ClinicFactsFields) => void
  /** When true, team members cannot edit phone (first save must have set it, or admin assigned a line). */
  memberPhoneLocked?: boolean
  /** Admins use ConvAI line dropdown */
  useAdminLinePicker?: boolean
  selectedConvaiPhoneNumberId?: string
  /** Admin line picker: merged clinic facts after phone change (for immediate save). */
  onConvaiLineSelect?: (phoneNumberId: string, e164: string, mergedFacts: ClinicFactsFields) => void
  /** Scope phone pool so lines assigned to other clinics are hidden (see GET /api/elevenlabs/phone-numbers). */
  phonePoolClinicId?: string | null
}

export function KnowledgeClinicFacts({
  value,
  onChange,
  memberPhoneLocked = false,
  useAdminLinePicker = false,
  selectedConvaiPhoneNumberId = '',
  onConvaiLineSelect,
  phonePoolClinicId = null,
}: Props) {
  const patch = (partial: Partial<ClinicFactsFields>) => onChange({ ...value, ...partial })

  const phoneMode: ConvaiLinePhoneFieldMode = useAdminLinePicker
    ? 'admin-select'
    : memberPhoneLocked
      ? 'member-locked'
      : 'member-open'

  return (
    <div className="rounded-2xl border border-zinc-200/90 bg-white px-5 py-5 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-5 sm:px-6">
      <div>
        <h3 className="text-base font-semibold tracking-tight text-foreground">Business &amp; hours</h3>
        <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
          Name, public phone, and hours callers may ask about — saved with receptionist settings.
        </p>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="knowledge-clinic-name" className="text-sm font-semibold">
            Business name
          </Label>
          <Input
            id="knowledge-clinic-name"
            value={value.clinicName}
            onChange={(e) => patch({ clinicName: e.target.value })}
            placeholder="Your practice name"
            className="h-11 rounded-xl border-zinc-200"
          />
        </div>
        <ConvaiLinePhoneField
          mode={phoneMode}
          phoneNumber={value.phoneNumber}
          onPhoneNumberChange={(v) => patch({ phoneNumber: v })}
          selectedPhoneNumberId={selectedConvaiPhoneNumberId}
          phonePoolClinicId={phonePoolClinicId}
          onSelectLine={(phoneNumberId, e164) => {
            const merged = { ...value, phoneNumber: e164 }
            onChange(merged)
            onConvaiLineSelect?.(phoneNumberId, e164, merged)
          }}
          label="Call Agent number"
        />
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="knowledge-hours-open" className="text-sm font-semibold">
            Opening time
          </Label>
          <Input
            id="knowledge-hours-open"
            type="time"
            value={value.hoursOpen}
            onChange={(e) => patch({ hoursOpen: e.target.value })}
            className="h-11 rounded-xl border-zinc-200"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="knowledge-hours-close" className="text-sm font-semibold">
            Closing time
          </Label>
          <Input
            id="knowledge-hours-close"
            type="time"
            value={value.hoursClose}
            onChange={(e) => patch({ hoursClose: e.target.value })}
            className="h-11 rounded-xl border-zinc-200"
          />
        </div>
      </div>
    </div>
  )
}
