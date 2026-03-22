'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AppShell } from '@/components/layout/app-shell'
import { InviteUserDialog } from '@/components/invite-user-dialog'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Users, UserPlus, Mail, UserCheck } from 'lucide-react'

interface Member {
  id: string
  email: string
  full_name: string | null
  role: string
}

export default function TeamPage() {
  const router = useRouter()
  const { profile, isHydrated } = useAppStore()
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [addWorkerEmail, setAddWorkerEmail] = useState('')
  const [addingWorker, setAddingWorker] = useState(false)

  useEffect(() => {
    if (!isHydrated) return
    if (profile?.role !== 'admin') {
      router.replace('/dashboard')
      return
    }
    // Admin with no clinic_id: show Team page with setup message (don't redirect)
  }, [isHydrated, profile, router])

  useEffect(() => {
    const clinicId = profile?.clinicId
    if (!clinicId || profile?.role !== 'admin') {
      setLoading(false)
      return
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, role')
        .eq('clinic_id', clinicId)
        .order('email')

      if (error) {
        console.error('Error loading members:', error)
        toast.error('Failed to load team members')
        setLoading(false)
        return
      }
      setMembers((data as Member[]) || [])
      setLoading(false)
    }
    load()
  }, [profile?.clinicId, profile?.role])

  const refreshMembers = async () => {
    const clinicId = profile?.clinicId
    if (!clinicId) return
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role')
      .eq('clinic_id', clinicId)
      .order('email')
    if (!error && data) setMembers(data as Member[])
  }

  const handleAddWorker = async (e: React.FormEvent) => {
    e.preventDefault()
    const email = addWorkerEmail.trim().toLowerCase()
    if (!email) {
      toast.error('Enter an email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      toast.error('Enter a valid email address')
      return
    }
    setAddingWorker(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expired. Please sign in again.')
        setAddingWorker(false)
        return
      }
      const res = await fetch('/api/team/add-worker', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'Could not add user. Check the email is correct and try again.')
        setAddingWorker(false)
        return
      }
      toast.success('Worker added to your team')
      setAddWorkerEmail('')
      const clinicId = profile?.clinicId
      if (clinicId) {
        const { data: refreshed } = await supabase
          .from('profiles')
          .select('id, email, full_name, role')
          .eq('clinic_id', clinicId)
          .order('email')
        if (refreshed) setMembers(refreshed as Member[])
      }
    } catch {
      toast.error('Could not add user. Check the email is correct and try again.')
    } finally {
      setAddingWorker(false)
    }
  }

  if (!isHydrated || profile?.role !== 'admin') {
    return null
  }

  const needsClinicLink = !profile.clinicId

  return (
    <AppShell title="Team">
      <div className="space-y-6">
        {needsClinicLink ? (
          <Card>
            <CardHeader>
              <CardTitle>Link your account to a clinic</CardTitle>
              <CardDescription>
                To invite team members, your profile must be linked to a clinic. In Supabase: run
                migration 005 (adds <code className="text-xs bg-muted px-1 rounded">clinic_id</code> to
                profiles), create a clinic if needed, then set your profile&apos;s{' '}
                <code className="text-xs bg-muted px-1 rounded">clinic_id</code> to that clinic&apos;s UUID.
                See SUPABASE_SETUP.md for step-by-step instructions.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team members
            </CardTitle>
            <CardDescription>
              People in your clinic who can sign in. As an admin, you can invite new members.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet. Send an invite below.</p>
            ) : (
              <ul className="divide-y divide-border">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-3 first:pt-0">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-medium">{m.full_name || m.email}</p>
                        <p className="text-sm text-muted-foreground">{m.email}</p>
                      </div>
                    </div>
                    <span className="text-sm capitalize text-muted-foreground">{m.role}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Add existing user as worker
            </CardTitle>
            <CardDescription>
              Type the exact email of a registered user. The match must be exact — no suggestions are shown to protect privacy.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleAddWorker} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="add-worker-email">Email (exact match)</Label>
                <Input
                  id="add-worker-email"
                  type="email"
                  autoComplete="off"
                  placeholder="user@example.com"
                  value={addWorkerEmail}
                  onChange={(e) => setAddWorkerEmail(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={addingWorker}>
                {addingWorker ? 'Adding...' : 'Add as worker'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite new member
            </CardTitle>
            <CardDescription>
              Send an invite link. They create their account there (email is fixed; they choose name and password). No account exists until they finish.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button type="button" onClick={() => setInviteOpen(true)} className="gap-2">
              <Mail className="h-4 w-4" />
              Invite by email…
            </Button>
          </CardContent>
        </Card>

        <InviteUserDialog
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          onInvited={refreshMembers}
        />
          </>
        )}
      </div>
    </AppShell>
  )
}
