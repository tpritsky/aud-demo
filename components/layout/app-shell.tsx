'use client'

import { ReactNode } from 'react'
import { SidebarNav } from './sidebar-nav'
import { Header } from './header'
import { useAppStore } from '@/lib/store'
import { LoginScreen } from '@/components/auth/login-screen'

interface AppShellProps {
  children: ReactNode
  title: string
}

export function AppShell({ children, title }: AppShellProps) {
  const { isLoggedIn, setIsLoggedIn, isHydrated } = useAppStore()

  // Show nothing while hydrating to prevent flash
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!isLoggedIn) {
    return <LoginScreen onLogin={() => setIsLoggedIn(true)} />
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block">
        <SidebarNav />
      </div>

      {/* Main Content */}
      <div className="lg:pl-64">
        <Header title={title} />
        <main className="p-4 lg:p-6">{children}</main>
      </div>
    </div>
  )
}
