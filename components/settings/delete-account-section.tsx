'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { clearLocalSupabaseSession } from '@/lib/supabase/clear-stale-session'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

const CONFIRM_PHRASE = 'DELETE'

export function DeleteAccountSection() {
  const [open, setOpen] = useState(false)
  const [phrase, setPhrase] = useState('')
  const [busy, setBusy] = useState(false)

  const handleDelete = async () => {
    if (phrase.trim() !== CONFIRM_PHRASE) {
      toast.error(`Type ${CONFIRM_PHRASE} to confirm`)
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expired')
        setBusy(false)
        return
      }
      const res = await fetch('/api/account', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ confirm: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : 'Could not delete account')
        setBusy(false)
        return
      }
      await clearLocalSupabaseSession()
      toast.success('Account deleted')
      setOpen(false)
      window.location.href = '/'
    } catch {
      toast.error('Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-destructive/18 bg-destructive/[0.04] dark:border-destructive/25 dark:bg-destructive/10 p-6 space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-destructive">Delete account</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Permanently remove your account and associated data. This cannot be undone.
        </p>
      </div>
      <Button type="button" variant="destructive" className="gap-2" onClick={() => setOpen(true)}>
        <Trash2 className="h-4 w-4" />
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
        <DialogContent showCloseButton className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              All data tied to your user will be permanently deleted. Type <strong>{CONFIRM_PHRASE}</strong> to
              confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="delete-account-confirm">Confirmation</Label>
            <Input
              id="delete-account-confirm"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          <DialogFooter className="gap-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={() => void handleDelete()} disabled={busy}>
              {busy ? 'Deleting…' : 'Delete forever'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
