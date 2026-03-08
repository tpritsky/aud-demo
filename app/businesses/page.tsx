'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Building2, Users, Mail, Shield, UserCog } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'

interface Worker {
  id: string
  email: string
  full_name: string | null
  role: string
}

interface Business {
  id: string
  name: string
  vertical: string
  created_at: string
  workers: Worker[]
}

export default function BusinessesPage() {
  const router = useRouter()
  const { profile, isHydrated } = useAppStore()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isHydrated) return
    if (profile?.role !== 'super_admin') {
      router.replace('/dashboard')
      return
    }
  }, [isHydrated, profile, router])

  useEffect(() => {
    if (profile?.role !== 'super_admin') return

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          toast.error('Session expired')
          setLoading(false)
          return
        }
        const res = await fetch('/api/super-admin/businesses', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          if (res.status === 403) {
            router.replace('/dashboard')
            return
          }
          throw new Error('Failed to load')
        }
        const data = await res.json()
        setBusinesses(data.businesses || [])
      } catch {
        toast.error('Failed to load businesses')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [profile?.role, router])

  if (!isHydrated || profile?.role !== 'super_admin') {
    return null
  }

  return (
    <AppShell title="All businesses">
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Registered businesses</h2>
          <p className="text-sm text-muted-foreground">
            View all businesses and their workers. As a super admin you have full visibility.
          </p>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : businesses.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm text-muted-foreground">No businesses registered yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {businesses.map((b) => (
              <Card key={b.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                      <CardTitle className="text-base">{b.name}</CardTitle>
                      <Badge variant="secondary" className="font-normal capitalize">
                        {b.vertical}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {b.workers.length} {b.workers.length === 1 ? 'worker' : 'workers'}
                    </span>
                  </div>
                  <CardDescription>Business ID: {b.id}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  {b.workers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workers linked yet.</p>
                  ) : (
                    <ul className="divide-y divide-border rounded-md border">
                      {b.workers.map((w) => (
                        <li
                          key={w.id}
                          className="flex items-center justify-between px-3 py-2 first:rounded-t-md last:rounded-b-md"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                              <UserCog className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div>
                              <p className="font-medium text-sm">{w.full_name || w.email}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {w.email}
                              </p>
                            </div>
                          </div>
                          <Badge
                            variant={w.role === 'admin' ? 'default' : 'outline'}
                            className="gap-1 capitalize"
                          >
                            <Shield className="h-3 w-3" />
                            {w.role}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
