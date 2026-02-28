'use client'

import React from 'react'
import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Headphones } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface LoginScreenProps {
  onLogin: () => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [loginError, setLoginError] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setLoginError(false)

    try {
      if (isForgotPassword) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined,
        })
        if (error) {
          toast.error('Reset failed', { description: error.message })
          setIsLoading(false)
          return
        }
        setResetSent(true)
        setIsLoading(false)
        return
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
          toast.error('Email Not Confirmed', {
            description: 'Please check your email and click the confirmation link.',
            duration: 6000,
          })
        } else {
          toast.error('Invalid login credentials', {
            description: 'Please check your email and password and try again.',
          })
        }
        setLoginError(true)
        setIsLoading(false)
        return
      }

      if (data.session) {
        toast.success('Logged in successfully')
        onLogin()
      }
    } catch (error) {
      console.error('Auth error:', error)
      toast.error('Login Failed', { description: 'An unexpected error occurred' })
      setLoginError(true)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary">
            <Headphones className="h-7 w-7 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Sign in</CardTitle>
          <CardDescription>
            {isForgotPassword
              ? "Enter your email and we'll send you a reset link"
              : 'Sign in to access your dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {resetSent ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Check your email for a link to reset your password. If you don&apos;t see it, check spam.
              </p>
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  setIsForgotPassword(false)
                  setResetSent(false)
                }}
              >
                Back to sign in
              </Button>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                {!isForgotPassword && (
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                  </div>
                )}
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading
                    ? isForgotPassword
                      ? 'Sending...'
                      : 'Signing in...'
                    : isForgotPassword
                      ? 'Send reset link'
                      : 'Sign in'}
                </Button>
                <div className="text-center space-y-1">
                  {isForgotPassword ? (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(false)}
                      className="text-sm text-muted-foreground hover:text-foreground underline"
                    >
                      Back to sign in
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsForgotPassword(true)}
                        className="text-sm text-muted-foreground hover:text-foreground underline block"
                      >
                        Forgot password?
                      </button>
                      <Link
                        href="/request-access"
                        className="text-sm text-muted-foreground hover:text-foreground underline block"
                      >
                        Not a member? Request access
                      </Link>
                    </>
                  )}
                </div>
              </form>
              {loginError && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Not a member yet?{' '}
                  <Link href="/request-access" className="underline hover:text-foreground">
                    Request access
                  </Link>
                  . Part of a company? Ask your system administrator to add you to your enterprise account.
                </p>
              )}
              {!loginError && !isForgotPassword && (
                <p className="mt-4 text-center text-sm text-muted-foreground">
                  Only pre-added members can sign in. Part of a company? Ask your system administrator to add you.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
