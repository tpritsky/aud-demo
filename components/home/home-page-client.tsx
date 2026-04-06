'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AudiologyLanding } from '@/components/marketing/audiology-landing'
import { supabase } from '@/lib/supabase/client'

export function HomePageClient() {
  const router = useRouter()
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (typeof window === 'undefined') return
      const hash = window.location.hash
      const search = window.location.search

      if (search && search.includes('code=')) {
        router.replace('/reset-password' + search)
        return
      }
      if (
        hash &&
        (hash.includes('access_token=') || hash.includes('type=invite') || hash.includes('type=recovery'))
      ) {
        router.replace('/reset-password' + hash)
        return
      }

      let inviteErr: string | null = null
      if (hash && (hash.includes('error=') || hash.includes('error_code='))) {
        const params = new URLSearchParams(hash.replace(/^#/, '').replace(/&sb=$/, ''))
        const code = params.get('error_code')
        if (code === 'otp_expired' || params.get('error') === 'access_denied') {
          const desc = params.get('error_description')
          inviteErr =
            desc?.replace(/\+/g, ' ') ?? 'This invite or password reset link is invalid or has expired.'
        }
        window.history.replaceState(null, '', window.location.pathname + window.location.search)
      }

      if (inviteErr) {
        if (!cancelled) setAuthError(inviteErr)
        return
      }

      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (cancelled) return
        if (session) {
          router.replace('/dashboard')
        }
      } catch {
        // Stay on marketing site; do not block the page on session
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [router])

  if (authError) {
    return (
      <div className="min-h-screen bg-background">
        <div className="border-b border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <div className="container mx-auto flex flex-wrap items-center justify-between gap-3 px-4 py-4 lg:px-8">
            <p className="text-sm max-w-3xl">
              {authError}{' '}
              <span className="ml-1">
                Ask your team admin to send a new invite, or try signing in if you already have an account.
              </span>
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setAuthError(null)
                  router.replace('/login')
                }}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </div>
        <main className="container mx-auto px-4 py-12 text-center text-sm text-muted-foreground max-w-md">
          When you have a valid invite, open the link from your email again, or use Sign in if you already set a
          password.
        </main>
      </div>
    )
  }

  return <AudiologyLanding />
}
