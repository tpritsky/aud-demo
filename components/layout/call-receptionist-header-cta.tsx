'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Globe, Phone } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phone-format'
import { isPlaceholderOrMissingElevenLabsAgentId } from '@/lib/elevenlabs-placeholders'
import { Button } from '@/components/ui/button'

const EXCLUDED = new Set(['/dashboard', '/businesses'])

export function CallReceptionistHeaderCta() {
  const pathname = usePathname() || ''
  const { agentConfig } = useAppStore()
  const raw = agentConfig?.phoneNumber?.trim()
  const lineId = agentConfig?.elevenLabsPhoneNumberId?.trim()
  const agentId = agentConfig?.elevenLabsAgentId?.trim()
  const inboundReady =
    Boolean(raw) &&
    Boolean(lineId) &&
    Boolean(agentId) &&
    !isPlaceholderOrMissingElevenLabsAgentId(agentId)
  if (!inboundReady) return null
  if (EXCLUDED.has(pathname)) return null

  const display = formatPhoneDisplay(raw) || raw
  const tel = normalizePhoneNumber(raw)

  return (
    <div className="flex shrink-0 items-center gap-1">
      {/* Mobile: icon only */}
      <a
        href={`tel:${tel}`}
        title={`Call your receptionist — ${display}`}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/90 bg-emerald-50/90 text-emerald-800 shadow-sm transition-colors hover:bg-emerald-100 md:hidden"
        aria-label={`Call receptionist ${display}`}
      >
        <Phone className="h-4 w-4" />
      </a>

      {/* md+: compact pill — grouped with bell / avatar, not a second headline */}
      <div className="hidden items-center gap-1 md:flex">
        <a
          href={`tel:${tel}`}
          title={`Call your receptionist — ${display}`}
          className="inline-flex h-9 max-w-[11rem] items-center gap-1.5 truncate rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 text-xs font-semibold text-foreground shadow-sm transition-colors hover:bg-emerald-100/80 lg:max-w-[13rem] lg:px-3 lg:text-sm"
        >
          <Phone className="h-3.5 w-3.5 shrink-0 text-emerald-700" aria-hidden />
          <span className="truncate">{display}</span>
        </a>
        <Button
          variant="outline"
          size="icon"
          className="h-9 w-9 shrink-0 rounded-full border-emerald-200/80 bg-card text-emerald-700 hover:bg-emerald-50"
          title="Web call — agent settings"
          asChild
        >
          <Link href="/settings/agent" aria-label="Web call — open agent settings">
            <Globe className="h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  )
}
