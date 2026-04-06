'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { ClinicSetupWizard } from '@/components/onboarding/clinic-setup-wizard'

function gsLog(event: string, payload?: Record<string, unknown>) {
  console.log(`[Vocalis:get-started] ${event}`, { t: new Date().toISOString(), ...payload })
}

export function GetStartedClient({
  setupClinicId,
  redirectQueryString,
}: {
  setupClinicId: string | null
  redirectQueryString: string
}) {
  const router = useRouter()
  const { isHydrated, isLoggedIn, profile, setProfile } = useAppStore()

  useEffect(() => {
    gsLog('route_effect', {
      isHydrated,
      isLoggedIn,
      setupClinicId,
      profileRole: profile?.role ?? null,
      clinicId: profile?.clinicId ?? null,
      needsClinicOnboarding: profile?.needsClinicOnboarding ?? null,
    })
    if (!isHydrated) return
    if (!isLoggedIn) {
      const q = redirectQueryString
      const dest = q ? `/dashboard?${q}` : '/dashboard'
      const viaLogin = `/login?next=${encodeURIComponent(dest)}`
      gsLog('redirect', { reason: 'not_logged_in', to: viaLogin })
      router.replace(viaLogin)
      return
    }
    if (profile?.role === 'super_admin' && !setupClinicId) {
      gsLog('redirect', { reason: 'super_admin_missing_clinicId', to: '/dashboard' })
      router.replace('/dashboard')
      return
    }
    if (profile?.role === 'super_admin' && setupClinicId) return
    if (profile && !profile.clinicId) return
    if (profile && !profile.needsClinicOnboarding) {
      gsLog('redirect', { reason: 'onboarding_not_needed', to: '/dashboard' })
      router.replace('/dashboard')
    }
  }, [isHydrated, isLoggedIn, profile, router, setupClinicId, redirectQueryString])

  useEffect(() => {
    const branch = !isHydrated
      ? 'waiting_hydrate'
      : !isLoggedIn
        ? 'redirecting_unauthenticated'
        : isLoggedIn && profile?.role === 'super_admin' && setupClinicId
          ? 'wizard_super_admin'
          : isLoggedIn && profile?.role === 'super_admin' && !setupClinicId
            ? 'spinner_super_admin_no_clinic'
            : isLoggedIn && profile?.clinicId && profile.needsClinicOnboarding
              ? 'wizard_member_onboarding'
              : isLoggedIn && profile && !profile.clinicId
                ? 'no_clinic_linked'
                : isLoggedIn
                  ? 'spinner_logged_in_fallback'
                  : 'fallback'
    gsLog('ui_branch', { branch })
  }, [isHydrated, isLoggedIn, profile, setupClinicId])

  if (!isHydrated) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/80 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (isLoggedIn && profile?.role === 'super_admin' && setupClinicId) {
    return (
      <div className="min-h-screen bg-zinc-50/80">
        <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:h-16">
            <span className="text-sm font-semibold text-foreground">Vocalis</span>
            <Button type="button" variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link href="/businesses">Back to businesses</Link>
            </Button>
          </div>
        </header>
        <ClinicSetupWizard superAdminClinicId={setupClinicId} onDone={() => {}} />
      </div>
    )
  }

  if (isLoggedIn && profile?.role === 'super_admin' && !setupClinicId) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/80 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  if (isLoggedIn && profile?.clinicId && profile.needsClinicOnboarding) {
    return (
      <div className="min-h-screen bg-zinc-50/80">
        <header className="border-b border-zinc-200/80 bg-white/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center px-4 sm:h-16">
            <span className="text-sm font-semibold text-foreground">Vocalis</span>
          </div>
        </header>
        <ClinicSetupWizard
          onDone={() => {
            if (profile) setProfile({ ...profile, needsClinicOnboarding: false })
          }}
        />
      </div>
    )
  }

  if (isLoggedIn && profile && !profile.clinicId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="border-b border-border/40 bg-background/95 backdrop-blur">
          <div className="container mx-auto flex h-14 items-center px-4 sm:h-16 lg:px-8">
            <span className="text-sm font-semibold text-foreground">Vocalis</span>
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-md space-y-4 text-center">
            <h1 className="text-2xl font-bold tracking-tight">No business linked yet</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              Your account is not assigned to a clinic. Ask your administrator to invite you or assign you to a business.
            </p>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/dashboard">Go to dashboard</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/80">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50/80 gap-3">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      <p className="text-sm text-muted-foreground">Redirecting…</p>
    </div>
  )
}
