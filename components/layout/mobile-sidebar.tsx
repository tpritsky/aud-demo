'use client'

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
import { useAppStore } from '@/lib/store'
import { SheetClose } from '@/components/ui/sheet'
import {
  AGENT_SECTION_SLUGS,
  AGENT_SUBNAV_LABELS,
  DEFAULT_AGENT_SECTION,
  slugFromAgentSection,
} from '@/lib/settings-agent-sections'

const mainItems = [
  { title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { title: 'Calls', href: '/calls', icon: Phone },
  { title: 'Tasks', href: '/tasks', icon: ClipboardList },
  { title: 'Patients', href: '/patients', icon: Users },
  { title: 'Team', href: '/team', icon: UserCog, adminOnly: true as const },
] as const

export function MobileSidebar() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const clinicSuffix = (() => {
    const c = searchParams.get('clinic')?.trim()
    return c ? `?clinic=${encodeURIComponent(c)}` : ''
  })()
  const { agentConfig, setIsLoggedIn, profile } = useAppStore()
  const isSuperAdmin = profile?.role === 'super_admin'

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
      'relative isolate block w-full overflow-hidden rounded-md border-l-[3px] bg-sidebar py-2 pl-3 pr-2 text-left text-[15px] leading-snug transition-colors',
      active
        ? 'border-primary bg-sidebar-accent font-semibold text-sidebar-accent-foreground shadow-sm'
        : 'border-transparent font-medium text-muted-foreground hover:bg-zinc-100/80 hover:text-foreground dark:hover:bg-zinc-800/40'
    )

  const phoneHref = `/settings/phone-summaries${clinicSuffix}`
  const checkInsHref = `/settings/check-ins${clinicSuffix}`
  const agentRootHref = `/settings/agent/${slugFromAgentSection(DEFAULT_AGENT_SECTION)}${clinicSuffix}`
  const onAgentBranch = pathname.startsWith('/settings/agent')

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-14 items-center gap-3 border-b border-sidebar-border px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary shadow-sm">
          <Headphones className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0 flex flex-col">
          <span className="truncate text-sm font-semibold tracking-tight text-sidebar-foreground">Vocalis</span>
          <span className="truncate text-xs text-muted-foreground">
            {isSuperAdmin
              ? 'Super Admin'
              : agentConfig.clinicName.trim() || 'Your clinic'}
          </span>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {isSuperAdmin ? (
          <SheetClose asChild>
            <Link
              href="/businesses"
              className={linkClass(pathname === '/businesses' || pathname.startsWith('/businesses/'))}
            >
              <Building2 className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
              Businesses
            </Link>
          </SheetClose>
        ) : null}

        {(!isSuperAdmin ? filteredMain : [{ title: 'Dashboard', href: '/dashboard', icon: LayoutDashboard }]).map(
          (item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <SheetClose asChild key={item.href}>
                <Link href={item.href} className={linkClass(active)}>
                  <item.icon className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
                  {item.title}
                </Link>
              </SheetClose>
            )
          }
        )}

        <SheetClose asChild>
          <Link href={agentRootHref} className={linkClass(onAgentBranch)}>
            <Bot className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
            <span className="truncate">Agent</span>
          </Link>
        </SheetClose>
        {onAgentBranch ? (
          <div className="mt-0.5 space-y-0.5 border-l-[3px] border-border/70 pl-2 ml-1">
            {AGENT_SECTION_SLUGS.map((key) => {
              const base = `/settings/agent/${slugFromAgentSection(key)}`
              const active = pathname === base
              return (
                <SheetClose asChild key={key}>
                  <Link href={`${base}${clinicSuffix}`} className={subLinkClass(active)}>
                    {AGENT_SUBNAV_LABELS[key]}
                  </Link>
                </SheetClose>
              )
            })}
          </div>
        ) : null}

        <SheetClose asChild>
          <Link href={phoneHref} className={linkClass(pathname.startsWith('/settings/phone-summaries'))}>
            <Sparkles className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
            Phone &amp; summaries
          </Link>
        </SheetClose>
        <SheetClose asChild>
          <Link href={checkInsHref} className={linkClass(pathname.startsWith('/settings/check-ins'))}>
            <CalendarClock className="h-[1.125rem] w-[1.125rem] shrink-0 opacity-90" />
            Check-ins
          </Link>
        </SheetClose>
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-muted-foreground hover:text-foreground"
          onClick={() => {
            void setIsLoggedIn(false)
          }}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
