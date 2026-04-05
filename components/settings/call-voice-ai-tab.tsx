'use client'

import { useCallback, useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { supabase } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { SUMMARY_FOCUS_OPTIONS } from '@/lib/clinic-call-ai'
import type { ClinicCallAiSettings, ClinicVertical, ProfileRole } from '@/lib/types'
import { CloudUpload, Loader2, Sparkles } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { formatElevenLabsSyncFailureMessage } from '@/lib/elevenlabs-sync-errors'
import { clinicSettingsApiUrl, syncElevenLabsApiUrl } from '@/lib/view-as-clinic-api'

type CallVoiceAiTabProps = {
  /** Super-admin: edit this clinic’s phone / summaries (from Settings ?clinic=). */
  superAdminClinicId?: string | null
}

export function CallVoiceAiTab({ superAdminClinicId = null }: CallVoiceAiTabProps) {
  const { profile, setProfile, viewAs } = useAppStore()
  const clinicEdit = Boolean(superAdminClinicId?.trim())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [vertical, setVertical] = useState<ClinicVertical>('general')
  const [callAi, setCallAi] = useState<ClinicCallAiSettings | null>(null)
  const [clinicName, setClinicName] = useState<string>('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [syncingEl, setSyncingEl] = useState(false)

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) throw new Error('Not signed in')
    return fetch(url, {
      ...init,
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    })
  }, [])

  const load = useCallback(async () => {
    if (!clinicEdit && !profile?.clinicId) {
      setLoading(false)
      setLoadError(null)
      setCallAi(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const settingsUrl = clinicSettingsApiUrl(viewAs?.userId, superAdminClinicId)
      const res = await authFetch(settingsUrl)
      const data = await res.json()
      if (!res.ok) {
        // Client store can still have a clinicId (e.g. stale state) while the DB has none — align with server.
        // Skip while view-as: /api/profile is the super admin, not the impersonated user.
        if (!clinicEdit && !viewAs && res.status === 400 && data.error === 'No clinic assigned') {
          const pr = await authFetch('/api/profile')
          const pj = (await pr.json()) as { role?: string; clinicId?: string | null }
          if (
            pr.ok &&
            (pj.role === 'super_admin' || pj.role === 'admin' || pj.role === 'member')
          ) {
            setProfile({
              role: pj.role as ProfileRole,
              clinicId: pj.clinicId ?? null,
            })
            setLoadError(null)
            setCallAi(null)
            return
          }
        }
        throw new Error(data.error || 'Failed to load')
      }
      setVertical(data.vertical as ClinicVertical)
      setCallAi(data.callAi as ClinicCallAiSettings)
      setClinicName(typeof data.clinicName === 'string' ? data.clinicName : '')
      setUserRole(typeof data.userRole === 'string' ? data.userRole : null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load clinic settings'
      setLoadError(msg)
      toast.error(msg)
      setCallAi(null)
    } finally {
      setLoading(false)
    }
  }, [authFetch, clinicEdit, profile?.clinicId, setProfile, superAdminClinicId, viewAs?.userId])

  useEffect(() => {
    load()
  }, [load])

  const toggleFocus = (key: string, checked: boolean) => {
    if (!callAi) return
    const next = new Set(callAi.summaryFocusKeys)
    if (checked) next.add(key)
    else next.delete(key)
    setCallAi({ ...callAi, summaryFocusKeys: [...next] })
  }

  const save = async () => {
    if (!callAi) return
    setSaving(true)
    try {
      const body: Record<string, unknown> = { callAi }
      if (userRole === 'admin' || userRole === 'super_admin') body.vertical = vertical
      const res = await authFetch(clinicSettingsApiUrl(viewAs?.userId, superAdminClinicId), {
        method: 'PATCH',
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Save failed')
      setCallAi(data.callAi as ClinicCallAiSettings)
      setVertical(data.vertical as ClinicVertical)
      toast.success('Call settings saved')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (!clinicEdit && !profile?.clinicId) {
    const adminBroken =
      profile?.role === 'admin'
        ? 'You are marked as an administrator, but your profile has no clinic in the database. In Super Admin → Assign admins, select the correct business and click your user again to repair the link (or ask a super admin to do it). After that, wait a moment or switch tabs to refresh your session.'
        : null
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call &amp; voice context</CardTitle>
          <CardDescription>
            {adminBroken ??
              'Your account is not linked to a clinic yet. Ask a super admin to assign you to a business.'}
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (loadError || !callAi) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Call &amp; AI</CardTitle>
          <CardDescription>
            {loadError || 'Could not load clinic AI settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isClinicAdmin = userRole === 'admin' || userRole === 'super_admin'

  const ppReq = callAi.postProcessingRequirements ?? ''

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            After-call notes (for your dashboard)
          </CardTitle>
          <CardDescription>
            Runs <strong>after</strong> each call on the transcript. Shapes short summaries, tags, and priority flags for{' '}
            <span className="font-medium text-foreground">{clinicName || 'your business'}</span> — not read aloud to callers.
            Live receptionist behavior, knowledge cards, and presets are under <strong>Settings → Agent</strong>.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label>Themes to emphasize in summaries and tags</Label>
            <p className="text-xs text-muted-foreground -mt-1">
              Check the themes you want reflected in summaries and tags (in addition to your free-text instructions).
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {SUMMARY_FOCUS_OPTIONS.map((opt) => (
                <label
                  key={opt.key}
                  className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 hover:bg-zinc-100/90 dark:hover:bg-zinc-800/40"
                >
                  <Checkbox
                    className="shrink-0"
                    checked={callAi.summaryFocusKeys.includes(opt.key)}
                    onCheckedChange={(c) => toggleFocus(opt.key, c === true)}
                  />
                  <span className="min-w-0">
                    <span className="text-sm font-medium leading-none">{opt.label}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{opt.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="custom-ai">General instructions for summaries &amp; tags</Label>
            <p className="text-xs text-muted-foreground">
              Tone, things to always mention, or phrasing you want in the short summary and tags.
            </p>
            <Textarea
              id="custom-ai"
              rows={4}
              placeholder="E.g. Always note insurance payer if mentioned. Use friendly, non-clinical language in the brief summary. Spanish callers → tag interpreter_needed."
              value={callAi.customSummaryInstructions}
              onChange={(e) => setCallAi({ ...callAi, customSummaryInstructions: e.target.value })}
            />
          </div>

          <div className="space-y-2 rounded-lg border border-dashed border-border bg-card p-4">
            <Label htmlFor="post-process-specifics">Specific analysis rules</Label>
            <p className="text-xs text-muted-foreground">
              Only affects written summaries after the call — not the live line. Use for tag naming, urgency rules, or
              what never to put in a summary.
            </p>
            <Textarea
              id="post-process-specifics"
              rows={5}
              placeholder={`Examples:\n• Tag hearing_aid_trial if they mention a trial period.\n• Never put full card numbers in brief_summary.\n• Urgency 4 only for red-flag symptoms you list here.\n• Always extract requested callback window as a tag callback_window_morning|afternoon.`}
              value={ppReq}
              onChange={(e) => setCallAi({ ...callAi, postProcessingRequirements: e.target.value })}
            />
          </div>

        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Save after-call analysis options here. To update what callers hear on the line, use <strong>Agent</strong> →{' '}
          <strong>Save receptionist settings</strong> and <strong>Push to phone line</strong>.
        </p>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save call settings
          </Button>
          {isClinicAdmin ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              disabled={syncingEl}
              onClick={async () => {
                setSyncingEl(true)
                try {
                  const syncUrl = syncElevenLabsApiUrl(viewAs?.userId, superAdminClinicId)
                  const res = await authFetch(syncUrl, {
                    method: 'POST',
                    body: JSON.stringify(
                      superAdminClinicId?.trim()
                        ? { clinicId: superAdminClinicId.trim() }
                        : viewAs?.userId
                          ? { userId: viewAs.userId }
                          : {}
                    ),
                  })
                  const data = await res.json()
                  if (!res.ok) {
                    const lines = formatElevenLabsSyncFailureMessage(data).split('\n')
                    toast.error(lines[0] ?? 'Sync failed', {
                      description: lines.slice(1).join('\n').trim() || undefined,
                      duration: 16_000,
                    })
                    return
                  }
                  const failed = Array.isArray(data.results)
                    ? data.results.filter((x: { ok?: boolean }) => !x.ok)
                    : []
                  toast.success(data.message || 'Phone line updated', {
                    description:
                      failed.length > 0
                        ? failed
                            .map(
                              (x: { agentId?: string; error?: string }) =>
                                `${x.agentId ?? 'agent'}: ${(x.error ?? '').slice(0, 280)}`
                            )
                            .join('\n')
                        : undefined,
                    duration: failed.length > 0 ? 14_000 : 4000,
                  })
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : 'Sync failed')
                } finally {
                  setSyncingEl(false)
                }
              }}
            >
              {syncingEl ? <Loader2 className="h-4 w-4 animate-spin" /> : <CloudUpload className="h-4 w-4" />}
              Push to phone line
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
