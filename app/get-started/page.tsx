'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Building2, LogIn, ArrowRight } from 'lucide-react'

export default function GetStartedPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border/40 bg-background/95 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 lg:px-8">
          <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
            Get started
          </Link>
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Get started
            </h1>
            <p className="mt-2 text-muted-foreground">
              Choose an option below to continue.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Link href="/request-access" className="block">
              <Card className="h-full transition-colors hover:border-primary hover:bg-muted/50">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                    <Building2 className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">Register new business</CardTitle>
                  <CardDescription>
                    Submit a short form and we&apos;ll get in touch to set up your account.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" size="lg">
                    Continue
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>

            <Link href="/dashboard" className="block">
              <Card className="h-full transition-colors hover:border-primary hover:bg-muted/50">
                <CardHeader>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 text-primary mb-2">
                    <LogIn className="h-6 w-6" />
                  </div>
                  <CardTitle className="text-xl">Log into existing business</CardTitle>
                  <CardDescription>
                    Already have access? Sign in with your email and password.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button variant="outline" className="w-full" size="lg">
                    Sign in
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            </Link>
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Part of a company? Ask your system administrator to add you to your enterprise account.
          </p>
        </div>
      </main>
    </div>
  )
}
