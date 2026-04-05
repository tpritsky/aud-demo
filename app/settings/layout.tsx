'use client'

import { Suspense, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { SettingsClinicBanner } from '@/components/settings/settings-clinic-banner'

function titleForPath(pathname: string): string {
  if (pathname.startsWith('/settings/account')) return 'Account'
  if (pathname.startsWith('/settings/phone-summaries')) return 'Phone & summaries'
  if (pathname.startsWith('/settings/check-ins')) return 'Check-ins'
  if (pathname.startsWith('/settings/agent')) return 'Agent'
  if (pathname === '/settings') return 'Agent'
  return 'Configuration'
}

export default function SettingsLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  return (
    <AppShell title={titleForPath(pathname)}>
      <div className="space-y-8">
        <Suspense fallback={null}>
          <SettingsClinicBanner />
        </Suspense>
        {children}
      </div>
    </AppShell>
  )
}
