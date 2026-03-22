'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Building2, Sparkles } from 'lucide-react'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isReady, setIsReady] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [checkTimedOut, setCheckTimedOut] = useState(false)
  const [inviteOnboarding, setInviteOnboarding] = useState(false)
  const [clinicName, setClinicName] = useState<string | null>(null)

  useEffect(() => {
    let done = false
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search)
      const hash = window.location.hash
      const fromQuery = sp.get('flow') === 'invite'
      const fromHash = Boolean(hash && hash.includes('type=invite'))
      setInviteOnboarding(fromQuery || fromHash)
    }

    const timeoutId = setTimeout(() => {
      if (done) return
      done = true
      setCheckTimedOut(true)
      setIsChecking(false)
    }, 12000)

    const loadClinicLabel = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) return
      const { data: row } = await supabase
        .from('profiles')
        .select('clinics(name)')
        .eq('id', session.user.id)
        .maybeSingle()
      const nested = row as { clinics?: { name?: string } | null } | null
      const name = nested?.clinics?.name
      if (name) setClinicName(name)
    }

    const init = async () => {
      try {
        const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
        const code = params?.get('code')
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (done) return
          if (error) {
            toast.error('Invalid or expired link', { description: error.message || 'Please request a new password reset link.' })
            router.replace('/dashboard')
            setIsChecking(false)
            return
          }
          done = true
          if (typeof window !== 'undefined') {
            const path = window.location.pathname
            const keepInvite = params?.get('flow') === 'invite'
            window.history.replaceState(null, '', keepInvite ? `${path}?flow=invite` : path)
          }
          setIsReady(true)
          setIsChecking(false)
          await loadClinicLabel()
          return
        }

        const { data: { session } } = await supabase.auth.getSession()
        if (done) return
        if (session?.user) {
          setIsReady(true)
          await loadClinicLabel()
        } else {
          toast.error('Invalid or expired link', {
            description: 'Please request a new password reset link.',
          })
          router.replace('/dashboard')
        }
      } catch (e) {
        if (!done) {
          console.error('Reset password init error:', e)
          toast.error('Something went wrong', { description: 'Please try again or request a new link.' })
          router.replace('/dashboard')
        }
      } finally {
        if (!done) setIsChecking(false)
      }
    }

    init()
    return () => {
      done = true
      clearTimeout(timeoutId)
    }
  }, [router])

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
    setIsLoading(true)
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) {
        toast.error('Update failed', { description: error.message })
        setIsLoading(false)
        return
      }
      toast.success(inviteOnboarding ? 'You’re all set' : 'Password updated. Signing you in…')
      router.replace('/dashboard')
    } catch {
      toast.error('Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  if (isChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <p className="text-muted-foreground">Checking link...</p>
      </div>
    )
  }

  if (checkTimedOut && !isReady) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background p-4">
        <p className="text-muted-foreground text-center max-w-sm">
          This is taking too long. The link may have expired or there may be a connection issue.
        </p>
        <Link href="/dashboard">
          <Button variant="outline">Back to sign in</Button>
        </Link>
        <p className="text-sm text-muted-foreground">
          Use &quot;Forgot password?&quot; to request a new link.
        </p>
      </div>
    )
  }

  if (!isReady) return null

  const title = inviteOnboarding ? 'Welcome — finish your account' : 'Set new password'
  const description = inviteOnboarding
    ? clinicName
      ? `You’re joining ${clinicName}. Choose a password to access the dashboard.`
      : 'Choose a password to access your team’s dashboard.'
    : 'Enter your new password below.'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {inviteOnboarding ? (
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
          ) : null}
          <CardTitle className="text-2xl">{title}</CardTitle>
          <CardDescription className="flex flex-col items-center gap-2 text-center">
            <span>{description}</span>
            {inviteOnboarding && clinicName ? (
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
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Saving…' : inviteOnboarding ? 'Complete setup' : 'Update password'}
            </Button>
            <div className="text-center">
              <Link
                href="/dashboard"
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                Back to sign in
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
