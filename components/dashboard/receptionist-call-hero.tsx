'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Phone, Globe, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phone-format'
import { isPlaceholderOrMissingElevenLabsAgentId } from '@/lib/elevenlabs-placeholders'
import { cn } from '@/lib/utils'

const BANNER_KEY = 'vocalis-dashboard-call-banner-dismissed'
const SETTINGS_AGENT_KNOWLEDGE = '/settings/agent/knowledge'
const SETTINGS_AGENT_SETTINGS = '/settings/agent/agent-settings'

export function ReceptionistCallHero() {
  const { agentConfig, profile } = useAppStore()
  const raw = agentConfig?.phoneNumber?.trim()
  const lineId = agentConfig?.elevenLabsPhoneNumberId?.trim()
  const agentId = agentConfig?.elevenLabsAgentId?.trim()
  const inboundReady =
    Boolean(raw) &&
    Boolean(lineId) &&
    Boolean(agentId) &&
    !isPlaceholderOrMissingElevenLabsAgentId(agentId)
  const display = raw ? formatPhoneDisplay(raw) || raw : ''
  const tel = raw ? normalizePhoneNumber(raw) : ''
  const [bannerDismissed, setBannerDismissed] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(BANNER_KEY) === '1') setBannerDismissed(true)
    } catch {
      /* ignore */
    }
  }, [])

  const dismissBanner = () => {
    try {
      localStorage.setItem(BANNER_KEY, '1')
    } catch {
      /* ignore */
    }
    setBannerDismissed(true)
  }

  if (!inboundReady || !tel) {
    const superNoClinic = profile?.role === 'super_admin' && !profile.clinicId
    return (
      <div className="space-y-3">
        {superNoClinic ? (
          <div className="rounded-xl border border-amber-200/90 bg-amber-50/90 px-4 py-3 text-sm text-foreground">
            <span className="font-semibold">Super admin:</span> link a business to your profile to load that
            clinic&apos;s receptionist line in the dashboard and header. Open{' '}
            <Link href="/businesses" className="font-semibold text-emerald-800 underline">
              Businesses
            </Link>{' '}
            and attach your account to a clinic, or complete onboarding for your own business.
          </div>
        ) : null}
        <div className="rounded-2xl border border-dashed border-border bg-card p-6 text-center text-sm text-muted-foreground">
          {raw && !inboundReady ? (
            <p className="mb-3 text-foreground">
              This number isn&apos;t connected to your agent yet.{' '}
              <Link href={SETTINGS_AGENT_KNOWLEDGE} className="font-semibold text-emerald-700 hover:underline">
                Configure here
              </Link>
              .
            </p>
          ) : null}
          <p>
            No agent configured for inbound calls yet.{' '}
            <Link href={SETTINGS_AGENT_KNOWLEDGE} className="font-semibold text-emerald-700 hover:underline">
              Configure here
            </Link>
            .{' '}
            <Link href={SETTINGS_AGENT_SETTINGS} className="font-semibold text-emerald-700 hover:underline">
              Agent settings
            </Link>{' '}
            — try the call bot (outbound test only).
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {!bannerDismissed ? (
        <div
          className={cn(
            'relative overflow-hidden rounded-2xl border border-amber-200/80 bg-gradient-to-r from-emerald-50 via-amber-50/90 to-amber-100/80',
            'px-4 py-3 pr-10 shadow-sm sm:px-5 sm:py-4'
          )}
        >
          <button
            type="button"
            onClick={dismissBanner}
            className="absolute right-2 top-2 rounded-md p-1 text-foreground/50 hover:bg-black/5 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
              <Phone className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-foreground sm:text-base">
                Call your receptionist at{' '}
                <a href={`tel:${tel}`} className="underline decoration-emerald-700/40 underline-offset-2">
                  {display}
                </a>
              </p>
              <Link
                href="/help/call-forwarding"
                className="mt-1 inline-block text-sm font-semibold text-emerald-700 hover:underline"
              >
                Forward your number
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Phone className="h-6 w-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Your AI receptionist is ready</h2>
          <p className="mt-2 text-sm font-medium text-muted-foreground sm:text-base">
            Call this number to reach your receptionist, or use Agent settings to run a test outbound call to your phone.
          </p>
          <div className="mt-6 flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button variant="outline" size="lg" className="h-12 rounded-xl border-zinc-200 text-base font-semibold" asChild>
              <a href={`tel:${tel}`}>Call {display}</a>
            </Button>
            <Button size="lg" className="h-12 gap-2 rounded-xl bg-emerald-600 text-base font-semibold hover:bg-emerald-700" asChild>
              <Link href={SETTINGS_AGENT_SETTINGS}>
                <Globe className="h-5 w-5" />
                Test call setup
              </Link>
            </Button>
          </div>
          <p className="mt-4 flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            Tip: add knowledge under Settings → Agent → Knowledge for better answers.
          </p>
        </div>
      </div>
    </div>
  )
}
