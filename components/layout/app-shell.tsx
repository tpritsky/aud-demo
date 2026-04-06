'use client'

import { ReactNode, Suspense } from 'react'
import { Loader2 } from 'lucide-react'
import { SidebarNav } from './sidebar-nav'
import { Header } from './header'
import { ViewAsBanner } from '@/components/view-as-banner'
import { useAppStore } from '@/lib/store'
import { LoginScreen } from '@/components/auth/login-screen'

interface AppShellProps {
  children: ReactNode
  title: string
}

export function AppShell({ children, title }: AppShellProps) {
  const { isLoggedIn, isHydrated, authSessionChecked, authVerifying } = useAppStore()

  // Show nothing while hydrating to prevent flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!authSessionChecked) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-center text-sm text-muted-foreground">Checking your session…</p>
      </div>
    )
  }

  if (authVerifying) {
    return (
      <div className="min-h-screen bg-muted/30 flex flex-col items-center justify-center gap-3 px-4">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-center text-sm font-medium text-foreground">Verifying your account</p>
        <p className="max-w-md text-center text-xs text-muted-foreground">
          Loading profile, permissions, and required data. If something is misconfigured you will see every error —
          you will not be signed in until checks pass.
        </p>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginScreen />
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <ViewAsBanner />
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <Suspense fallback={<div className="fixed left-0 top-0 z-40 h-screen w-60 border-r border-sidebar-border bg-sidebar" />}>
          <SidebarNav />
        </Suspense>
      </div>

      {/* Main Content */}
      <div className="lg:pl-60">
        <Header title={title} />
        <main className="mx-auto max-w-[1600px] p-4 lg:p-8">{children}</main>
      </div>
    </div>
  )
}
