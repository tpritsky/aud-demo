'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { getAccessTokenWithBudget } from '@/lib/supabase/session-read'
import { useAppStore } from '@/lib/store'
import { formatElevenLabsSyncFailureMessage } from '@/lib/elevenlabs-sync-errors'
import { clinicSettingsApiUrl, syncElevenLabsApiUrl } from '@/lib/view-as-clinic-api'
import type { AgentConfig, ClinicCallAiSettings, ClinicVertical, ProfileRole, VoiceKnowledgeItem } from '@/lib/types'
import { AGENT_SUBNAV_LABELS, type AgentWorkspaceKey } from '@/lib/settings-agent-sections'
import { defaultAgentConfig } from '@/lib/data'
import { CloudUpload, Loader2, Sparkles } from 'lucide-react'
import { AgentConfigurationTab } from '@/components/settings/agent-configuration-tab'
import { ReceptionistCallSetup, type ReceptionistNavKey } from '@/components/settings/receptionist-call-setup'
import { SendTextMessagesSection } from '@/components/settings/send-text-messages-section'
import { KnowledgeFromWebsite } from '@/components/settings/knowledge-from-website'
import {
  KnowledgeClinicFacts,
  type ClinicFactsFields,
} from '@/components/settings/knowledge-clinic-facts'

export type { AgentWorkspaceKey } from '@/lib/settings-agent-sections'

type Props = {
  section: AgentWorkspaceKey
  superAdminClinicId?: string | null
}

export function AgentWorkspaceTab({ section, superAdminClinicId = null }: Props) {
  const { profile, setProfile, viewAs, setAgentConfig } = useAppStore()
  const actingAsSuperAdmin = Boolean(viewAs?.userId) || Boolean(superAdminClinicId?.trim())
  const clinicEdit = Boolean(superAdminClinicId?.trim())
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [syncingEl, setSyncingEl] = useState(false)
  const [vertical, setVertical] = useState<ClinicVertical>('general')
  const [callAi, setCallAi] = useState<ClinicCallAiSettings | null>(null)
  const [clinicName, setClinicName] = useState('')
  const [userRole, setUserRole] = useState<string | null>(null)
  const [agentConfigFromClinic, setAgentConfigFromClinic] = useState<AgentConfig | null>(null)
  const [clinicFacts, setClinicFacts] = useState<ClinicFactsFields>({
    clinicName: '',
    phoneNumber: '',
    hoursOpen: defaultAgentConfig.hoursOpen,
    hoursClose: defaultAgentConfig.hoursClose,
  })
  const [linePhoneIdDraft, setLinePhoneIdDraft] = useState('')
  /** Clinic id for phone-line pool API (view-as / super admin without ?clinic=). */
  const [resolvedClinicId, setResolvedClinicId] = useState<string | null>(null)

  const authFetch = useCallback(async (url: string, init?: RequestInit) => {
    const token = await getAccessTokenWithBudget()
    if (!token) throw new Error('Could not read your session — try refreshing the page.')
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
      setAgentConfigFromClinic(null)
      setResolvedClinicId(null)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const settingsUrl = clinicSettingsApiUrl(viewAs?.userId, superAdminClinicId)
      const res = await authFetch(settingsUrl)
      const data = await res.json()
      if (!res.ok) {
        if (!clinicEdit && !viewAs && res.status === 400 && data.error === 'No clinic assigned') {
          const pr = await authFetch('/api/profile')
          const pj = (await pr.json()) as { role?: string; clinicId?: string | null }
          if (pr.ok && (pj.role === 'super_admin' || pj.role === 'admin' || pj.role === 'member')) {
            setProfile({ role: pj.role as ProfileRole, clinicId: pj.clinicId ?? null })
            setLoadError(null)
            setCallAi(null)
            setAgentConfigFromClinic(null)
            setResolvedClinicId(null)
            return
          }
        }
        throw new Error(data.error || 'Failed to load')
      }
      setVertical(data.vertical as ClinicVertical)
      setCallAi(data.callAi as ClinicCallAiSettings)
      setClinicName(typeof data.clinicName === 'string' ? data.clinicName : '')
      setUserRole(typeof data.userRole === 'string' ? data.userRole : null)
      setAgentConfigFromClinic((data.agentConfig as AgentConfig | null) ?? null)
      const cid = typeof (data as { clinicId?: string }).clinicId === 'string' ? (data as { clinicId: string }).clinicId : null
      setResolvedClinicId(cid?.trim() || null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to load clinic settings'
      setLoadError(msg)
      toast.error(msg)
      setCallAi(null)
      setAgentConfigFromClinic(null)
      setResolvedClinicId(null)
    } finally {
      setLoading(false)
    }
  }, [authFetch, clinicEdit, profile?.clinicId, setProfile, superAdminClinicId, viewAs?.userId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    const ac = agentConfigFromClinic
    setClinicFacts({
      clinicName: (ac?.clinicName || '').trim() || clinicName || '',
      phoneNumber: ac?.phoneNumber ?? '',
      hoursOpen: ac?.hoursOpen || defaultAgentConfig.hoursOpen,
      hoursClose: ac?.hoursClose || defaultAgentConfig.hoursClose,
    })
    setLinePhoneIdDraft(
      typeof ac?.elevenLabsPhoneNumberId === 'string' ? ac.elevenLabsPhoneNumberId.trim() : ''
    )
  }, [agentConfigFromClinic, clinicName])

  const persistReceptionistSettings = useCallback(
    async (nextCallAi: ClinicCallAiSettings, successMessage = 'Receptionist settings saved'): Promise<boolean> => {
      setSaving(true)
      try {
        const body: Record<string, unknown> = {
          callAi: nextCallAi,
          agentClinicFacts: clinicFacts,
        }
        if (userRole === 'admin' || userRole === 'super_admin') body.vertical = vertical
        if ((userRole === 'admin' || userRole === 'super_admin' || actingAsSuperAdmin) && linePhoneIdDraft.trim()) {
          body.agentUiPatch = { elevenLabsPhoneNumberId: linePhoneIdDraft.trim() }
        }
        const res = await authFetch(clinicSettingsApiUrl(viewAs?.userId, superAdminClinicId), {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
        setCallAi(data.callAi as ClinicCallAiSettings)
        setVertical(data.vertical as ClinicVertical)
        const nextAc = (data.agentConfig as AgentConfig | null) ?? agentConfigFromClinic
        setAgentConfigFromClinic(nextAc)
        if (nextAc) setAgentConfig(nextAc)
        toast.success(successMessage)
        return true
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
        return false
      } finally {
        setSaving(false)
      }
    },
    [
      actingAsSuperAdmin,
      agentConfigFromClinic,
      authFetch,
      clinicFacts,
      linePhoneIdDraft,
      setAgentConfig,
      superAdminClinicId,
      userRole,
      vertical,
      viewAs?.userId,
    ]
  )

  const save = async () => {
    if (!callAi) return
    await persistReceptionistSettings(callAi)
  }

  /** Picking a line saves immediately so the line is assigned to this clinic’s agent (no extra Save click). */
  const persistLinePick = useCallback(
    async (phoneNumberId: string, nextFacts: ClinicFactsFields) => {
      if (!callAi) {
        toast.error('Still loading settings')
        return
      }
      setClinicFacts(nextFacts)
      setLinePhoneIdDraft(phoneNumberId)
      setSaving(true)
      try {
        const body: Record<string, unknown> = {
          callAi,
          agentClinicFacts: nextFacts,
        }
        if (userRole === 'admin' || userRole === 'super_admin') body.vertical = vertical
        if (
          (userRole === 'admin' || userRole === 'super_admin' || actingAsSuperAdmin) &&
          phoneNumberId.trim()
        ) {
          body.agentUiPatch = { elevenLabsPhoneNumberId: phoneNumberId.trim() }
        }
        const res = await authFetch(clinicSettingsApiUrl(viewAs?.userId, superAdminClinicId), {
          method: 'PATCH',
          body: JSON.stringify(body),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Save failed')
        setCallAi(data.callAi as ClinicCallAiSettings)
        setVertical(data.vertical as ClinicVertical)
        const nextAc = (data.agentConfig as AgentConfig | null) ?? agentConfigFromClinic
        setAgentConfigFromClinic(nextAc)
        if (nextAc) setAgentConfig(nextAc)
        toast.success('Call line saved and linked to your agent')
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setSaving(false)
      }
    },
    [actingAsSuperAdmin, authFetch, callAi, setAgentConfig, superAdminClinicId, userRole, vertical, viewAs?.userId]
  )

  const applyKnowledgeFromWeb = (items: VoiceKnowledgeItem[], mode: 'append' | 'replace') => {
    if (!callAi) return
    if (mode === 'replace') {
      setCallAi({ ...callAi, knowledgeItems: items.map((it, i) => ({ ...it, sortOrder: i })) })
      return
    }
    const prev = callAi.knowledgeItems || []
    const start = prev.length
    setCallAi({
      ...callAi,
      knowledgeItems: [...prev, ...items.map((it, i) => ({ ...it, sortOrder: start + i }))],
    })
  }

  const phoneDisplay =
    clinicFacts.phoneNumber.trim() || agentConfigFromClinic?.phoneNumber?.trim() || ''

  if (!clinicEdit && !profile?.clinicId) {
    const adminBroken =
      profile?.role === 'admin'
        ? 'You are marked as an administrator, but your profile has no clinic in the database. Ask a super admin to link you to a business.'
        : null
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent</CardTitle>
          <CardDescription>
            {adminBroken ?? 'Your account is not linked to a clinic yet. Ask a super admin to assign you to a business.'}
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
          <CardTitle>Agent</CardTitle>
          <CardDescription>{loadError || 'Could not load receptionist settings.'}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  const isClinicAdmin = userRole === 'admin' || userRole === 'super_admin' || actingAsSuperAdmin
  const phoneCommitted =
    Boolean(agentConfigFromClinic?.phoneNumber?.trim()) ||
    Boolean(agentConfigFromClinic?.elevenLabsPhoneNumberId?.trim())
  const memberPhoneLocked = userRole === 'member' && phoneCommitted && !actingAsSuperAdmin
  const useAdminLinePicker = isClinicAdmin
  const showReceptionistFooter = section !== 'agent-settings'

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex-1 min-w-0 bg-card">
          {section === 'agent-settings' ? (
            <div className="p-4 sm:p-6 max-w-4xl">
              <div className="mb-5 flex flex-wrap items-center gap-2 text-muted-foreground">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider">Agent</span>
                <span className="text-base font-semibold text-foreground">Agent settings</span>
              </div>
              <AgentConfigurationTab superAdminClinicId={superAdminClinicId} />
            </div>
          ) : section === 'knowledge' ? (
            <div className="flex flex-col">
              <div className="border-b border-border bg-card px-5 py-3.5 sm:px-6">
                <div className="flex flex-col gap-1.5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-foreground">Knowledge</h2>
                    <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                      Add information about your business or custom instructions.
                    </p>
                  </div>
                  {phoneDisplay ? (
                    <p className="text-sm font-medium text-muted-foreground shrink-0">
                      Receptionist line{' '}
                      <span className="font-semibold tabular-nums text-foreground">{phoneDisplay}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="space-y-5 p-4 sm:p-5 sm:space-y-5">
                <KnowledgeClinicFacts
                  value={clinicFacts}
                  onChange={setClinicFacts}
                  memberPhoneLocked={memberPhoneLocked}
                  useAdminLinePicker={useAdminLinePicker}
                  selectedConvaiPhoneNumberId={linePhoneIdDraft}
                  phonePoolClinicId={
                    superAdminClinicId?.trim() || resolvedClinicId || profile?.clinicId?.trim() || null
                  }
                  onConvaiLineSelect={
                    useAdminLinePicker ? (id, _e164, merged) => void persistLinePick(id, merged) : undefined
                  }
                />
                <KnowledgeFromWebsite
                  existingCount={callAi.knowledgeItems?.length ?? 0}
                  onApply={applyKnowledgeFromWeb}
                />
                <ReceptionistCallSetup
                  callAi={callAi}
                  vertical={vertical}
                  onChange={setCallAi}
                  canChangeVertical={userRole !== 'member'}
                  onVerticalChange={(v) => setVertical(v)}
                  embedded
                  activeSection="knowledge"
                  denseKnowledgeHeader
                />
              </div>
            </div>
          ) : section === 'texts' ? (
            <div className="flex flex-col">
              <div className="border-b border-border bg-card px-5 py-3.5 sm:px-6">
                <h2 className="text-2xl sm:text-[1.65rem] font-bold tracking-tight text-foreground">
                  Send text/email messages
                </h2>
                <p className="text-sm text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                  Your receptionist can send SMS or plain-text email with scheduling links and more. After you push to
                  the phone line, eligible messages can go out during the call when the caller agrees; anything not sent
                  live can still go after the call from the transcript.
                </p>
              </div>
              <div className="p-4 sm:p-5">
                <SendTextMessagesSection callAi={callAi} onChange={setCallAi} />
              </div>
            </div>
          ) : (
            <div className="p-4 sm:p-5">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-muted-foreground">
                <Sparkles className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider">Agent</span>
                <span className="text-base font-semibold text-foreground">{AGENT_SUBNAV_LABELS[section]}</span>
              </div>
              <ReceptionistCallSetup
                callAi={callAi}
                vertical={vertical}
                onChange={setCallAi}
                canChangeVertical={userRole !== 'member'}
                onVerticalChange={(v) => setVertical(v)}
                embedded
                activeSection={section as ReceptionistNavKey}
              />
            </div>
          )}
        </div>
      </div>

      {showReceptionistFooter ? (
        <div className="flex flex-col sm:flex-row flex-wrap gap-3 items-stretch sm:items-center justify-between rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Save receptionist options for <span className="font-medium text-foreground">{clinicName || 'your business'}</span>.
            Admins can push updated wording to the connected phone line.
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button onClick={() => void save()} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save receptionist settings
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
      ) : null}
    </div>
  )
}
