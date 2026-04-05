'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { clearLocalSupabaseSession } from '@/lib/supabase/clear-stale-session'
import { toast } from 'sonner'
import { Building2, Loader2, Sparkles } from 'lucide-react'

function AcceptInviteContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')?.trim() ?? ''

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [clinicName, setClinicName] = useState<string | null>(null)
  const [roleLabel, setRoleLabel] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (!token) {
      setInvalid(true)
      setLoading(false)
      return
    }
    void clearLocalSupabaseSession()
  }, [token])

  useEffect(() => {
    if (!token) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/invite/preview?token=${encodeURIComponent(token)}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok || cancelled) {
          setInvalid(true)
          setLoading(false)
          return
        }
        setEmail(typeof data.email === 'string' ? data.email : '')
        setFullName(typeof data.fullName === 'string' ? data.fullName : '')
        setClinicName(typeof data.clinicName === 'string' ? data.clinicName : null)
        const role = data.role === 'admin' ? 'admin' : 'member'
        setRoleLabel(role === 'admin' ? 'Administrator' : 'Team member')
      } catch {
        if (!cancelled) setInvalid(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password too short', { description: 'Use at least 6 characters.' })
      return
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch('/api/invite/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
          full_name: fullName.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not create account')
        setSubmitting(false)
        return
      }

      const signInEmail = typeof data.email === 'string' ? data.email : email
      const { error: signErr } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password,
      })
      if (signErr) {
        toast.success('Account created', {
          description: 'Sign in with your email and password.',
        })
        router.replace('/dashboard')
        return
      }
      toast.success('Welcome — you’re signed in')
      router.replace('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading invite…
        </p>
      </div>
    )
  }

  if (invalid || !token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-muted-foreground text-center max-w-sm">
          This invite link is invalid or has expired. Ask your admin to send a new one, or sign in if you already have an account.
        </p>
        <Button asChild variant="outline">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Sparkles className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Create your account</CardTitle>
          <CardDescription className="flex flex-col items-center gap-2 text-center">
            <span>
              {clinicName
                ? `You’re joining ${clinicName} as ${roleLabel}.`
                : `You’re joining as ${roleLabel}.`}
            </span>
            {clinicName ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-foreground">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {clinicName}
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="accept-email">Email</Label>
              <Input
                id="accept-email"
                type="email"
                value={email}
                readOnly
                tabIndex={-1}
                className="pointer-events-none bg-muted/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accept-name">Name</Label>
              <Input
                id="accept-name"
                type="text"
                autoComplete="name"
                placeholder="Your name (optional)"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">You can change this now; email is fixed to the invite.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="accept-password">Password</Label>
              <Input
                id="accept-password"
                type="password"
                autoComplete="new-password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="accept-confirm">Confirm password</Label>
              <Input
                id="accept-confirm"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating account…
                </>
              ) : (
                'Create account & sign in'
              )}
            </Button>
            <div className="text-center">
              <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground underline">
                Already have an account? Sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

export default function AcceptInvitePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <AcceptInviteContent />
    </Suspense>
  )
}
