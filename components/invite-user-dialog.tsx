'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Check, Copy, Loader2, Mail } from 'lucide-react'

export type InviteUserDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Super admin: target business. Omit for clinic admin (uses their clinic from the API). */
  clinicId?: string
  /** Shown in the description (e.g. business name). */
  contextLabel?: string
  onInvited?: () => void
}

export function InviteUserDialog({
  open,
  onOpenChange,
  clinicId,
  contextLabel,
  onInvited,
}: InviteUserDialogProps) {
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [role, setRole] = useState<'member' | 'admin'>('member')
  const [submitting, setSubmitting] = useState(false)
  const [devInviteUrl, setDevInviteUrl] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (open) {
      setEmail('')
      setFullName('')
      setRole('member')
      setDevInviteUrl(null)
      setCopied(false)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) {
      toast.error('Enter an email address')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(trimmed)) {
      toast.error('Enter a valid email address')
      return
    }
    setSubmitting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expired. Please sign in again.')
        return
      }
      const body: Record<string, unknown> = {
        email: trimmed,
        full_name: fullName.trim() || undefined,
        role,
      }
      if (clinicId) body.clinic_id = clinicId

      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Invite failed')
      }
      if (typeof data.inviteUrl === 'string' && data.inviteUrl) {
        setDevInviteUrl(data.inviteUrl)
        toast.message('Invite created — no email sent', {
          description:
            'Resend is not configured. Add RESEND_API_KEY to .env.local and restart dev, or copy the link below.',
        })
        onInvited?.()
        return
      }
      toast.success('Invitation sent', {
        description: `${trimmed} will get an email to create their account and join${contextLabel ? ` ${contextLabel}` : ' your team'}.`,
      })
      onOpenChange(false)
      onInvited?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Invite by email
          </DialogTitle>
          <DialogDescription>They’ll create their account from the link.</DialogDescription>
        </DialogHeader>
        {devInviteUrl ? (
          <div className="space-y-3 rounded-lg border bg-muted/40 p-3">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Email was not sent</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Invites are delivered by{' '}
                <a
                  href="https://resend.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline font-medium text-foreground"
                >
                  Resend
                </a>
                . Add <code className="rounded bg-muted px-1 py-0.5 text-[11px]">RESEND_API_KEY</code> to{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">.env.local</code> (get a key at
                resend.com), then restart <code className="rounded bg-muted px-1 py-0.5 text-[11px]">npm run dev</code>.
                On Vercel, set the same variable for production. Outbound mail sends from{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-[11px]">support@vocalis.team</code>.
              </p>
              <p className="text-xs text-muted-foreground">Until then, copy this link and send it yourself:</p>
            </div>
            <Label className="text-xs text-muted-foreground sr-only">Invite link</Label>
            <div className="flex gap-2">
              <Input readOnly value={devInviteUrl} className="font-mono text-xs" />
              <Button
                type="button"
                variant="secondary"
                size="icon"
                className="shrink-0"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(devInviteUrl)
                    setCopied(true)
                    toast.success('Copied')
                    setTimeout(() => setCopied(false), 2000)
                  } catch {
                    toast.error('Could not copy')
                  }
                }}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="invite-dialog-email">Email</Label>
            <Input
              id="invite-dialog-email"
              type="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="invite-dialog-name">Name (optional)</Label>
            <Input
              id="invite-dialog-name"
              placeholder="Full name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as 'member' | 'admin')}>
              <SelectTrigger id="invite-dialog-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="member">Member (worker)</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Admins can manage team invites and settings; members have standard access.
            </p>
          </div>
          <DialogFooter className="gap-3 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending…
                </>
              ) : (
                'Send invite'
              )}
            </Button>
          </DialogFooter>
        </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
