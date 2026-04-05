'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import type { VoiceKnowledgeItem } from '@/lib/types'
import { KNOWLEDGE_ITEM_BODY_MAX_CHARS } from '@/lib/clinic-call-ai'
import { Globe, Loader2 } from 'lucide-react'

type Props = {
  existingCount: number
  onApply: (items: VoiceKnowledgeItem[], mode: 'append' | 'replace') => void
}

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`
}

export function KnowledgeFromWebsite({ existingCount, onApply }: Props) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [mode, setMode] = useState<'append' | 'replace'>('append')

  const run = async () => {
    const u = url.trim()
    if (!u) {
      toast.error('Enter a website URL')
      return
    }
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) {
        toast.error('Session expired')
        return
      }
      const res = await fetch('/api/clinic/analyze-website-knowledge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: u }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Analysis failed')
      const raw = Array.isArray(data.knowledgeItems) ? data.knowledgeItems : []
      const pairs: { title: string; body: string }[] = []
      for (const row of raw) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const t = typeof o.title === 'string' ? o.title.trim() : ''
        const b = typeof o.body === 'string' ? o.body.trim() : ''
        if (!t || !b) continue
        pairs.push({ title: t.slice(0, 200), body: b.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS) })
      }
      if (pairs.length === 0) {
        toast.error('No knowledge cards were returned. Try another page or add cards manually.')
        return
      }
      const base = mode === 'replace' ? 0 : existingCount
      const items: VoiceKnowledgeItem[] = pairs.map((p, i) => ({
        id: newId(),
        title: p.title,
        body: p.body,
        enabled: true,
        sortOrder: base + i,
      }))
      onApply(items, mode)
      toast.success(
        mode === 'replace'
          ? `Replaced knowledge with ${items.length} card${items.length === 1 ? '' : 's'} from the site`
          : `Added ${items.length} card${items.length === 1 ? '' : 's'} from the site`
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Analysis failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-4 space-y-4 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-start gap-2">
        <Globe className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-medium text-foreground">Repopulate from a website</p>
          <p className="text-xs text-muted-foreground">
            We read public pages and suggest many detailed knowledge cards (hours, services, policies, locations,
            etc.). Save receptionist settings when you are happy with the list.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-2 min-w-0">
          <Label htmlFor="knowledge-site-url">Website URL</Label>
          <Input
            id="knowledge-site-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://yourbusiness.com"
            className="font-mono text-sm"
          />
        </div>
        <Button type="button" className="shrink-0 gap-2 sm:mb-0" disabled={busy} onClick={() => void run()}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Analyze website
        </Button>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="knowledge-merge"
            checked={mode === 'append'}
            onChange={() => setMode('append')}
            className="accent-primary"
          />
          <span>Add to existing cards</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="radio"
            name="knowledge-merge"
            checked={mode === 'replace'}
            onChange={() => setMode('replace')}
            className="accent-primary"
          />
          <span>Replace all cards</span>
        </label>
      </div>
    </div>
  )
}
