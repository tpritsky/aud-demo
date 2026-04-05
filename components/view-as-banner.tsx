'use client'

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
    <div className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-primary/20 bg-primary/10 px-4 py-2.5 text-foreground dark:border-primary/30 dark:bg-primary/15 dark:text-foreground lg:pl-[calc(15rem+2rem)] lg:pr-8">
      <p className="min-w-0 flex-1 basis-full text-sm font-medium sm:basis-auto sm:flex-none">
        <span className="block break-words">
          Viewing as <strong className="font-semibold">{viewAs.displayName}</strong>
        </span>
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="secondary" className="gap-1.5" onClick={() => void handleExit()}>
          <EyeOff className="h-4 w-4" />
          Exit View
        </Button>
      </div>
    </div>
  )
}
