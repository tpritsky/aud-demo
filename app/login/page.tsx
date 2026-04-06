'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { prepareClientForFreshSignIn } from '@/lib/supabase/clear-stale-session'

function safeNextTarget(): string {
  let target = '/dashboard'
  if (typeof window === 'undefined') return target
  const next = new URLSearchParams(window.location.search).get('next')
  if (
    next &&
    next.startsWith('/') &&
    !next.startsWith('//') &&
    !next.includes(':') &&
    !next.includes('@')
  ) {
    target = next
  }
  return target
}

/**
 * Marketing “Sign in” lands here briefly: clear client session fast (no global sign-out — it can hang),
 * then continue to the app shell login form.
 */
export default function LoginPage() {
  const router = useRouter()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      await prepareClientForFreshSignIn()
      if (cancelled) return
      router.replace(safeNextTarget())
    })()
    return () => {
      cancelled = true
    }
  }, [router])

  return <div className="min-h-screen bg-background" />
}
