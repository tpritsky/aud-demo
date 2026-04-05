'use client'

import { useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'

/** Routes that must not trigger redirect to the clinic setup wizard. */
const BYPASS =
  /^\/(get-started|accept-invite|reset-password|request-access|ortho|view-as|help)(\/|$)/

export function ClinicOnboardingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { isHydrated, isLoggedIn, profile } = useAppStore()

  useEffect(() => {
    if (!isHydrated || !isLoggedIn || !pathname) return
    if (BYPASS.test(pathname)) return
    const p = profile
    if (!p || p.role === 'super_admin') return
    if (p.clinicId && p.needsClinicOnboarding) {
      router.replace('/get-started')
    }
  }, [isHydrated, isLoggedIn, pathname, profile, router])

  return children
}
