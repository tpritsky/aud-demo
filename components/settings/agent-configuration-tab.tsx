'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { VoiceStyle } from '@/lib/types'
import { triggerOutboundCall, type CallDynamicVariables } from '@/lib/call-trigger'
import { Save, Phone, Clock, Mic, Settings2, AlertTriangle, PhoneCall, RotateCcw, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { defaultAgentConfig } from '@/lib/data'
// useToast not needed - using toast directly from sonner

type AgentConfigurationTabProps = {
  superAdminClinicId?: string | null
}

export function AgentConfigurationTab({ superAdminClinicId = null }: AgentConfigurationTabProps) {
  const { agentConfig: storeAgentConfig, setAgentConfig: storeSetAgentConfig, profile } = useAppStore()
  const isClinicEdit = Boolean(superAdminClinicId?.trim())
  const [localAgent, setLocalAgent] = useState<typeof storeAgentConfig | null>(null)
  const [clinicAgentStatus, setClinicAgentStatus] = useState<'idle' | 'loading' | 'error'>(
    isClinicEdit ? 'loading' : 'idle'
  )
  const [clinicAgentSaving, setClinicAgentSaving] = useState(false)
  const [clinicAgentRetryTick, setClinicAgentRetryTick] = useState(0)

  const [testPhone, setTestPhone] = useState('')
  const [isTestCalling, setIsTestCalling] = useState(false)
  const memberWorkspace = profile?.role === 'member' && !isClinicEdit

  useEffect(() => {
    if (!superAdminClinicId?.trim()) {
      setLocalAgent(null)
      setClinicAgentStatus('idle')
      return
    }
    const id = superAdminClinicId.trim()
    let cancelled = false
    setClinicAgentStatus('loading')
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) throw new Error('Not signed in')
        const res = await fetch(`/api/super-admin/businesses/${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json()
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Failed to load')
        if (cancelled) return
        const existing = data?.business?.settings?.agentConfig
        setLocalAgent({
          ...defaultAgentConfig,
          ...existing,
          clinicName: existing?.clinicName ?? data?.business?.name ?? '',
          phoneNumber: existing?.phoneNumber ?? '',
        })
        setClinicAgentStatus('idle')
      } catch {
        if (!cancelled) setClinicAgentStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [superAdminClinicId, clinicAgentRetryTick])

  const agentConfig = isClinicEdit ? (localAgent ?? defaultAgentConfig) : storeAgentConfig

  const applyAgent = (next: typeof storeAgentConfig) => {
    if (isClinicEdit) setLocalAgent(next)
    else void storeSetAgentConfig(next)
  }

  const outboundAgentId = agentConfig.elevenLabsOutboundAgentId || agentConfig.elevenLabsAgentId
  const canTestCall = !!outboundAgentId && !!agentConfig.elevenLabsPhoneNumberId

  const handleSave = async () => {
    if (isClinicEdit) {
      const id = superAdminClinicId?.trim()
      if (!id || !localAgent || clinicAgentStatus !== 'idle') {
        toast.error('Still loading clinic settings')
        return
      }
      setClinicAgentSaving(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const token = session?.access_token
        if (!token) {
          toast.error('Session expired')
          return
        }
        const res = await fetch(`/api/super-admin/businesses/${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ settings: { agentConfig: localAgent } }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : 'Save failed')
        toast.success('Agent settings saved', {
          description: 'This clinic’s configuration is updated.',
        })
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Save failed')
      } finally {
        setClinicAgentSaving(false)
      }
      return
    }
    toast.success('Settings Saved', {
      description: 'Agent configuration has been updated successfully.',
    })
  }

  const updateConfig = <K extends keyof typeof agentConfig>(
    key: K,
    value: typeof agentConfig[K]
  ) => {
    applyAgent({ ...agentConfig, [key]: value })
  }

  const updateAllowedIntents = (key: keyof typeof agentConfig.allowedIntents, value: boolean) => {
    applyAgent({
      ...agentConfig,
      allowedIntents: { ...agentConfig.allowedIntents, [key]: value },
    })
  }

  const updateEscalationRules = (
    key: keyof typeof agentConfig.escalationRules,
    value: boolean
  ) => {
    applyAgent({
      ...agentConfig,
      escalationRules: { ...agentConfig.escalationRules, [key]: value },
    })
  }

  const updateCallbackSettings = <K extends keyof typeof agentConfig.callbackSettings>(
    key: K,
    value: typeof agentConfig.callbackSettings[K]
  ) => {
    applyAgent({
      ...agentConfig,
      callbackSettings: { ...agentConfig.callbackSettings, [key]: value },
    })
  }

  if (isClinicEdit && clinicAgentStatus === 'loading') {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isClinicEdit && clinicAgentStatus === 'error') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Agent</CardTitle>
          <CardDescription>Could not load this clinic’s agent settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setClinicAgentStatus('loading')
              setClinicAgentRetryTick((n) => n + 1)
            }}
          >
            Retry
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {isClinicEdit ? (
        <p className="text-sm rounded-lg border border-border bg-muted/30 px-3 py-2 text-muted-foreground">
          You are editing the <strong className="text-foreground">agent configuration</strong> stored for this business.
          Use <strong className="text-foreground">Save configuration</strong> to write changes.
        </p>
      ) : null}
      {memberWorkspace ? (
        <p className="text-sm rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-950 dark:text-amber-100">
          <AlertTriangle className="mr-1 inline h-4 w-4 align-text-bottom" />
          Your clinic&apos;s voice line and AI agent are set up automatically for your business. You can adjust voice style,
          intents, and callbacks below. Business details and hours are under{' '}
          <strong className="text-foreground">Knowledge</strong>.
        </p>
      ) : null}

      {/* Test call bot */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Try the call bot
          </CardTitle>
          <CardDescription>
            Place a test outbound call to your phone. The AI will use your clinic name and a test script.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!canTestCall ? (
            <p className="text-sm text-muted-foreground">
              Test calls need your clinic&apos;s voice line and agent to finish provisioning (usually right after signup and
              onboarding). If this stays disabled, contact your administrator or support.
            </p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="test-phone">Your phone number</Label>
                <div className="relative max-w-xs">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="test-phone"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="+1 (555) 123-4567"
                    className="pl-9"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  E.164 format (e.g. +15551234567). US numbers: 10 digits with optional +1.
                </p>
                <p className="text-xs text-muted-foreground">
                  Calls appear in your log after ElevenLabs posts the post-call webhook to your app. On local dev,
                  that URL must be publicly reachable (e.g. tunnel or deployed preview), not plain localhost.
                </p>
              </div>
              <Button
                onClick={async () => {
                  if (!testPhone.trim()) {
                    toast.error('Enter your phone number')
                    return
                  }
                  setIsTestCalling(true)
                  try {
                    const dynamicVars: CallDynamicVariables = {
                      patient_name: 'Test User',
                      clinic_name: agentConfig.clinicName || 'Demo Clinic',
                      call_reason: 'Test call',
                      call_goal: 'Verify the voice bot is working',
                    }
                    const result = await triggerOutboundCall(
                      testPhone.trim(),
                      outboundAgentId!,
                      agentConfig.elevenLabsPhoneNumberId!,
                      dynamicVars
                    )
                    if (result.success) {
                      toast.success('Call started', {
                        description: 'The bot should be calling you now. Answer to try it out.',
                      })
                      setTestPhone('')
                    } else {
                      toast.error('Call failed', { description: result.error })
                    }
                  } catch (e) {
                    toast.error('Call failed', {
                      description: e instanceof Error ? e.message : 'Unknown error',
                    })
                  } finally {
                    setIsTestCalling(false)
                  }
                }}
                disabled={isTestCalling || !testPhone.trim()}
              >
                {isTestCalling ? 'Calling…' : 'Call my phone'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Voice Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mic className="h-5 w-5" />
            Voice Settings
          </CardTitle>
          <CardDescription>
            Configure how the AI agent sounds when speaking to patients.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="voice-style">Voice Style</Label>
            <Select
              value={agentConfig.voiceStyle}
              onValueChange={(v) => updateConfig('voiceStyle', v as VoiceStyle)}
            >
              <SelectTrigger id="voice-style" className="h-auto w-full min-h-11 py-2.5 sm:h-9 sm:min-h-9 sm:w-fit sm:py-2">
                <SelectValue placeholder="Select voice style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="calm">Calm - Soothing and reassuring</SelectItem>
                <SelectItem value="neutral">Neutral - Professional and balanced</SelectItem>
                <SelectItem value="upbeat">Upbeat - Friendly and energetic</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Allowed Intents */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings2 className="h-5 w-5" />
            Allowed Intents
          </CardTitle>
          <CardDescription>
            Control which types of requests the AI agent can handle autonomously.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: 'scheduling' as const,
              label: 'Scheduling',
              description: 'Book new appointments',
            },
            {
              key: 'rescheduleCancel' as const,
              label: 'Reschedule/Cancel',
              description: 'Modify or cancel existing appointments',
            },
            {
              key: 'newPatientIntake' as const,
              label: 'New Patient Intake',
              description: 'Collect information from new patients',
            },
            {
              key: 'deviceTroubleshooting' as const,
              label: 'Device Troubleshooting',
              description: 'Help with hearing aid issues',
            },
            {
              key: 'billing' as const,
              label: 'Billing Inquiries',
              description: 'Answer basic billing questions',
            },
          ].map((intent) => (
            <div key={intent.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label htmlFor={`intent-${intent.key}`} className="text-base">
                  {intent.label}
                </Label>
                <p className="text-sm text-muted-foreground">{intent.description}</p>
              </div>
              <Switch
                id={`intent-${intent.key}`}
                className="shrink-0"
                checked={agentConfig.allowedIntents[intent.key]}
                onCheckedChange={(checked) => updateAllowedIntents(intent.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Escalation Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Escalation Rules
          </CardTitle>
          <CardDescription>
            Define when calls should be automatically escalated to a human.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {[
            {
              key: 'medicalQuestion' as const,
              label: 'Medical Questions',
              description: 'Escalate if caller asks medical advice questions',
            },
            {
              key: 'upsetSentiment' as const,
              label: 'Upset Sentiment',
              description: 'Escalate if caller appears frustrated or angry',
            },
            {
              key: 'repeatedMisunderstanding' as const,
              label: 'Repeated Misunderstanding',
              description: 'Escalate after multiple failed understanding attempts',
            },
            {
              key: 'userRequestsHuman' as const,
              label: 'User Requests Human',
              description: 'Escalate when caller explicitly asks for a person',
            },
          ].map((rule) => (
            <div key={rule.key} className="flex items-center justify-between gap-4">
              <div className="min-w-0 flex-1 space-y-0.5">
                <Label htmlFor={`rule-${rule.key}`} className="text-base">
                  {rule.label}
                </Label>
                <p className="text-sm text-muted-foreground">{rule.description}</p>
              </div>
              <Switch
                id={`rule-${rule.key}`}
                className="shrink-0"
                checked={agentConfig.escalationRules[rule.key]}
                onCheckedChange={(checked) => updateEscalationRules(rule.key, checked)}
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Callback Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5" />
            Callback Settings
          </CardTitle>
          <CardDescription>
            Configure how callback tasks are created and managed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-attempts" className="flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                Max Redial Attempts
              </Label>
              <Select
                value={agentConfig.callbackSettings.maxAttempts.toString()}
                onValueChange={(v) => updateCallbackSettings('maxAttempts', parseInt(v))}
              >
                <SelectTrigger id="max-attempts">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                    <SelectItem key={n} value={n.toString()}>
                      {n} attempt{n !== 1 ? 's' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Maximum number of call attempts before marking as unreachable
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="redial-interval" className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Redial Interval
              </Label>
              <Select
                value={agentConfig.callbackSettings.redialIntervalMinutes.toString()}
                onValueChange={(v) => updateCallbackSettings('redialIntervalMinutes', parseInt(v))}
              >
                <SelectTrigger id="redial-interval">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 minutes</SelectItem>
                  <SelectItem value="30">30 minutes</SelectItem>
                  <SelectItem value="60">1 hour</SelectItem>
                  <SelectItem value="120">2 hours</SelectItem>
                  <SelectItem value="240">4 hours</SelectItem>
                  <SelectItem value="480">8 hours</SelectItem>
                  <SelectItem value="1440">24 hours</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Minimum time between callback attempts
              </p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <Label>Default Priority</Label>
            <Select
              value={agentConfig.callbackSettings.priorityByDefault}
              onValueChange={(v) => updateCallbackSettings('priorityByDefault', v as 'high' | 'medium' | 'low')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="high">High - Within 1 hour</SelectItem>
                <SelectItem value="medium">Medium - Within 24 hours</SelectItem>
                <SelectItem value="low">Low - Within 48 hours</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Separator />

          <div className="space-y-4">
            <Label>Auto-Create Callback Tasks</Label>
            {[
              {
                key: 'autoCreateOnEscalation' as const,
                label: 'On Escalation',
                description: 'Create callback when a call is escalated',
              },
              {
                key: 'autoCreateOnVoicemail' as const,
                label: 'On Voicemail',
                description: 'Create callback when call goes to voicemail',
              },
              {
                key: 'autoCreateOnNoAnswer' as const,
                label: 'On No Answer',
                description: 'Create callback when patient doesn\'t answer',
              },
            ].map((setting) => (
              <div key={setting.key} className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <Label htmlFor={`callback-${setting.key}`} className="text-base">
                    {setting.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">{setting.description}</p>
                </div>
                <Switch
                  id={`callback-${setting.key}`}
                  className="shrink-0"
                  checked={agentConfig.callbackSettings[setting.key]}
                  onCheckedChange={(checked) => updateCallbackSettings(setting.key, checked)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={() => void handleSave()} size="lg" disabled={clinicAgentSaving}>
          {clinicAgentSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Save Configuration
        </Button>
      </div>
    </div>
  )
}
