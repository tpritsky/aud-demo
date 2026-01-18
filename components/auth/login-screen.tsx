'use client'

import React from "react"

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
  const [isSignUp, setIsSignUp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    
    try {
      if (isSignUp) {
        // Sign up new user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        })

        if (error) {
          toast.error('Sign Up Failed', {
            description: error.message,
          })
          setIsLoading(false)
          return
        }

        if (data.user) {
          // Check if email confirmation is required
          if (data.user.email_confirmed_at === null) {
            toast.info('Account created!', {
              description: 'Please check your email to confirm your account, or disable email confirmation in Supabase settings.',
              duration: 5000,
            })
          } else {
            toast.success('Account created! Please sign in.')
          }
          setIsSignUp(false)
          // Clear password field
          setPassword('')
        }
      } else {
        // Sign in existing user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          // Check if it's an email confirmation error
          if (error.message.includes('not confirmed') || error.message.includes('Email not confirmed')) {
            toast.error('Email Not Confirmed', {
              description: 'Please check your email and click the confirmation link, or disable email confirmation in Supabase Dashboard → Authentication → Settings.',
              duration: 6000,
            })
          } else {
            toast.error('Login Failed', {
              description: error.message,
            })
          }
          setIsLoading(false)
          return
        }

        if (data.session) {
          toast.success('Logged in successfully')
          onLogin()
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      toast.error(isSignUp ? 'Sign Up Failed' : 'Login Failed', {
        description: 'An unexpected error occurred',
      })
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
          <CardTitle className="text-2xl">Audiology Voice Agent</CardTitle>
          <CardDescription>
            {isSignUp ? 'Create an account to get started' : 'Sign in to access your clinic dashboard'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@clinic.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder={isSignUp ? "Choose a password (min 6 characters)" : "Enter your password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading 
                ? (isSignUp ? 'Creating account...' : 'Signing in...') 
                : (isSignUp ? 'Sign Up' : 'Sign In')}
            </Button>
            <div className="text-center">
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setPassword('')
                }}
                className="text-sm text-muted-foreground hover:text-foreground underline"
              >
                {isSignUp 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
