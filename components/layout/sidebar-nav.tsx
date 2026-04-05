'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Phone,
  Users,
  Headphones,
  LogOut,
  ClipboardList,
  UserCog,
  Building2,
  Bot,
  Sparkles,
  CalendarClock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useAppStore } from '@/lib/store'
import {
  AGENT_SECTION_SLUGS,
  AGENT_SUBNAV_LABELS,
  slugFromAgentSection,
} from '@/lib/settings-agent-sections'

function useClinicQuerySuffix(): string {
  const searchParams = useSearchParams()
  const c = searchParams.get('clinic')?.trim()
  return c ? `?clinic=${encodeURIComponent(c)}` : ''
}

const mainItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Calls', href: '/calls', icon: Phone },
  { title: 'Tasks', href: '/tasks', icon: ClipboardList },
  { title: 'Patients', href: '/patients', icon: Users },
  { title: 'Team', href: '/team', icon: UserCog, adminOnly: true as const },
] as const

export function SidebarNav() {
  const pathname = usePathname()
  const clinicSuffix = useClinicQuerySuffix()
  const { agentConfig, setIsLoggedIn, profile } = useAppStore()
  const isSuperAdmin = profile?.role === 'super_admin'

  const [agentOpen, setAgentOpen] = useState(false)

  useEffect(() => {
    if (pathname.startsWith('/settings/agent')) setAgentOpen(true)
    else setAgentOpen(false)
  }, [pathname])

  const filteredMain = mainItems.filter((item) => {
    if ('adminOnly' in item && item.adminOnly) return profile?.role === 'admin'
    return true
  })

  const linkClass = (active: boolean) =>
    cn(
      'relative isolate flex items-center gap-3 overflow-hidden rounded-xl bg-sidebar px-3 py-2.5 text-[15px] transition-colors',
      active
        ? 'border-l-[3px] border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
        : 'border-l-[3px] border-transparent font-medium text-muted-foreground hover:bg-zinc-100/80 hover:text-foreground dark:hover:bg-zinc-800/40'
    )

  const subLinkClass = (active: boolean) =>
    cn(
      'relative isolate block overflow-hidden rounded-md border-l-[3px] bg-sidebar py-2 pl-3 pr-2 text-[15px] leading-snug transition-colors',
      active
        ? 'border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm'
        : 'border-transparent font-medium text-muted-foreground hover:bg-zinc-100/80 hover:text-foreground dark:hover:bg-zinc-800/40'
    )

  const phoneHref = `/settings/phone-summaries${clinicSuffix}`
  const checkInsHref = `/settings/check-ins${clinicSuffix}`

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-60 flex-col overflow-x-hidden border-r border-sidebar-border bg-sidebar shadow-[1px_0_0_rgba(0,0,0,0.02)]">
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Headphones className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Vocalis</span>
          <span className="truncate text-xs text-muted-foreground">
            {isSuperAdmin ? 'Super Admin' : agentConfig.clinicName}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {isSuperAdmin ? (
          <Link
            href="/businesses"
            className={linkClass(pathname === '/businesses' || pathname.startsWith('/businesses/'))}
          >
            <Building2 className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
            Businesses
          </Link>
        ) : null}

        {(!isSuperAdmin ? filteredMain : [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }]).map(
          (item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} className={linkClass(active)}>
                <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
                {item.title}
              </Link>
            )
          }
        )}

        <Collapsible open={agentOpen} onOpenChange={setAgentOpen}>
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className={cn(
                'relative isolate flex w-full items-center gap-3 overflow-hidden rounded-xl border-l-[3px] bg-sidebar px-3 py-2.5 text-left text-[15px] transition-colors',
                pathname.startsWith('/settings/agent')
                  ? 'border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground'
                  : 'border-transparent font-medium text-muted-foreground hover:bg-zinc-100/80 hover:text-foreground dark:hover:bg-zinc-800/40'
              )}
              aria-expanded={agentOpen}
              aria-label={agentOpen ? 'Collapse Agent section' : 'Expand Agent section'}
            >
              <Bot className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
              <span className="truncate">Agent</span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="mt-0.5 space-y-0.5 border-l-[3px] border-border/70 pl-2 ml-1">
            {AGENT_SECTION_SLUGS.map((key) => {
              const base = `/settings/agent/${slugFromAgentSection(key)}`
              const active = pathname === base
              return (
                <Link key={key} href={`${base}${clinicSuffix}`} className={subLinkClass(active)}>
                  {AGENT_SUBNAV_LABELS[key]}
                </Link>
              )
            })}
          </CollapsibleContent>
        </Collapsible>

        <Link href={phoneHref} className={linkClass(pathname.startsWith('/settings/phone-summaries'))}>
          <Sparkles className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
          Phone &amp; summaries
        </Link>
        <Link href={checkInsHref} className={linkClass(pathname.startsWith('/settings/check-ins'))}>
          <CalendarClock className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
          Check-ins
        </Link>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => setIsLoggedIn(false)}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </aside>
  )
}
