'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import Link from 'next/link'
import {
  Building2,
  Users,
  UserCog,
  Mail,
  Shield,
  Plus,
  ChevronRight,
  Loader2,
  Trash2,
  Search,
  X,
  Eye,
  Phone,
  Mic,
  Save,
  UserPlus,
  Link2,
  Settings,
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { getAccessTokenWithBudget } from '@/lib/supabase/session-read'
import { fetchWithTimeout, isLikelyAbortError } from '@/lib/utils'
import type { AgentConfig, Call } from '@/lib/types'
import { formatDateTime, formatDuration } from '@/lib/format'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { defaultAgentConfig } from '@/lib/data'
import { KNOWLEDGE_ITEM_BODY_MAX_CHARS } from '@/lib/clinic-call-ai'
import { formatPhoneDisplay, normalizePhoneNumber } from '@/lib/phone-format'
import { InviteUserDialog } from '@/components/invite-user-dialog'
import { ConvaiLinePhoneField } from '@/components/settings/convai-line-phone-field'

interface Member {
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
  admins: Member[]
  workers: Member[]
}

interface ClinicAssignment {
  clinicId: string
  clinicName: string
  role: string
}

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  clinic_id: string | null
  clinicAssignments?: ClinicAssignment[]
}

function roleAtBusinessLabel(role: string): string {
  if (role === 'admin') return 'Administrator'
  if (role === 'member') return 'Team member'
  if (role === 'super_admin') return 'Super admin'
  return role
}

const SUPER_ADMIN_FETCH_MS = 22_000

async function getToken() {
  return getAccessTokenWithBudget()
}

export default function BusinessesPage() {
  const router = useRouter()
  const { profile, isHydrated, setProfile } = useAppStore()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createVertical, setCreateVertical] = useState('general')
  const [createWebsiteUrl, setCreateWebsiteUrl] = useState('')
  const [analyzingFromUrl, setAnalyzingFromUrl] = useState(false)
  const [urlAnalysis, setUrlAnalysis] = useState<{
    description: string | null
    locations: string[]
    sizeOrScaleHint: string | null
    confidenceNotes: string | null
    websiteUrl: string
    knowledgeTitles: string[]
  } | null>(null)
  /** Seeded into clinic settings as knowledge cards when the business is created */
  const [pendingKnowledgeFromUrl, setPendingKnowledgeFromUrl] = useState<{ title: string; body: string }[]>([])
  const [creating, setCreating] = useState(false)
  const [assignClinicId, setAssignClinicId] = useState<string>('')
  const [assigningUserId, setAssigningUserId] = useState<string | null>(null)
  const [detailBusiness, setDetailBusiness] = useState<Business | null>(null)
  const [deleteConfirmBusiness, setDeleteConfirmBusiness] = useState<Business | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [addAdminSearch, setAddAdminSearch] = useState('')
  const [addWorkerSearch, setAddWorkerSearch] = useState('')
  const [assigningRoleUserId, setAssigningRoleUserId] = useState<string | null>(null)
  const [unassigningUserId, setUnassigningUserId] = useState<string | null>(null)
  const [pendingAssign, setPendingAssign] = useState<{ user: UserRow; role: 'admin' | 'member' } | null>(null)
  const [pendingAssignMain, setPendingAssignMain] = useState<{ user: UserRow; clinicId: string } | null>(null)
  const [pendingUnassign, setPendingUnassign] = useState<{ user: Member; isAdmin: boolean } | null>(null)
  const [viewAsSearch, setViewAsSearch] = useState('')
  const [detailAgentConfig, setDetailAgentConfig] = useState<AgentConfig | null>(null)
  const [detailAgentConfigLoading, setDetailAgentConfigLoading] = useState(false)
  const [detailAgentConfigSaving, setDetailAgentConfigSaving] = useState(false)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [businessCalls, setBusinessCalls] = useState<Call[]>([])
  const [businessCallsLoading, setBusinessCallsLoading] = useState(false)
  const [previewClinicId, setPreviewClinicId] = useState<string>('_none')
  const [savingPreviewClinic, setSavingPreviewClinic] = useState(false)

  const sortedBusinessCalls = useMemo(() => {
    const tier = (n: 1 | 2 | 3 | 4 | null | undefined) => (n == null ? 0 : n)
    return [...businessCalls].sort((a, b) => {
      const du = tier(b.aiResponseUrgency) - tier(a.aiResponseUrgency)
      if (du !== 0) return du
      const dv = tier(b.aiBusinessValue) - tier(a.aiBusinessValue)
      if (dv !== 0) return dv
      return b.timestamp.getTime() - a.timestamp.getTime()
    })
  }, [businessCalls])

  useEffect(() => {
    if (!detailBusiness) {
      setBusinessCalls([])
      return
    }
    let cancelled = false
    ;(async () => {
      setBusinessCallsLoading(true)
      try {
        const token = await getToken()
        if (!token || cancelled) return
        const res = await fetch(
          `/api/super-admin/businesses/${detailBusiness.id}/calls?limit=150`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        const data = await res.json()
        if (!cancelled && res.ok) {
          const list = (data.calls || []) as Call[]
          setBusinessCalls(
            list.map((c) => ({
              ...c,
              timestamp: new Date(c.timestamp as unknown as string),
              aiProcessedAt: c.aiProcessedAt
                ? new Date(c.aiProcessedAt as unknown as string)
                : null,
            }))
          )
        }
      } finally {
        if (!cancelled) setBusinessCallsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [detailBusiness?.id])

  const loadBusinesses = useCallback(async () => {
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetchWithTimeout(
        '/api/super-admin/businesses',
        { headers: { Authorization: `Bearer ${token}` } },
        SUPER_ADMIN_FETCH_MS
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to load businesses')
        return
      }
      setBusinesses(data.businesses || [])
    } catch (e) {
      if (isLikelyAbortError(e)) {
        toast.error('Request timed out', { description: 'Check your connection and try again.' })
      } else {
        console.error('loadBusinesses:', e)
        toast.error('Failed to load businesses')
      }
    }
  }, [])

  const loadUsers = useCallback(async (notifyIfNoSession?: boolean) => {
    setUsersLoading(true)
    try {
      const token = await getToken()
      if (!token) {
        if (notifyIfNoSession) {
          toast.error('Could not read your session', {
            description: 'Refresh the page or sign in again.',
          })
        }
        return
      }
      const res = await fetchWithTimeout(
        '/api/super-admin/users',
        { headers: { Authorization: `Bearer ${token}` } },
        SUPER_ADMIN_FETCH_MS
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Failed to load users')
        return
      }
      setUsers(data.users || [])
    } catch (e) {
      if (isLikelyAbortError(e)) {
        toast.error('Request timed out', { description: 'Check your connection and try again.' })
      } else {
        console.error('loadUsers:', e)
        toast.error('Failed to load users')
      }
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!isHydrated) return
    if (profile?.role !== 'super_admin') {
      router.replace('/dashboard')
      return
    }
  }, [isHydrated, profile, router])

  useEffect(() => {
    if (profile?.role !== 'super_admin') return
    let cancelled = false
    const run = async () => {
      setLoading(true)
      setUsersLoading(true)
      try {
        const token = await getAccessTokenWithBudget()
        if (cancelled) return
        if (!token) {
          toast.error('Could not load your session', {
            description: 'Refresh the page or sign in again.',
          })
          return
        }
        const [bizRes, usersRes] = await Promise.all([
          fetchWithTimeout(
            '/api/super-admin/businesses',
            { headers: { Authorization: `Bearer ${token}` } },
            SUPER_ADMIN_FETCH_MS
          ),
          fetchWithTimeout(
            '/api/super-admin/users',
            { headers: { Authorization: `Bearer ${token}` } },
            SUPER_ADMIN_FETCH_MS
          ),
        ])
        if (cancelled) return
        const bizData = await bizRes.json().catch(() => ({}))
        const usersData = await usersRes.json().catch(() => ({}))
        if (!bizRes.ok) {
          toast.error(typeof bizData.error === 'string' ? bizData.error : 'Failed to load businesses')
        } else {
          setBusinesses(bizData.businesses || [])
        }
        if (!usersRes.ok) {
          toast.error(typeof usersData.error === 'string' ? usersData.error : 'Failed to load users')
        } else {
          setUsers(usersData.users || [])
        }
      } catch (e) {
        if (!cancelled) {
          if (isLikelyAbortError(e)) {
            toast.error('Request timed out', { description: 'Check your connection and try again.' })
          } else {
            console.error('Super admin bootstrap:', e)
            toast.error('Failed to load Super Admin data')
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
          setUsersLoading(false)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [profile?.role])

  useEffect(() => {
    if (profile?.clinicId) setPreviewClinicId(profile.clinicId)
    else setPreviewClinicId('_none')
  }, [profile?.clinicId])

  // When detail sheet opens, load agent config from clinic-settings (healed phone from ConvAI line) with businesses fallback
  useEffect(() => {
    if (!detailBusiness) {
      setDetailAgentConfig(null)
      return
    }
    let cancelled = false
    setDetailAgentConfigLoading(true)
    getToken().then(async (token) => {
      if (!token) return
      try {
        let merged: AgentConfig | null = null
        const cs = await fetch(
          `/api/super-admin/clinic-settings?clinicId=${encodeURIComponent(detailBusiness.id)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        )
        if (cs.ok) {
          const dj = (await cs.json()) as { agentConfig?: AgentConfig | null }
          if (dj?.agentConfig && typeof dj.agentConfig === 'object') {
            merged = { ...defaultAgentConfig, ...dj.agentConfig }
          }
        }
        if (!merged) {
          const br = await fetch(`/api/super-admin/businesses/${detailBusiness.id}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          const data = br.ok ? await br.json() : null
          const existing = data?.business?.settings?.agentConfig as AgentConfig | undefined
          merged = {
            ...defaultAgentConfig,
            ...existing,
            clinicName: existing?.clinicName ?? detailBusiness.name,
            phoneNumber: existing?.phoneNumber ?? '',
          }
        }
        if (cancelled) return
        setDetailAgentConfig({
          ...merged,
          clinicName: merged.clinicName?.trim() || detailBusiness.name,
          phoneNumber: merged.phoneNumber?.trim() || '',
        })
      } catch {
        if (!cancelled) {
          setDetailAgentConfig({ ...defaultAgentConfig, clinicName: detailBusiness.name, phoneNumber: '' })
        }
      } finally {
        if (!cancelled) setDetailAgentConfigLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [detailBusiness?.id, detailBusiness?.name])

  const persistDetailVoiceConfig = async (config: AgentConfig) => {
    if (!detailBusiness) return
    setDetailAgentConfigSaving(true)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        return
      }
      const res = await fetch(`/api/super-admin/businesses/${detailBusiness.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ settings: { agentConfig: config } }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
      }
      const heal = await fetch(
        `/api/super-admin/clinic-settings?clinicId=${encodeURIComponent(detailBusiness.id)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      if (heal.ok) {
        const hj = (await heal.json()) as { agentConfig?: AgentConfig | null }
        if (hj?.agentConfig && typeof hj.agentConfig === 'object') {
          setDetailAgentConfig({
            ...defaultAgentConfig,
            ...hj.agentConfig,
            clinicName: hj.agentConfig.clinicName?.trim() || detailBusiness.name,
            phoneNumber: hj.agentConfig.phoneNumber?.trim() || '',
          })
        }
      }
      toast.success('Voice agent settings saved', {
        description: 'This clinic’s number and agent are now configured. They don’t need to set anything in Settings.',
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save voice agent settings')
    } finally {
      setDetailAgentConfigSaving(false)
    }
  }

  const handleSaveVoiceAgentConfig = () => {
    if (!detailAgentConfig) return
    void persistDetailVoiceConfig(detailAgentConfig)
  }

  const handleCreateBusiness = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!createName.trim()) {
      toast.error('Enter a business name')
      return
    }
    setCreating(true)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        setCreating(false)
        return
      }
      const res = await fetch('/api/super-admin/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: createName.trim(), vertical: createVertical }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      const newId = data.business?.id as string | undefined
      if (newId && pendingKnowledgeFromUrl.length > 0) {
        const knowledgeItems = pendingKnowledgeFromUrl.map((k, i) => ({
          id:
            typeof crypto !== 'undefined' && crypto.randomUUID
              ? crypto.randomUUID()
              : `k-${Date.now()}-${i}`,
          title: k.title.slice(0, 200),
          body: k.body.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS),
          enabled: true,
          sortOrder: i,
        }))
        const patchRes = await fetch(`/api/super-admin/businesses/${newId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            settings: { callAi: { knowledgeItems } },
          }),
        })
        if (!patchRes.ok) {
          const pj = await patchRes.json().catch(() => ({}))
          console.warn('Could not seed knowledge:', pj)
        }
      }
      toast.success('Business created')
      if (newId) {
        router.push(`/get-started?clinicId=${encodeURIComponent(newId)}`)
      }
      setCreateName('')
      setCreateVertical('general')
      setCreateWebsiteUrl('')
      setUrlAnalysis(null)
      setPendingKnowledgeFromUrl([])
      await loadBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create business')
    } finally {
      setCreating(false)
    }
  }

  const handleAnalyzeBusinessUrl = async () => {
    if (!createWebsiteUrl.trim()) {
      toast.error('Paste a website URL')
      return
    }
    setAnalyzingFromUrl(true)
    setUrlAnalysis(null)
    setPendingKnowledgeFromUrl([])
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        return
      }
      const res = await fetch('/api/super-admin/analyze-business-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: createWebsiteUrl.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      if (typeof data.businessName === 'string' && data.businessName.trim()) {
        setCreateName(data.businessName.trim())
      }
      if (typeof data.vertical === 'string') {
        setCreateVertical(data.vertical)
      }
      const rawKi = Array.isArray(data.knowledgeItems) ? data.knowledgeItems : []
      const knowledgePairs: { title: string; body: string }[] = []
      const knowledgeTitles: string[] = []
      for (const row of rawKi) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const t = typeof o.title === 'string' ? o.title.trim() : ''
        const b = typeof o.body === 'string' ? o.body.trim() : ''
        if (!t || !b) continue
        knowledgePairs.push({ title: t.slice(0, 200), body: b.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS) })
        knowledgeTitles.push(t)
      }
      setPendingKnowledgeFromUrl(knowledgePairs)
      setUrlAnalysis({
        description: typeof data.description === 'string' ? data.description : null,
        locations: Array.isArray(data.locations) ? data.locations : [],
        sizeOrScaleHint: typeof data.sizeOrScaleHint === 'string' ? data.sizeOrScaleHint : null,
        confidenceNotes: typeof data.confidenceNotes === 'string' ? data.confidenceNotes : null,
        websiteUrl: typeof data.websiteUrl === 'string' ? data.websiteUrl : createWebsiteUrl.trim(),
        knowledgeTitles,
      })
      toast.success('Prefilled from website')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Analysis failed')
    } finally {
      setAnalyzingFromUrl(false)
    }
  }

  const handleDeleteBusiness = async () => {
    if (!deleteConfirmBusiness) return
    setDeleting(true)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        setDeleting(false)
        return
      }
      const res = await fetch(`/api/super-admin/businesses/${deleteConfirmBusiness.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Business deleted. Admins and workers have been unassigned.')
      setDetailBusiness(null)
      setDeleteConfirmBusiness(null)
      await loadBusinesses()
      await loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete business')
    } finally {
      setDeleting(false)
    }
  }

  const confirmAssignRole = async () => {
    if (!pendingAssign || !detailBusiness) return
    const { user, role } = pendingAssign
    setAssigningRoleUserId(user.id)
    setPendingAssign(null)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        setAssigningRoleUserId(null)
        return
      }
      const res = await fetch('/api/super-admin/assign-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId: user.id, clinicId: detailBusiness.id, role }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign')
      }
      toast.success(role === 'admin' ? 'Admin added' : 'Worker added')
      setAddAdminSearch('')
      setAddWorkerSearch('')
      await loadUsers()
      await loadBusinesses()
      const refreshed = await fetch('/api/super-admin/businesses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      const updated = (refreshed.businesses || []).find((b: Business) => b.id === detailBusiness.id)
      if (updated) setDetailBusiness(updated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign')
    } finally {
      setAssigningRoleUserId(null)
    }
  }

  const confirmUnassign = async () => {
    if (!pendingUnassign) return
    const userId = pendingUnassign.user.id
    setPendingUnassign(null)
    setUnassigningUserId(userId)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        setUnassigningUserId(null)
        return
      }
      const res = await fetch('/api/super-admin/unassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove')
      }
      toast.success('Removed from business')
      await loadUsers()
      await loadBusinesses()
      if (detailBusiness) {
        const refreshed = await fetch('/api/super-admin/businesses', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
        const updated = (refreshed.businesses || []).find((b: Business) => b.id === detailBusiness.id)
        if (updated) setDetailBusiness(updated)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove')
    } finally {
      setUnassigningUserId(null)
    }
  }

  const handleAssignAdmin = async (userId: string, clinicIdOverride?: string) => {
    const clinicId = clinicIdOverride ?? assignClinicId
    if (!clinicId) {
      toast.error('Select a business first')
      return
    }
    setAssigningUserId(userId)
    try {
      const token = await getToken()
      if (!token) {
        toast.error('Session expired')
        setAssigningUserId(null)
        return
      }
      const res = await fetch('/api/super-admin/assign-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ userId, clinicId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to assign')
      }
      toast.success('Admin assigned')
      await loadBusinesses()
      await loadUsers()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign admin')
    } finally {
      setAssigningUserId(null)
    }
  }

  const savePreviewClinic = async () => {
    const clinicId = previewClinicId === '_none' ? null : previewClinicId
    setSavingPreviewClinic(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not signed in')
      const res = await fetch('/api/super-admin/link-my-clinic', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Failed to update')
      }
      const nextId = (data.clinicId ?? null) as string | null
      if (profile) {
        setProfile({ role: profile.role, clinicId: nextId })
      }
      toast.success(nextId ? 'Clinic linked for Settings & calls' : 'Clinic link cleared')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSavingPreviewClinic(false)
    }
  }

  if (!isHydrated || profile?.role !== 'super_admin') {
    return null
  }

  const viewAsFilteredUsers = users.filter((u) => {
    const q = viewAsSearch.trim().toLowerCase()
    if (!q) return true
    if (u.email?.toLowerCase().includes(q)) return true
    if (u.full_name?.toLowerCase().includes(q)) return true
    return (u.clinicAssignments || []).some((a) => a.clinicName.toLowerCase().includes(q))
  })

  return (
    <AppShell title="Super Admin">
      <div className="space-y-8">
        {/* Page header */}
        <div className="rounded-xl border bg-card px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight">Super Admin</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage businesses, assign admins and workers, and view the app as any user.
          </p>
        </div>

        {/* Super admin: link own profile to a clinic (fixes "no clinic assigned" without demoting) */}
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5 text-primary" />
              Your preview clinic
            </CardTitle>
            <CardDescription>
              Super admins have no clinic by default. Pick a business here so Settings → Phone &amp; summaries and
              clinic data use that clinic. Your role stays super admin.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label>Clinic</Label>
              <Select value={previewClinicId} onValueChange={setPreviewClinicId} disabled={loading}>
                <SelectTrigger className="w-full sm:max-w-md">
                  <SelectValue placeholder={loading ? 'Loading…' : 'Choose a clinic'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">No clinic (platform only)</SelectItem>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={savePreviewClinic}
              disabled={savingPreviewClinic || loading}
              className="shrink-0"
            >
              {savingPreviewClinic ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* View as user */}
        <Card className="overflow-hidden border-border shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="h-5 w-5 text-primary" />
              View as user
            </CardTitle>
            <CardDescription>
              See the app exactly as an admin or worker would. Search for a user and open their view.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by email or name..."
                className="pl-9 h-10"
                value={viewAsSearch}
                onChange={(e) => setViewAsSearch(e.target.value)}
              />
            </div>
            <div className="max-h-[min(24rem,50vh)] overflow-y-auto rounded-lg border border-border bg-card">
              {usersLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : viewAsFilteredUsers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No users match.</p>
              ) : (
                <ul className="divide-y p-1">
                  {viewAsFilteredUsers.slice(0, 30).map((u) => (
                    <li key={u.id}>
                      <Link
                        href={`/view-as/${u.id}`}
                        className="flex items-start justify-between gap-3 rounded-md px-3 py-2.5 text-sm hover:bg-muted transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0 flex-1">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background mt-0.5">
                            <Mail className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <p className="font-medium break-words">{u.full_name || u.email}</p>
                            <p className="text-xs text-muted-foreground break-all">{u.email}</p>
                            {u.clinicAssignments && u.clinicAssignments.length > 0 ? (
                              <ul className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                                {u.clinicAssignments.map((a) => (
                                  <li key={a.clinicId} className="break-words">
                                    <span className="text-foreground/90 font-medium">{a.clinicName}</span>
                                    <span className="text-muted-foreground"> · {roleAtBusinessLabel(a.role)}</span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-xs text-muted-foreground/80 italic">No business assigned</p>
                            )}
                          </div>
                        </div>
                        <span className="flex items-center gap-1 text-xs text-primary shrink-0 pt-1">
                          View as <ChevronRight className="h-3 w-3" />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Create new business */}
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              Create new business
            </CardTitle>
            <CardDescription>
              Add a new company. Optionally paste their website — we&apos;ll suggest name, business type, and starter
              knowledge from the page. Review everything, then create.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-2xl">
              <Label htmlFor="business-website-url" className="inline-flex items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>Website URL (optional)</span>
              </Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                <Input
                  id="business-website-url"
                  className="h-10 w-full sm:flex-1 sm:min-w-0"
                  placeholder="https://example.com"
                  value={createWebsiteUrl}
                  onChange={(e) => {
                    setCreateWebsiteUrl(e.target.value)
                    setUrlAnalysis(null)
                    setPendingKnowledgeFromUrl([])
                  }}
                />
                <Button
                  type="button"
                  variant="default"
                  className="h-10 shrink-0 px-4 font-medium inline-flex items-center justify-center gap-2 leading-none"
                  disabled={analyzingFromUrl || creating}
                  onClick={handleAnalyzeBusinessUrl}
                >
                  {analyzingFromUrl ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                      Analyzing…
                    </>
                  ) : (
                    'Analyze & prefill'
                  )}
                </Button>
              </div>
              {urlAnalysis ? (
                <div className="rounded-md border border-border/80 bg-card px-3 py-2 text-sm text-muted-foreground space-y-1">
                  {urlAnalysis.description ? <p>{urlAnalysis.description}</p> : null}
                  {urlAnalysis.locations.length > 0 ? (
                    <p>
                      <span className="font-medium text-foreground/80">Locations: </span>
                      {urlAnalysis.locations.join(', ')}
                    </p>
                  ) : null}
                  {urlAnalysis.sizeOrScaleHint ? (
                    <p>
                      <span className="font-medium text-foreground/80">Scale: </span>
                      {urlAnalysis.sizeOrScaleHint}
                    </p>
                  ) : null}
                  {urlAnalysis.confidenceNotes ? (
                    <p className="text-xs italic border-t border-border/60 pt-2 mt-2">
                      {urlAnalysis.confidenceNotes}
                    </p>
                  ) : null}
                  {urlAnalysis.knowledgeTitles.length > 0 ? (
                    <div className="border-t border-border/60 pt-2 mt-2">
                      <p className="font-medium text-foreground/80 text-xs mb-1">
                        Phone receptionist knowledge ({urlAnalysis.knowledgeTitles.length} cards — saved when you create)
                      </p>
                      <ul className="text-xs list-disc pl-4 space-y-0.5">
                        {urlAnalysis.knowledgeTitles.slice(0, 12).map((t, i) => (
                          <li key={`${i}-${t}`}>{t}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  <p className="text-xs pt-1 truncate" title={urlAnalysis.websiteUrl}>
                    Source: {urlAnalysis.websiteUrl}
                  </p>
                </div>
              ) : null}
            </div>
            <form
              onSubmit={handleCreateBusiness}
              className="flex max-w-2xl flex-col gap-4 sm:flex-row sm:items-end sm:gap-4"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Label htmlFor="business-name" className="block h-5 shrink-0 text-sm leading-5">
                  Business name
                </Label>
                <Input
                  id="business-name"
                  className="h-10 w-full"
                  placeholder="Acme Hearing"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                />
              </div>
              <div className="flex w-full shrink-0 flex-col gap-2 sm:w-[140px]">
                <Label htmlFor="create-vertical" className="block h-5 shrink-0 text-sm leading-5">
                  Vertical
                </Label>
                <Select value={createVertical} onValueChange={setCreateVertical}>
                  <SelectTrigger id="create-vertical" className="h-10 w-full min-h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="audiology">Audiology</SelectItem>
                    <SelectItem value="ortho">Ortho</SelectItem>
                    <SelectItem value="law">Law</SelectItem>
                    <SelectItem value="hospital">Hospital / health system</SelectItem>
                    <SelectItem value="rehab">Rehabilitation</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2 sm:shrink-0">
                <span className="hidden h-5 text-sm leading-5 sm:block sm:invisible" aria-hidden>
                  Action
                </span>
                <Button
                  type="submit"
                  disabled={creating}
                  className="h-10 w-full min-w-[5.5rem] shrink-0 sm:w-auto inline-flex items-center justify-center gap-2"
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Assign admins */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserCog className="h-5 w-5" />
              Assign admins to a business
            </CardTitle>
            <CardDescription>
              Select a business, then click a user below to make them an admin of that business.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <Label className="text-muted-foreground shrink-0">Business:</Label>
              <Select value={assignClinicId} onValueChange={setAssignClinicId}>
                <SelectTrigger className="w-[280px]">
                  <SelectValue placeholder="Select business" />
                </SelectTrigger>
                <SelectContent>
                  {businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} ({b.vertical})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-card">
              <p className="border-b border-border px-3 py-2 text-sm font-medium text-muted-foreground">
                All users — click to assign as admin
              </p>
              <div className="max-h-[280px] overflow-y-auto p-2">
                {usersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : users.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">No users in database.</p>
                ) : (
                  <div className="space-y-1">
                    {users.map((u) => {
                      const isAdminLinked = u.role === 'admin' && u.clinic_id
                      const adminMissingClinic = u.role === 'admin' && !u.clinic_id
                      const isSuperAdmin = u.role === 'super_admin'
                      const assignedTo = businesses.find((b) => b.id === u.clinic_id)?.name
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            if (isSuperAdmin) {
                              toast.error('Cannot assign super admin to a business')
                              return
                            }
                            if (!assignClinicId) {
                              toast.error('Select a business first')
                              return
                            }
                            setPendingAssignMain({ user: u, clinicId: assignClinicId })
                          }}
                          disabled={!assignClinicId || assigningUserId === u.id || isSuperAdmin}
                          className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted disabled:opacity-60"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-background">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{u.full_name || u.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {isSuperAdmin && (
                              <Badge variant="secondary" className="text-xs">Super Admin</Badge>
                            )}
                            {adminMissingClinic && (
                              <Badge variant="destructive" className="text-xs">Admin — no clinic link</Badge>
                            )}
                            {isAdminLinked && !isSuperAdmin && (
                              <span className="text-xs text-muted-foreground">
                                → {assignedTo ?? 'Another business'}
                              </span>
                            )}
                            {assigningUserId === u.id && (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            )}
                            {!isSuperAdmin && assignClinicId && assigningUserId !== u.id && (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
            {assignClinicId && (
              <Button variant="outline" size="sm" onClick={() => void loadUsers(true)}>
                Refresh user list
              </Button>
            )}
          </CardContent>
        </Card>

        {/* All companies */}
        <div className="rounded-xl border bg-card px-6 py-5 shadow-sm">
          <h2 className="text-lg font-semibold tracking-tight">All companies</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Click a company to see admins and workers, add or remove people, or delete the business.
          </p>
          <div className="mt-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : businesses.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-muted-foreground">
                No businesses yet. Create one above.
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {businesses.map((b) => (
                <Card
                  key={b.id}
                  className="cursor-pointer transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => setDetailBusiness(b)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                        <CardTitle className="text-base truncate">{b.name}</CardTitle>
                      </div>
                      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                    </div>
                    <CardDescription className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-normal capitalize">
                        {b.vertical}
                      </Badge>
                      <span className="text-xs">
                        {b.admins.length} admin{b.admins.length !== 1 ? 's' : ''}, {b.workers.length} worker{b.workers.length !== 1 ? 's' : ''}
                      </span>
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Company detail — full-screen overlay */}
      <Dialog
        open={!!detailBusiness}
        onOpenChange={(open) => {
          if (!open) {
            setDetailBusiness(null)
            setAddAdminSearch('')
            setAddWorkerSearch('')
            setInviteDialogOpen(false)
          }
        }}
      >
        <DialogContent
          showCloseButton
          className="flex h-[min(92vh,56rem)] w-[calc(100vw-1rem)] max-w-5xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden border bg-background p-0 shadow-xl duration-200 sm:w-[min(100vw-2rem,64rem)] sm:max-w-none sm:rounded-xl"
        >
          {detailBusiness && (
            <>
              <DialogHeader className="shrink-0 space-y-0 border-b border-border bg-card px-6 py-5 pr-14 text-left">
                <div className="flex items-start gap-4">
                  <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-muted">
                    <Building2 className="h-7 w-7 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <DialogTitle className="text-xl font-semibold tracking-tight sm:text-2xl">
                      {detailBusiness.name}
                    </DialogTitle>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="font-normal capitalize">
                        {detailBusiness.vertical}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {detailBusiness.admins.length} admin{detailBusiness.admins.length !== 1 ? 's' : ''} ·{' '}
                        {detailBusiness.workers.length} worker{detailBusiness.workers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/70 pt-3 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
                      <span className="font-medium text-muted-foreground">Receptionist line</span>
                      {detailAgentConfigLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-label="Loading phone" />
                      ) : detailAgentConfig?.phoneNumber?.trim() ? (
                        <a
                          href={`tel:${normalizePhoneNumber(detailAgentConfig.phoneNumber)}`}
                          className="font-semibold tabular-nums text-emerald-800 underline decoration-emerald-800/30 underline-offset-2 hover:decoration-emerald-800"
                        >
                          {formatPhoneDisplay(detailAgentConfig.phoneNumber) || detailAgentConfig.phoneNumber}
                        </a>
                      ) : (
                        <span className="text-muted-foreground">
                          Not set — add below or in{' '}
                          <Link
                            href={`/settings/agent/agent-settings?clinic=${encodeURIComponent(detailBusiness.id)}`}
                            className="font-medium text-foreground underline"
                            onClick={() => setDetailBusiness(null)}
                            title="Opens Agent settings for this business (super admin)"
                          >
                            Agent settings
                          </Link>
                        </span>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="shrink-0 gap-2" asChild>
                    <Link
                      href={`/settings/agent/knowledge?clinic=${encodeURIComponent(detailBusiness.id)}`}
                      onClick={() => setDetailBusiness(null)}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                  </Button>
                </div>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
                <div className="mx-auto max-w-4xl space-y-8">
                {/* Voice agent — you set it for them */}
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Mic className="h-4 w-4 text-muted-foreground" />
                      Clinic name & phone
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Shown to callers and staff. Pick a ConvAI line from your ElevenLabs workspace, or type a number if the
                    list is unavailable.
                  </p>
                  {detailAgentConfigLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : detailAgentConfig ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="grid gap-2">
                          <Label className="text-xs">Clinic name</Label>
                          <Input
                            value={detailAgentConfig.clinicName}
                            onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, clinicName: e.target.value })}
                            placeholder="e.g. Acme Hearing"
                            className="h-10"
                          />
                        </div>
                        <div className="grid gap-2">
                          <ConvaiLinePhoneField
                            mode="admin-select"
                            label="Call Agent number"
                            phonePoolClinicId={detailBusiness.id}
                            phoneNumber={detailAgentConfig.phoneNumber}
                            onPhoneNumberChange={(v) =>
                              setDetailAgentConfig({ ...detailAgentConfig, phoneNumber: v })
                            }
                            selectedPhoneNumberId={detailAgentConfig.elevenLabsPhoneNumberId ?? ''}
                            onSelectLine={(id, e164) => {
                              const next: AgentConfig = {
                                ...detailAgentConfig,
                                elevenLabsPhoneNumberId: id,
                                phoneNumber: e164.trim() || detailAgentConfig.phoneNumber,
                              }
                              setDetailAgentConfig(next)
                              void persistDetailVoiceConfig(next)
                            }}
                          />
                        </div>
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-2 mt-2"
                        onClick={handleSaveVoiceAgentConfig}
                        disabled={detailAgentConfigSaving}
                      >
                        {detailAgentConfigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save clinic name & phone
                      </Button>
                    </div>
                  ) : null}
                </section>

                {/* Invite by email */}
                <section className="rounded-xl border border-border bg-card p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <UserPlus className="h-4 w-4 text-muted-foreground" />
                        Invite by email
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Send a link to add a user or admin to your business.
                      </p>
                    </div>
                    <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={() => setInviteDialogOpen(true)}>
                      <Mail className="h-4 w-4" />
                      Invite…
                    </Button>
                  </div>
                </section>

                {/* Call logs (clinic-wide) */}
                <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between sm:gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      Call logs
                    </h4>
                    <span className="text-xs text-muted-foreground">Sorted by urgency, then value</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Inbound calls for this business. Written summaries and tags appear here when enabled for the account.
                  </p>
                  {businessCallsLoading ? (
                    <div className="flex justify-center py-8 rounded-lg border border-border bg-background">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : sortedBusinessCalls.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-muted-foreground">
                      No calls for this business yet.
                    </p>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-md border border-border bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Time</TableHead>
                            <TableHead className="text-xs w-12">U</TableHead>
                            <TableHead className="text-xs w-12">V</TableHead>
                            <TableHead className="text-xs">Caller</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">Summary</TableHead>
                            <TableHead className="text-xs hidden md:table-cell">Dur</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedBusinessCalls.slice(0, 50).map((c) => (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs whitespace-nowrap">
                                {formatDateTime(c.timestamp)}
                              </TableCell>
                              <TableCell className="text-xs">{c.aiResponseUrgency ?? '—'}</TableCell>
                              <TableCell className="text-xs">{c.aiBusinessValue ?? '—'}</TableCell>
                              <TableCell className="text-xs">
                                <div className="font-medium">{c.callerName}</div>
                                <div className="text-muted-foreground">{c.phone}</div>
                              </TableCell>
                              <TableCell className="text-xs text-muted-foreground max-w-[min(280px,40vw)] hidden sm:table-cell">
                                <span className="line-clamp-2">{c.aiBriefSummary || '—'}</span>
                              </TableCell>
                              <TableCell className="text-xs hidden md:table-cell whitespace-nowrap">
                                {formatDuration(c.durationSec)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </section>

                {/* Admins */}
                <section>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Shield className="h-4 w-4 text-muted-foreground" />
                      Admins
                    </h4>
                  </div>
                  <div className="space-y-2 mb-4">
                    {detailBusiness.admins.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No admins. Search below to add.</p>
                    ) : (
                      detailBusiness.admins.map((a) => (
                        <div
                          key={a.id}
                          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                              <UserCog className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{a.full_name || a.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setPendingUnassign({ user: a, isAdmin: true })}
                            disabled={!!unassigningUserId}
                          >
                            {unassigningUserId === a.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-card p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Add admin — search users</p>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email or name..."
                        className="pl-8 h-9"
                        value={addAdminSearch}
                        onChange={(e) => setAddAdminSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                      {users
                        .filter((u) => u.role !== 'super_admin' && !detailBusiness.admins.some((a) => a.id === u.id) && !detailBusiness.workers.some((w) => w.id === u.id))
                        .filter((u) => !addAdminSearch.trim() || (u.email?.toLowerCase().includes(addAdminSearch.toLowerCase()) || (u.full_name?.toLowerCase().includes(addAdminSearch.toLowerCase()))))
                        .slice(0, 20)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() => setPendingAssign({ user: u, role: 'admin' })}
                            disabled={!!assigningRoleUserId}
                          >
                            <span className="truncate">{u.full_name || u.email}</span>
                            <span className="text-xs text-muted-foreground truncate shrink-0">{u.email}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </section>

                {/* Workers */}
                <section>
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      Workers
                    </h4>
                  </div>
                  <div className="space-y-2 mb-4">
                    {detailBusiness.workers.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No workers. Search below to add.</p>
                    ) : (
                      detailBusiness.workers.map((w) => (
                        <div
                          key={w.id}
                          className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2.5"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm">{w.full_name || w.email}</p>
                              <p className="text-xs text-muted-foreground truncate">{w.email}</p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => setPendingUnassign({ user: w, isAdmin: false })}
                            disabled={!!unassigningUserId}
                          >
                            {unassigningUserId === w.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                  <div className="rounded-lg border border-border bg-card p-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Add worker — search users</p>
                    <div className="relative mb-2">
                      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by email or name..."
                        className="pl-8 h-9"
                        value={addWorkerSearch}
                        onChange={(e) => setAddWorkerSearch(e.target.value)}
                      />
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-0.5">
                      {users
                        .filter((u) => u.role !== 'super_admin' && !detailBusiness.admins.some((a) => a.id === u.id) && !detailBusiness.workers.some((w) => w.id === u.id))
                        .filter((u) => !addWorkerSearch.trim() || (u.email?.toLowerCase().includes(addWorkerSearch.toLowerCase()) || (u.full_name?.toLowerCase().includes(addWorkerSearch.toLowerCase()))))
                        .slice(0, 20)
                        .map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                            onClick={() => setPendingAssign({ user: u, role: 'member' })}
                            disabled={!!assigningRoleUserId}
                          >
                            <span className="truncate">{u.full_name || u.email}</span>
                            <span className="text-xs text-muted-foreground truncate shrink-0">{u.email}</span>
                          </button>
                        ))}
                    </div>
                  </div>
                </section>

                <div className="pt-2 border-t border-border">
                  <Button
                    variant="destructive"
                    className="w-full max-w-md gap-2"
                    onClick={() => setDeleteConfirmBusiness(detailBusiness)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete business
                  </Button>
                </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign admin confirmation (main list) */}
      <Dialog open={!!pendingAssignMain} onOpenChange={(open) => !open && setPendingAssignMain(null)}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Add as admin?</DialogTitle>
            <DialogDescription>
              Are you sure you want to add <strong>{pendingAssignMain?.user.full_name || pendingAssignMain?.user.email}</strong> as admin
              {pendingAssignMain?.clinicId && (
                <> to <strong>{businesses.find((b) => b.id === pendingAssignMain.clinicId)?.name ?? 'this business'}</strong></>
              )}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setPendingAssignMain(null)} disabled={!!assigningUserId}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!pendingAssignMain) return
                handleAssignAdmin(pendingAssignMain.user.id, pendingAssignMain.clinicId)
                setPendingAssignMain(null)
              }}
              disabled={!!assigningUserId}
            >
              {assigningUserId === pendingAssignMain?.user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, add as admin'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove from business confirmation */}
      <Dialog open={!!pendingUnassign} onOpenChange={(open) => !open && setPendingUnassign(null)}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Remove from business?</DialogTitle>
            <DialogDescription>
              Are you sure you want to remove <strong>{pendingUnassign?.user.full_name || pendingUnassign?.user.email}</strong> from{' '}
              <strong>{detailBusiness?.name}</strong>? They will no longer be a {pendingUnassign?.isAdmin ? 'admin' : 'worker'} of this business.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setPendingUnassign(null)} disabled={!!unassigningUserId}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={() => confirmUnassign()} disabled={!!unassigningUserId}>
              {unassigningUserId === pendingUnassign?.user.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Yes, remove'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign confirmation (sheet: admin/worker) */}
      <Dialog open={!!pendingAssign} onOpenChange={(open) => !open && setPendingAssign(null)}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Assign to business</DialogTitle>
            <DialogDescription>
              Assign <strong>{pendingAssign?.user.full_name || pendingAssign?.user.email}</strong> to{' '}
              <strong>{detailBusiness?.name}</strong> as <strong>{pendingAssign?.role === 'admin' ? 'admin' : 'worker'}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setPendingAssign(null)} disabled={!!assigningRoleUserId}>
              Cancel
            </Button>
            <Button onClick={() => confirmAssignRole()} disabled={!!assigningRoleUserId}>
              {assigningRoleUserId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Assign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirmBusiness} onOpenChange={(open) => !open && setDeleteConfirmBusiness(null)}>
        <DialogContent showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>
              You are about to delete <strong>{deleteConfirmBusiness?.name}</strong>. This will remove the business
              permanently. All admins and workers will be unassigned from this business. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3">
            <Button variant="outline" onClick={() => setDeleteConfirmBusiness(null)} disabled={deleting}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteBusiness} disabled={deleting}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Delete business'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {detailBusiness && (
        <InviteUserDialog
          open={inviteDialogOpen}
          onOpenChange={setInviteDialogOpen}
          clinicId={detailBusiness.id}
          contextLabel={detailBusiness.name}
          onInvited={async () => {
            await loadBusinesses()
            await loadUsers()
            const token = await getToken()
            if (!token) return
            const refreshed = await fetch('/api/super-admin/businesses', {
              headers: { Authorization: `Bearer ${token}` },
            }).then((r) => r.json())
            const updated = (refreshed.businesses || []).find((b: Business) => b.id === detailBusiness.id)
            if (updated) setDetailBusiness(updated)
          }}
        />
      )}
    </AppShell>
  )
}
