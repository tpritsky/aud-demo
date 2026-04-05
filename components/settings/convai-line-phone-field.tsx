'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import type { ElevenLabsPhoneNumberOption } from '@/lib/types'
import { formatPhoneDisplay } from '@/lib/phone-format'
import { cn } from '@/lib/utils'

export type ConvaiLinePhoneFieldMode = 'member-open' | 'member-locked' | 'admin-select'

type Props = {
  mode: ConvaiLinePhoneFieldMode
  /** Current display number (E.164 or formatted) */
  phoneNumber: string
  /** member-open: free text */
  onPhoneNumberChange?: (v: string) => void
  /** admin-select: ConvAI phone_number_id */
  selectedPhoneNumberId?: string
  /** Required when mode is admin-select */
  onSelectLine?: (phoneNumberId: string, e164: string) => void
  label?: string
  className?: string
  /** Limits dropdown to numbers not already assigned to another clinic */
  phonePoolClinicId?: string | null
}

export function ConvaiLinePhoneField({
  mode,
  phoneNumber,
  onPhoneNumberChange,
  selectedPhoneNumberId,
  onSelectLine,
  label = 'Call Agent number',
  className,
  phonePoolClinicId = null,
}: Props) {
  const [rows, setRows] = useState<ElevenLabsPhoneNumberOption[]>([])
  const [load, setLoad] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')

  useEffect(() => {
    if (mode !== 'admin-select') {
      setLoad('idle')
      return
    }
    let cancelled = false
    setLoad('loading')
    ;(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          if (!cancelled) setLoad('error')
          return
        }
        const q = phonePoolClinicId?.trim()
          ? `?clinicId=${encodeURIComponent(phonePoolClinicId.trim())}`
          : ''
        const res = await fetch(`/api/elevenlabs/phone-numbers${q}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          setLoad('error')
          return
        }
        const list = Array.isArray(data.phoneNumbers) ? (data.phoneNumbers as ElevenLabsPhoneNumberOption[]) : []
        setRows(list)
        setLoad('done')
      } catch {
        if (!cancelled) setLoad('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [mode, phonePoolClinicId])

  if (mode === 'member-locked') {
    const display = formatPhoneDisplay(phoneNumber) || phoneNumber.trim() || '—'
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-sm font-semibold">{label}</Label>
        <div className="flex h-11 items-center gap-2 rounded-xl border border-zinc-200 bg-muted/40 px-3 text-sm text-foreground">
          <Phone className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="font-medium tabular-nums">{display}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          This number is set for your business. Only an administrator can change the receptionist line.
        </p>
      </div>
    )
  }

  if (mode === 'admin-select') {
    return (
      <div className={cn('space-y-2', className)}>
        <Label className="text-sm font-semibold">{label}</Label>
        {load === 'loading' ? (
          <div className="flex h-11 items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading numbers…
          </div>
        ) : load === 'error' ? (
          <div className="space-y-2">
            <p className="text-xs text-destructive">Could not load ConvAI numbers. Check ElevenLabs API key.</p>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange?.(e.target.value)}
                className="h-11 rounded-xl border-zinc-200 pl-9"
                placeholder="E.164 e.g. +15551234567"
              />
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              No unassigned lines available — every number in your workspace may already be linked to a business, or none
              are imported yet. Add a number in your voice provider, or free one from another clinic first.
            </p>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={phoneNumber}
                onChange={(e) => onPhoneNumberChange?.(e.target.value)}
                className="h-11 rounded-xl border-zinc-200 pl-9"
                placeholder="Or type number manually"
              />
            </div>
          </div>
        ) : (
          <Select
            value={(() => {
              const sid = selectedPhoneNumberId?.trim() ?? ''
              return sid && rows.some((r) => r.phoneNumberId === sid) ? sid : undefined
            })()}
            onValueChange={(id) => {
              const row = rows.find((r) => r.phoneNumberId === id)
              onSelectLine?.(id, row?.phoneNumber ?? '')
            }}
          >
            <SelectTrigger className="h-11 w-full rounded-xl border-zinc-200">
              <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
                <Phone className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue placeholder="Select receptionist line" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {rows.map((r) => {
                const disp = formatPhoneDisplay(r.phoneNumber) || r.phoneNumber
                const extra = r.label && r.label !== r.phoneNumber ? ` — ${r.label}` : ''
                return (
                  <SelectItem key={r.phoneNumberId} value={r.phoneNumberId}>
                    {disp}
                    {extra}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        )}
        {load === 'done' && rows.length > 0 ? (
          <p className="text-xs text-muted-foreground">This updates phone number of your call agent.</p>
        ) : null}
        <p className="text-xs text-muted-foreground leading-relaxed">
          Choosing a line saves automatically and sets up inbound calls. Outbound test only:{' '}
          <Link href="/settings/agent/agent-settings" className="font-semibold text-emerald-700 hover:underline">
            Agent settings
          </Link>
          .
        </p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Label htmlFor="convai-line-phone-open" className="text-sm font-semibold">
        {label}
      </Label>
      <div className="relative">
        <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="convai-line-phone-open"
          value={phoneNumber}
          onChange={(e) => onPhoneNumberChange?.(e.target.value)}
          className="h-11 rounded-xl border-zinc-200 pl-9"
          placeholder="(555) 000-0000"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        You can set this once. After it&apos;s saved, only an administrator can change the line.
      </p>
    </div>
  )
}
