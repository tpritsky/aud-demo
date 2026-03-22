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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
} from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
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
import { InviteUserDialog } from '@/components/invite-user-dialog'

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

interface UserRow {
  id: string
  email: string
  full_name: string | null
  role: string
  clinic_id: string | null
}

function getToken() {
  return supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null)
}

export default function BusinessesPage() {
  const router = useRouter()
  const { profile, isHydrated } = useAppStore()
  const [businesses, setBusinesses] = useState<Business[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(false)
  const [createName, setCreateName] = useState('')
  const [createVertical, setCreateVertical] = useState('general')
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
    const token = await getToken()
    if (!token) return
    const res = await fetch('/api/super-admin/businesses', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    const data = await res.json()
    setBusinesses(data.businesses || [])
  }, [])

  const loadUsers = useCallback(async () => {
    setUsersLoading(true)
    const token = await getToken()
    if (!token) {
      setUsersLoading(false)
      return
    }
    const res = await fetch('/api/super-admin/users', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      setUsersLoading(false)
      return
    }
    const data = await res.json()
    setUsers(data.users || [])
    setUsersLoading(false)
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
    const run = async () => {
      setLoading(true)
      await loadBusinesses()
      setLoading(false)
    }
    run()
  }, [profile?.role, loadBusinesses])

  useEffect(() => {
    if (profile?.role !== 'super_admin') return
    loadUsers()
  }, [profile?.role, loadUsers])

  // When detail sheet opens, fetch full business with voice agent settings
  useEffect(() => {
    if (!detailBusiness) {
      setDetailAgentConfig(null)
      return
    }
    let cancelled = false
    setDetailAgentConfigLoading(true)
    getToken().then((token) => {
      if (!token) return
      fetch(`/api/super-admin/businesses/${detailBusiness.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (cancelled) return
          const settings = data?.business?.settings
          const existing = settings?.agentConfig
          setDetailAgentConfig({
            ...defaultAgentConfig,
            ...existing,
            clinicName: existing?.clinicName ?? detailBusiness.name,
            phoneNumber: existing?.phoneNumber ?? '',
          })
        })
        .catch(() => {
          if (!cancelled) setDetailAgentConfig({ ...defaultAgentConfig, clinicName: detailBusiness.name, phoneNumber: '' })
        })
        .finally(() => {
          if (!cancelled) setDetailAgentConfigLoading(false)
        })
    })
    return () => {
      cancelled = true
    }
  }, [detailBusiness?.id, detailBusiness?.name])

  const handleSaveVoiceAgentConfig = async () => {
    if (!detailBusiness || !detailAgentConfig) return
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
        body: JSON.stringify({ settings: { agentConfig: detailAgentConfig } }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save')
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
      toast.success('Business created')
      setCreateName('')
      setCreateVertical('general')
      await loadBusinesses()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to create business')
    } finally {
      setCreating(false)
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

  if (!isHydrated || profile?.role !== 'super_admin') {
    return null
  }

  const viewAsFilteredUsers = users.filter(
    (u) =>
      !viewAsSearch.trim() ||
      u.email?.toLowerCase().includes(viewAsSearch.toLowerCase()) ||
      u.full_name?.toLowerCase().includes(viewAsSearch.toLowerCase())
  )

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

        {/* View as user */}
        <Card className="overflow-hidden border-primary/10 shadow-sm">
          <CardHeader className="bg-muted/30 pb-4">
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
            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/20">
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
                        className="flex items-center justify-between gap-2 rounded-md px-3 py-2.5 text-sm hover:bg-muted transition-colors"
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
                        <span className="flex items-center gap-1 text-xs text-primary shrink-0">
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
        <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/20 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Plus className="h-5 w-5" />
              Create new business
            </CardTitle>
            <CardDescription>
              Add a new company. You can then assign admins from the list below.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateBusiness} className="grid grid-cols-[200px_140px_auto] gap-x-4 gap-y-2 items-center max-w-2xl">
              <Label htmlFor="business-name" className="row-start-1 col-start-1">Business name</Label>
              <Label className="row-start-1 col-start-2">Vertical</Label>
              <div className="row-start-1 col-start-3" />
              <Input
                id="business-name"
                className="h-10 w-full"
                placeholder="Acme Hearing"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <Select value={createVertical} onValueChange={setCreateVertical}>
                <SelectTrigger className="h-10 w-full min-h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General</SelectItem>
                  <SelectItem value="audiology">Audiology</SelectItem>
                  <SelectItem value="ortho">Ortho</SelectItem>
                  <SelectItem value="law">Law</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={creating} className="h-10 shrink-0">
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Create'}
              </Button>
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
            <div className="rounded-lg border bg-muted/30">
              <p className="border-b px-3 py-2 text-sm font-medium text-muted-foreground">
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
                      const isAdmin = u.role === 'admin' && u.clinic_id
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
                            {isAdmin && !isSuperAdmin && (
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
              <Button variant="outline" size="sm" onClick={loadUsers}>
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

      {/* Company detail sheet */}
      <Sheet
        open={!!detailBusiness}
        onOpenChange={(open) =>
          !open &&
          (setDetailBusiness(null),
          setAddAdminSearch(''),
          setAddWorkerSearch(''),
          setInviteDialogOpen(false))
        }
      >
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {detailBusiness && (
            <>
              <SheetHeader className="space-y-3 pb-6 border-b">
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <SheetTitle className="text-xl">{detailBusiness.name}</SheetTitle>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="font-normal capitalize">
                        {detailBusiness.vertical}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {detailBusiness.admins.length} admin{detailBusiness.admins.length !== 1 ? 's' : ''} · {detailBusiness.workers.length} worker{detailBusiness.workers.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              <div className="py-6 space-y-8">
                {/* Voice agent — you set it for them */}
                <section className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Mic className="h-4 w-4 text-primary" />
                      Voice agent & clinic number
                    </h4>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">
                    Set this once. The clinic will see these values in the app and won’t need to configure Eleven Labs or API.
                  </p>
                  {detailAgentConfigLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </div>
                  ) : detailAgentConfig ? (
                    <div className="space-y-3">
                      <div className="grid gap-2">
                        <Label className="text-xs">Clinic name</Label>
                        <Input
                          value={detailAgentConfig.clinicName}
                          onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, clinicName: e.target.value })}
                          placeholder="e.g. Acme Hearing"
                          className="h-9"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs flex items-center gap-1.5">
                          <Phone className="h-3.5 w-3.5" />
                          Clinic phone number
                        </Label>
                        <Input
                          value={detailAgentConfig.phoneNumber}
                          onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, phoneNumber: e.target.value })}
                          placeholder="+1 (555) 123-4567"
                          className="h-9"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Eleven Labs inbound agent ID</Label>
                        <Input
                          value={detailAgentConfig.elevenLabsAgentId ?? ''}
                          onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, elevenLabsAgentId: e.target.value || undefined })}
                          placeholder="agent_..."
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Eleven Labs outbound agent ID</Label>
                        <Input
                          value={detailAgentConfig.elevenLabsOutboundAgentId ?? ''}
                          onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, elevenLabsOutboundAgentId: e.target.value || undefined })}
                          placeholder="agent_..."
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label className="text-xs">Eleven Labs phone number ID</Label>
                        <Input
                          value={detailAgentConfig.elevenLabsPhoneNumberId ?? ''}
                          onChange={(e) => setDetailAgentConfig({ ...detailAgentConfig, elevenLabsPhoneNumberId: e.target.value || undefined })}
                          placeholder="phnum_..."
                          className="h-9 font-mono text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="w-full gap-2 mt-2"
                        onClick={handleSaveVoiceAgentConfig}
                        disabled={detailAgentConfigSaving}
                      >
                        {detailAgentConfigSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Save voice agent settings
                      </Button>
                    </div>
                  ) : null}
                </section>

                {/* Invite by email */}
                <section className="rounded-xl border bg-muted/20 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h4 className="flex items-center gap-2 text-sm font-semibold">
                        <UserPlus className="h-4 w-4 text-primary" />
                        Invite by email
                      </h4>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Send a link to set a password. Choose name and role (admin or worker) before sending.
                      </p>
                    </div>
                    <Button type="button" variant="secondary" className="shrink-0 gap-2" onClick={() => setInviteDialogOpen(true)}>
                      <Mail className="h-4 w-4" />
                      Invite…
                    </Button>
                  </div>
                </section>

                {/* Call logs (clinic-wide, AI triage) */}
                <section className="rounded-xl border p-4">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <h4 className="flex items-center gap-2 text-sm font-semibold">
                      <Phone className="h-4 w-4 text-primary" />
                      Call logs
                    </h4>
                    <span className="text-xs text-muted-foreground">Sorted by AI urgency, then value</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">
                    Inbound calls linked to this business (after migration 011). Includes Claude post-processing when configured.
                  </p>
                  {businessCallsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                  ) : sortedBusinessCalls.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No calls for this business yet.</p>
                  ) : (
                    <div className="max-h-72 overflow-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-xs">Time</TableHead>
                            <TableHead className="text-xs w-12">U</TableHead>
                            <TableHead className="text-xs w-12">V</TableHead>
                            <TableHead className="text-xs">Caller</TableHead>
                            <TableHead className="text-xs hidden sm:table-cell">AI summary</TableHead>
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
                              <TableCell className="text-xs text-muted-foreground max-w-[180px] hidden sm:table-cell">
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
                      <Shield className="h-4 w-4 text-primary" />
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
                  <div className="rounded-lg border bg-muted/30 p-2">
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
                      <Users className="h-4 w-4 text-primary" />
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
                  <div className="rounded-lg border bg-muted/30 p-2">
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

                <div className="pt-4 border-t">
                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={() => setDeleteConfirmBusiness(detailBusiness)}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete business
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

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
          <DialogFooter className="gap-2 sm:gap-0">
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
          <DialogFooter className="gap-2 sm:gap-0">
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
          <DialogFooter className="gap-2 sm:gap-0">
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
          <DialogFooter className="gap-2 sm:gap-0">
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
