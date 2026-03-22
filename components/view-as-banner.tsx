'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { EyeOff } from 'lucide-react'

export function ViewAsBanner() {
  const router = useRouter()
  const { viewAs, clearViewAs } = useAppStore()

  // While impersonating, `profile` is swapped to the target user — don’t gate on profile.role.
  if (!viewAs) return null

  const handleExit = async () => {
    await clearViewAs()
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      if (u.pathname === '/dashboard' && u.searchParams.has('viewAs')) {
        router.replace('/dashboard')
      }
    }
  }

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
      <p className="text-sm font-medium">
        Viewing as <strong>{viewAs.displayName}</strong>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/businesses">
          <Button variant="outline" size="sm" className="border-amber-300 dark:border-amber-700">
            Super Admin
          </Button>
        </Link>
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void handleExit()}>
          <EyeOff className="h-4 w-4" />
          Exit view & restore my account
        </Button>
      </div>
    </div>
  )
}
