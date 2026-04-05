'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { clearLocalSupabaseSession } from '@/lib/supabase/clear-stale-session'

/**
 * Entry for “Sign in” from marketing: clears cached Supabase session first so users always get the
 * real password screen (avoids stale cookies showing an empty “Your clinic” shell).
 */
export default function LoginPage() {
  const router = useRouter()
  const [status, setStatus] = useState('Signing out of any previous session…')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { error } = await supabase.auth.signOut({ scope: 'global' })
        if (error) throw error
      } catch {
        await clearLocalSupabaseSession()
      }
      if (cancelled) return
      setStatus('Continue to sign in…')
      let target = '/dashboard'
      if (typeof window !== 'undefined') {
        const next = new URLSearchParams(window.location.search).get('next')
        if (next && next.startsWith('/') && !next.startsWith('//')) {
          target = next
        }
      }
      router.replace(target)
    })()

    return () => {
      cancelled = true
    }
  }, [router])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-muted/30 px-4">
      <Loader2 className="h-8 w-8 animate-spin text-emerald-600" aria-hidden />
      <p className="text-center text-sm text-muted-foreground">{status}</p>
    </div>
  )
}
