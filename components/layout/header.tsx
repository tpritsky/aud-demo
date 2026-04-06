'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Bell, Search, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import type { ProfileRole } from '@/lib/types'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { MobileSidebar } from './mobile-sidebar'
import { CallReceptionistHeaderCta } from './call-receptionist-header-cta'

interface HeaderProps {
  title: string
}

/** Search is only wired for patient/call hubs — hide on settings, help, onboarding, etc. */
function shouldShowPatientCallSearch(pathname: string): boolean {
  if (pathname === '/dashboard' || pathname === '/calls') return true
  if (pathname.startsWith('/patients')) return true
  return false
}

function roleLabel(role: ProfileRole): string {
  if (role === 'super_admin') return 'Super admin'
  if (role === 'admin') return 'Administrator'
  return 'Team member'
}

function initialsForAccount(
  fullName: string | null | undefined,
  email: string,
  role: ProfileRole
): string {
  const n = fullName?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].slice(0, 2).toUpperCase()
    }
  }
  if (role === 'super_admin') return 'SA'
  const local = email.split('@')[0] || email
  return local.slice(0, 2).toUpperCase()
}

export function Header({ title }: HeaderProps) {
  const pathname = usePathname() || ''
  const showSearch = shouldShowPatientCallSearch(pathname)
  const { callbackTasks, setIsLoggedIn, sessionAccount } = useAppStore()
  const pendingTasks = callbackTasks.filter((t) => {
    // Derive status from attempts
    const hasAnswered = t.attempts.some(a => a.outcome === 'answered')
    const isExhausted = t.attempts.length >= t.maxAttempts && !hasAnswered
    return !hasAnswered && !isExhausted
  }).length

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/80 bg-card/90 px-4 backdrop-blur-md supports-[backdrop-filter]:bg-card/75 lg:px-8">
      <div className="flex min-w-0 shrink-0 items-center gap-4">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="lg:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Loading menu…</div>}>
              <MobileSidebar />
            </Suspense>
          </SheetContent>
        </Sheet>
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
      </div>

      <div className="flex min-w-0 flex-1 items-center justify-end gap-2 sm:gap-3 md:gap-4">
        {showSearch ? (
          <div className="relative hidden min-w-0 md:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search patients, calls..."
              className="w-52 pl-9 lg:w-64"
              aria-label="Search patients and calls"
            />
          </div>
        ) : null}

        <CallReceptionistHeaderCta />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {pendingTasks > 0 && (
                <Badge
                  variant="destructive"
                  className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs"
                >
                  {pendingTasks}
                </Badge>
              )}
              <span className="sr-only">Notifications</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80">
            <DropdownMenuLabel>Pending Callbacks</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {callbackTasks
              .filter((t) => {
                // Derive status from attempts
                const hasAnswered = t.attempts.some(a => a.outcome === 'answered')
                const isExhausted = t.attempts.length >= t.maxAttempts && !hasAnswered
                return !hasAnswered && !isExhausted
              })
              .slice(0, 5)
              .map((task) => (
                <DropdownMenuItem key={task.id} className="flex flex-col items-start gap-1">
                  <span className="font-medium">{task.patientName}</span>
                  <span className="text-xs text-muted-foreground line-clamp-1">
                    {task.callReason}
                  </span>
                </DropdownMenuItem>
              ))}
            {pendingTasks === 0 && (
              <DropdownMenuItem disabled>No pending callbacks</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {sessionAccount
                    ? initialsForAccount(sessionAccount.fullName, sessionAccount.email, sessionAccount.role)
                    : '…'}
                </AvatarFallback>
              </Avatar>
              <span className="sr-only">User menu</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="space-y-0.5">
              <span className="font-medium">
                {sessionAccount?.fullName?.trim() || sessionAccount?.email || 'Your account'}
              </span>
              {sessionAccount ? (
                <span className="block text-xs font-normal text-muted-foreground">
                  {roleLabel(sessionAccount.role)}
                </span>
              ) : null}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="cursor-pointer">
              <Link href="/settings/account">Account settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer"
              onSelect={() => {
                void (async () => {
                  try {
                    await setIsLoggedIn(false)
                  } catch (e) {
                    toast.error('Could not sign out', {
                      description: e instanceof Error ? e.message : 'Try again.',
                    })
                  }
                })()
              }}
            >
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
