'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { Building2 } from 'lucide-react'

function isLikelyClinicUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s.trim())
}

export function SettingsClinicBanner() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const { profile, isHydrated } = useAppStore()
  const rawClinic = searchParams.get('clinic')?.trim() ?? ''
  const clinicQuery = rawClinic && isLikelyClinicUuid(rawClinic) ? rawClinic : null
  const editClinicId = profile?.role === 'super_admin' && clinicQuery ? clinicQuery : null

  const [editClinicName, setEditClinicName] = useState<string | null>(null)
  useEffect(() => {
    if (!editClinicId) {
      setEditClinicName(null)
      return
    }
    let cancelled = false
    ;(async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token || cancelled) return
        const res = await fetch(`/api/super-admin/businesses/${encodeURIComponent(editClinicId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const j = await res.json()
        if (!cancelled && res.ok && typeof j?.business?.name === 'string') {
          setEditClinicName(j.business.name)
        }
      } catch {
        /* ignore */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [editClinicId])

  useEffect(() => {
    if (!isHydrated) return
    const sp = new URLSearchParams(searchParams.toString())
    if (rawClinic && !clinicQuery) {
      sp.delete('clinic')
      const q = sp.toString()
      router.replace(q ? `${pathname}?${q}` : pathname)
      return
    }
    if (clinicQuery && profile?.role && profile.role !== 'super_admin') {
      sp.delete('clinic')
      const q = sp.toString()
      router.replace(q ? `${pathname}?${q}` : pathname)
    }
  }, [isHydrated, rawClinic, clinicQuery, profile?.role, pathname, router, searchParams])

  if (!editClinicId) return null

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 min-w-0">
        <Building2 className="h-4 w-4 shrink-0 text-primary mt-0.5" />
        <p className="text-foreground">
          <span className="font-medium">Editing this business</span>
          {editClinicName ? (
            <>
              : <span className="text-muted-foreground">{editClinicName}</span>
            </>
          ) : null}
          . Saved changes apply to this company only.
        </p>
      </div>
      <Button variant="outline" size="sm" className="shrink-0 self-start sm:self-center" asChild>
        <Link href="/businesses">Back to businesses</Link>
      </Button>
    </div>
  )
}
