'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppShell } from '@/components/layout/app-shell'
import { useAppStore } from '@/lib/store'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Users, UserPlus, Mail } from 'lucide-react'

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
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member')
  const [inviteName, setInviteName] = useState('')
  const [inviting, setInviting] = useState(false)

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

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim()) {
      toast.error('Enter an email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(inviteEmail)) {
      toast.error('Enter a valid email address')
      return
    }
    setInviting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expired. Please sign in again.')
        setInviting(false)
        return
      }
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: inviteEmail.trim().toLowerCase(),
          full_name: inviteName.trim() || undefined,
          role: inviteRole,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || 'Invite failed')
      }
      toast.success('Invitation sent', {
        description: `${inviteEmail} will receive an email to set their password and join your team.`,
      })
      setInviteEmail('')
      setInviteName('')
      setInviteRole('member')
      if (data.userId) {
        setMembers((prev) => [
          ...prev,
          {
            id: data.userId,
            email: inviteEmail.trim().toLowerCase(),
            full_name: inviteName.trim() || null,
            role: inviteRole,
          },
        ])
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setInviting(false)
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
              <UserPlus className="h-5 w-5" />
              Invite member
            </CardTitle>
            <CardDescription>
              They will receive an email to set their password and join your clinic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-name">Name (optional)</Label>
                <Input
                  id="invite-name"
                  placeholder="Full name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as 'member' | 'admin')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={inviting}>
                {inviting ? 'Sending...' : 'Send invite'}
              </Button>
            </form>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </AppShell>
  )
}
