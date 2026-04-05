'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, User, ArrowRight, ArrowLeft, Loader2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { DeleteTargetUserDialog } from '@/components/super-admin/delete-target-user-dialog'

interface ViewAsData {
  user: { id: string; email: string; full_name: string | null; role: string }
  clinicId: string | null
  clinic: { id: string; name: string; vertical: string } | null
}

export default function ViewAsPage() {
  const router = useRouter()
  const params = useParams()
  const userId = params.userId as string
  const { isHydrated } = useAppStore()
  const [viewerIsSuperAdmin, setViewerIsSuperAdmin] = useState(false)
  const [roleGateDone, setRoleGateDone] = useState(false)
  const [data, setData] = useState<ViewAsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isHydrated) return
    let cancelled = false
    ;(async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        if (!cancelled) router.replace('/dashboard')
        setRoleGateDone(true)
        return
      }
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      const j = (await res.json().catch(() => ({}))) as { role?: string }
      if (cancelled) return
      if (j.role !== 'super_admin') {
        router.replace('/dashboard')
        setRoleGateDone(true)
        return
      }
      setViewerIsSuperAdmin(true)
      setRoleGateDone(true)
    })()
    return () => {
      cancelled = true
    }
  }, [isHydrated, router])

  useEffect(() => {
    if (!userId || !viewerIsSuperAdmin) return
    const run = async () => {
      setLoading(true)
      setError(null)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          setError('Session expired')
          setLoading(false)
          return
        }
        const res = await fetch(`/api/super-admin/user-profile?userId=${encodeURIComponent(userId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          setError(err.error || 'Failed to load user')
          setLoading(false)
          return
        }
        const json = await res.json()
        setData(json)
      } catch {
        setError('Something went wrong')
      } finally {
        setLoading(false)
      }
    }
    run()
  }, [userId, viewerIsSuperAdmin])

  if (!isHydrated) return null
  if (!roleGateDone) {
    return (
      <AppShell title="View as user">
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </AppShell>
    )
  }
  if (!viewerIsSuperAdmin) return null

  return (
    <AppShell title="View as user">
      <div className="max-w-xl space-y-6">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/businesses" className="hover:text-foreground flex items-center gap-1">
            <ArrowLeft className="h-4 w-4" />
            Back to Super Admin
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-destructive">
              {error}
            </CardContent>
          </Card>
        ) : data ? (
          <>
            <Card className="gap-0 overflow-hidden border-border py-0">
              <div className="border-b border-border px-6 py-4 pt-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Viewing as</p>
                <p className="mt-1 text-xl font-semibold">{data.user.full_name || data.user.email}</p>
                <p className="text-sm text-muted-foreground">{data.user.email}</p>
              </div>
              <CardContent className="space-y-4 px-6 pb-5 pt-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <User className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="font-medium">Role</p>
                    <p className="text-sm text-muted-foreground capitalize">{data.user.role}</p>
                  </div>
                </div>
                {data.clinic ? (
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="font-medium">Business</p>
                      <p className="text-sm text-muted-foreground">{data.clinic.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{data.clinic.vertical}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Not assigned to a business</p>
                )}
              </CardContent>
            </Card>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button asChild className="gap-2">
                <Link href={`/dashboard?viewAs=${userId}`}>
                  View their dashboard
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/businesses">Back to companies</Link>
              </Button>
            </div>

            <DeleteTargetUserDialog
              userId={userId}
              displayLabel={data.user.full_name || data.user.email}
              onDeleted={() => router.replace('/businesses')}
            />
          </>
        ) : null}
      </div>
    </AppShell>
  )
}
