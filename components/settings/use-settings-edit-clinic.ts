'use client'

import { useSearchParams } from 'next/navigation'
import { useAppStore } from '@/lib/store'

function isLikelyClinicUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

/** Super admin `?clinic=` UUID when editing a business from the Businesses console. */
export function useSettingsEditClinicId(): string | null {
  const { profile } = useAppStore()
  const searchParams = useSearchParams()
  const raw = searchParams.get('clinic')?.trim() ?? ''
  const clinicQuery = raw && isLikelyClinicUuid(raw) ? raw : null
  return profile?.role === 'super_admin' && clinicQuery ? clinicQuery : null
}
