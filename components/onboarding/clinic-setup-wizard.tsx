'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { supabase } from '@/lib/supabase/client'
import { useAppStore } from '@/lib/store'
import { toast } from 'sonner'
import { KNOWLEDGE_ITEM_BODY_MAX_CHARS, KNOWLEDGE_ITEMS_MAX_COUNT } from '@/lib/clinic-call-ai'
import { defaultAgentConfig } from '@/lib/data'
import { formatPhoneDisplay } from '@/lib/phone-format'
import type { ClinicCallAiSettings, ElevenLabsPhoneNumberOption, ElevenLabsVoiceOption, VoiceStyle } from '@/lib/types'
import { ChevronLeft, ChevronRight, Loader2, Pause, Play, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

const STEPS = [
  'Train agent',
  'Business details',
  'Select a voice',
  'Agent settings',
  'Phone number',
] as const

/** Filter DevTools console with: Vocalis:onboarding */
function obLog(event: string, payload?: Record<string, unknown>) {
  console.log(`[Vocalis:onboarding] ${event}`, { t: new Date().toISOString(), ...payload })
}

const VOICE_OPTIONS: { value: VoiceStyle; label: string }[] = [
  { value: 'calm', label: 'Calm (steady)' },
  { value: 'neutral', label: 'Neutral (balanced)' },
  { value: 'upbeat', label: 'Upbeat (warm)' },
]

function newId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `k-${Date.now()}`
}

/** ElevenLabs accent labels are often lowercase adjectives; use place names after "from". */
function accentLabelForDisplay(accent: string): string {
  const key = accent.trim().toLowerCase()
  const map: Record<string, string> = {
    american: 'America',
    british: 'Britain',
    australian: 'Australia',
    canadian: 'Canada',
    irish: 'Ireland',
    scottish: 'Scotland',
    indian: 'India',
  }
  if (map[key]) return map[key]
  if (!key) return ''
  return accent.trim().charAt(0).toUpperCase() + accent.trim().slice(1)
}

function voicePickerLabel(v: ElevenLabsVoiceOption): string {
  const genderRaw = v.gender?.trim()
  const base = v.name.trim()
  const accentRaw = v.accent?.trim()
  const accent = accentRaw ? accentLabelForDisplay(accentRaw) : ''
  if (!genderRaw) {
    return accent ? `${base} (${accent})` : base
  }
  const g =
    genderRaw.toLowerCase() === 'female'
      ? 'Female'
      : genderRaw.toLowerCase() === 'male'
        ? 'Male'
        : genderRaw
  if (accent) return `${base} from ${accent} (${g})`
  return `${base} (${g})`
}

function VoicePickerRow({
  voice,
  selected,
  playing,
  previewLoading,
  onPreview,
  onSelect,
}: {
  voice: ElevenLabsVoiceOption
  selected: boolean
  playing: boolean
  previewLoading: boolean
  onSelect: () => void
  onPreview: () => void
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2 py-2',
        selected ? 'bg-emerald-50/90' : 'hover:bg-zinc-50'
      )}
    >
      <button
        type="button"
        disabled={previewLoading}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border transition-colors disabled:opacity-60',
          playing
            ? 'border-emerald-600 bg-emerald-600 text-white'
            : 'border-zinc-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50'
        )}
        onClick={(e) => {
          e.stopPropagation()
          onPreview()
        }}
        aria-label={previewLoading ? 'Loading preview' : playing ? 'Stop preview' : 'Play preview'}
      >
        {previewLoading ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : playing ? (
          <Pause className="h-5 w-5" />
        ) : (
          <Play className="h-5 w-5" />
        )}
      </button>
      <button
        type="button"
        className="min-w-0 flex-1 rounded-lg px-2 py-2 text-left text-base font-semibold text-foreground"
        onClick={onSelect}
      >
        {voicePickerLabel(voice)}
      </button>
      {selected ? <span className="shrink-0 pr-2 text-emerald-600">✓</span> : null}
    </div>
  )
}

type Props = {
  onDone: () => void
  /** Super admin: load/save via `/api/super-admin/clinic-settings` for this clinic id. */
  superAdminClinicId?: string | null
}

export function ClinicSetupWizard({ onDone, superAdminClinicId = null }: Props) {
  const router = useRouter()
  const { profile, setProfile, setAgentConfig } = useAppStore()
  const [step, setStep] = useState(0)
  const [celebrate, setCelebrate] = useState(false)
  const [exitingAlreadyComplete, setExitingAlreadyComplete] = useState(false)

  const settingsUrl = useMemo(() => {
    const id = superAdminClinicId?.trim()
    if (id) return `/api/super-admin/clinic-settings?clinicId=${encodeURIComponent(id)}`
    return '/api/clinic/settings'
  }, [superAdminClinicId])

  const [loadingSettings, setLoadingSettings] = useState(true)
  const [callAi, setCallAi] = useState<ClinicCallAiSettings | null>(null)

  const [homepageUrl, setHomepageUrl] = useState('')
  const [training, setTraining] = useState(false)
  const [urlKnowledgePairs, setUrlKnowledgePairs] = useState<{ title: string; body: string }[]>([])

  const [businessName, setBusinessName] = useState('')
  const [businessPhone, setBusinessPhone] = useState('')
  const [businessDescription, setBusinessDescription] = useState('')

  const [voiceStyle, setVoiceStyle] = useState<VoiceStyle>('neutral')
  const [voicePresetGroups, setVoicePresetGroups] = useState<{ label: string; voices: ElevenLabsVoiceOption[] }[]>(
    []
  )
  const [voicesLoadState, setVoicesLoadState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  /** Bumps to re-run the ElevenLabs voices fetch (Retry); must not be in the same effect deps as `voicesLoadState` or loading gets stuck. */
  const [voiceListRetryKey, setVoiceListRetryKey] = useState(0)
  const [selectedElevenLabsVoiceId, setSelectedElevenLabsVoiceId] = useState('')
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null)
  const [previewLoadingVoiceId, setPreviewLoadingVoiceId] = useState<string | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement | null>(null)
  const previewObjectUrlRef = useRef<string | null>(null)

  const [greeting, setGreeting] = useState('')
  const [collectName, setCollectName] = useState(true)
  const [collectPhone, setCollectPhone] = useState(true)
  const [collectEmail, setCollectEmail] = useState(true)
  const [recordAck, setRecordAck] = useState(false)

  const [elPhoneNumbers, setElPhoneNumbers] = useState<ElevenLabsPhoneNumberOption[]>([])
  const [phonesLoadState, setPhonesLoadState] = useState<'idle' | 'loading' | 'error' | 'done'>('idle')
  const [phoneListRetryKey, setPhoneListRetryKey] = useState(0)
  const [selectedElPhoneNumberId, setSelectedElPhoneNumberId] = useState('')
  const [saving, setSaving] = useState(false)
  const authHeaders = useCallback(async () => {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) {
      obLog('auth_no_token', {
        hasSession: !!session,
        getSessionError: error?.message ?? null,
      })
      throw new Error('Not signed in')
    }
    return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } as Record<string, string>
  }, [])

  useEffect(() => {
    obLog('wizard_mount', {
      superAdminClinicId: superAdminClinicId?.trim() || null,
      settingsUrl,
      profileClinicId: profile?.clinicId ?? null,
    })
  }, [superAdminClinicId, settingsUrl, profile?.clinicId])

  useEffect(() => {
    obLog('step_change', {
      step,
      stepLabel: STEPS[step] ?? '?',
      loadingSettings,
      hasCallAi: !!callAi,
      training,
      saving,
      voicesLoadState,
      phonesLoadState,
      recordAck,
      nextWouldBeDisabled: step === 3 && !recordAck,
    })
  }, [
    step,
    loadingSettings,
    callAi,
    training,
    saving,
    voicesLoadState,
    phonesLoadState,
    recordAck,
  ])

  useEffect(() => {
    if (loadingSettings || !callAi) {
      obLog('wizard_loading_gate', { loadingSettings, hasCallAi: !!callAi })
    }
  }, [loadingSettings, callAi])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingSettings(true)
      obLog('settings_fetch_start', { settingsUrl })
      try {
        const headers = await authHeaders()
        const res = await fetch(settingsUrl, { headers })
        const data = await res.json()
        obLog('settings_fetch_response', {
          ok: res.ok,
          status: res.status,
          hasCallAi: !!(data && typeof data === 'object' && (data as { callAi?: unknown }).callAi),
          onboardingCompleted:
            data && typeof data === 'object'
              ? (data as { onboardingCompleted?: boolean }).onboardingCompleted
              : undefined,
        })
        if (!res.ok) throw new Error(data.error || 'Failed to load')
        if (cancelled) return
        if (superAdminClinicId?.trim() && data.onboardingCompleted === true) {
          obLog('settings_redirect_already_complete', { to: '/businesses' })
          setExitingAlreadyComplete(true)
          setLoadingSettings(false)
          router.replace('/businesses')
          return
        }
        setCallAi(data.callAi as ClinicCallAiSettings)
        const ac = data.agentConfig as {
          clinicName?: string
          phoneNumber?: string
          voiceStyle?: VoiceStyle
          elevenLabsVoiceId?: string
          elevenLabsAgentId?: string
          elevenLabsOutboundAgentId?: string
          elevenLabsPhoneNumberId?: string
        } | null
        setBusinessName(typeof data.clinicName === 'string' ? data.clinicName : ac?.clinicName || '')
        setBusinessPhone(ac?.phoneNumber || '')
        if (ac?.voiceStyle === 'calm' || ac?.voiceStyle === 'neutral' || ac?.voiceStyle === 'upbeat') {
          setVoiceStyle(ac.voiceStyle)
        }
        setSelectedElevenLabsVoiceId(
          typeof ac?.elevenLabsVoiceId === 'string' ? ac.elevenLabsVoiceId.trim() : ''
        )
        setSelectedElPhoneNumberId(
          typeof ac?.elevenLabsPhoneNumberId === 'string' ? ac.elevenLabsPhoneNumberId.trim() : ''
        )
        const ai = data.callAi as ClinicCallAiSettings
        const desc = (ai.knowledgeItems || []).find(
          (k) => k.title.toLowerCase() === 'business description' || k.title.toLowerCase() === 'business name'
        )
        if (desc?.body) setBusinessDescription(desc.body)
        const pb = ai.inboundPlaybook?.trim() || ''
        if (pb) setGreeting(pb.split('\n')[0] || pb)
        else if (data.clinicName) {
          setGreeting(`You've reached ${data.clinicName}. How can I help you today?`)
        }
      } catch (e) {
        if (!cancelled) {
          obLog('settings_fetch_error', {
            message: e instanceof Error ? e.message : String(e),
          })
          toast.error(e instanceof Error ? e.message : 'Failed to load settings')
        }
      } finally {
        if (!cancelled) {
          obLog('settings_fetch_finally', { cancelled })
          setLoadingSettings(false)
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [authHeaders, settingsUrl, superAdminClinicId, router])

  useEffect(() => {
    if (step !== 2) return
    let cancelled = false
    setVoicesLoadState('loading')
    obLog('voices_fetch_start', { retryKey: voiceListRetryKey })
    ;(async () => {
      try {
        const headers = await authHeaders()
        const res = await fetch('/api/elevenlabs/voices', { headers })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load voices')
        if (cancelled) return
        const groups = Array.isArray(data.presetGroups) ? data.presetGroups : []
        type VoiceGroup = { label: string; voices: ElevenLabsVoiceOption[] }
        const normalized: VoiceGroup[] = groups
          .filter((g: unknown): g is Record<string, unknown> => Boolean(g && typeof g === 'object'))
          .map(
            (g: Record<string, unknown>): VoiceGroup => ({
              label: typeof g.label === 'string' ? g.label : 'Voices',
              voices: Array.isArray(g.voices) ? (g.voices as ElevenLabsVoiceOption[]) : [],
            })
          )
          .filter((g: VoiceGroup) => g.voices.length > 0)
        setVoicePresetGroups(
          normalized.length > 0
            ? normalized
            : Array.isArray(data.voices) && data.voices.length > 0
              ? [{ label: 'Receptionist voices', voices: data.voices as ElevenLabsVoiceOption[] }]
              : []
        )
        setVoicesLoadState('done')
        obLog('voices_load_done', {
          groupCount: normalized.length,
          totalVoices: normalized.reduce((n, g) => n + g.voices.length, 0),
        })
      } catch (e) {
        if (!cancelled) {
          obLog('voices_load_error', { message: e instanceof Error ? e.message : String(e) })
          setVoicesLoadState('error')
          toast.error(e instanceof Error ? e.message : 'Failed to load voices')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, authHeaders, voiceListRetryKey])

  useEffect(() => {
    if (step !== 4) return
    let cancelled = false
    setPhonesLoadState('loading')
    obLog('phones_fetch_start', { retryKey: phoneListRetryKey, poolClinic: superAdminClinicId?.trim() || profile?.clinicId?.trim() || null })
    ;(async () => {
      try {
        const headers = await authHeaders()
        const poolClinic = superAdminClinicId?.trim() || profile?.clinicId?.trim() || ''
        const q = poolClinic ? `?clinicId=${encodeURIComponent(poolClinic)}` : ''
        const res = await fetch(`/api/elevenlabs/phone-numbers${q}`, { headers })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load phone numbers')
        if (cancelled) return
        const list = Array.isArray(data.phoneNumbers)
          ? (data.phoneNumbers as ElevenLabsPhoneNumberOption[])
          : []
        setElPhoneNumbers(list)
        setPhonesLoadState('done')
        obLog('phones_load_done', { count: list.length })
        setSelectedElPhoneNumberId((prev) => {
          const p = prev.trim()
          if (p && list.some((row) => row.phoneNumberId === p)) return p
          if (p) return p
          return list[0]?.phoneNumberId ?? ''
        })
      } catch (e) {
        if (!cancelled) {
          obLog('phones_load_error', { message: e instanceof Error ? e.message : String(e) })
          setPhonesLoadState('error')
          setElPhoneNumbers([])
          toast.error(e instanceof Error ? e.message : 'Failed to load phone numbers')
        }
      }
    })()
    return () => {
      cancelled = true
    }
  }, [step, authHeaders, phoneListRetryKey, superAdminClinicId, profile?.clinicId])

  const selectedElPhoneDisplay = useMemo(() => {
    const id = selectedElPhoneNumberId.trim()
    if (!id) return ''
    const row = elPhoneNumbers.find((p) => p.phoneNumberId === id)
    if (!row) return id
    const formatted = formatPhoneDisplay(row.phoneNumber)
    return formatted || row.phoneNumber
  }, [selectedElPhoneNumberId, elPhoneNumbers])

  const stopVoicePreview = useCallback(() => {
    const a = previewAudioRef.current
    if (a) {
      a.pause()
      previewAudioRef.current = null
    }
    if (previewObjectUrlRef.current) {
      URL.revokeObjectURL(previewObjectUrlRef.current)
      previewObjectUrlRef.current = null
    }
    setPlayingVoiceId(null)
    setPreviewLoadingVoiceId(null)
  }, [])

  useEffect(() => {
    return () => stopVoicePreview()
  }, [stopVoicePreview])

  const playVoicePreview = useCallback(
    async (v: ElevenLabsVoiceOption) => {
      if (playingVoiceId === v.voiceId) {
        stopVoicePreview()
        return
      }
      stopVoicePreview()
      setPreviewLoadingVoiceId(v.voiceId)
      try {
        const headers = await authHeaders()
        const res = await fetch(
          `/api/elevenlabs/voice-preview?voiceId=${encodeURIComponent(v.voiceId)}&speed=1`,
          { headers }
        )
        const errJson = !res.ok ? await res.json().catch(() => ({})) : null
        if (!res.ok) {
          if (
            errJson &&
            typeof errJson === 'object' &&
            (errJson as { useLibraryPreview?: boolean }).useLibraryPreview === true &&
            v.previewUrl
          ) {
            const a = new Audio(v.previewUrl)
            previewAudioRef.current = a
            setPreviewLoadingVoiceId(null)
            setPlayingVoiceId(v.voiceId)
            toast.message('Playing ElevenLabs catalog sample', {
              description:
                'Custom previews use TTS credits. Add characters in ElevenLabs or upgrade your plan to hear the short test line in each voice.',
            })
            a.play().catch(() => {
              toast.error('Could not play catalog sample')
              stopVoicePreview()
            })
            a.onended = () => stopVoicePreview()
            return
          }
          const base = typeof errJson?.error === 'string' ? errJson.error : 'Could not play preview'
          const detail = typeof errJson?.detail === 'string' ? errJson.detail : ''
          toast.error(detail ? `${base}: ${detail}` : base)
          setPreviewLoadingVoiceId(null)
          return
        }
        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        previewObjectUrlRef.current = objectUrl
        const audio = new Audio(objectUrl)
        previewAudioRef.current = audio
        setPreviewLoadingVoiceId(null)
        setPlayingVoiceId(v.voiceId)
        audio.play().catch(() => {
          toast.error('Could not play preview')
          stopVoicePreview()
        })
        audio.onended = () => stopVoicePreview()
      } catch {
        toast.error('Could not play preview')
        setPreviewLoadingVoiceId(null)
      }
    },
    [playingVoiceId, stopVoicePreview, authHeaders]
  )

  const mergedKnowledgeItems = useMemo(() => {
    const base = callAi?.knowledgeItems ? [...callAi.knowledgeItems] : []
    const seen = new Set(base.map((k) => k.title.trim().toLowerCase()))
    let sort = base.length ? Math.max(...base.map((k) => k.sortOrder ?? 0)) + 1 : 0
    for (const pair of urlKnowledgePairs) {
      const t = pair.title.trim().slice(0, 200)
      const b = pair.body.trim().slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS)
      if (!t || !b) continue
      const key = t.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      if (base.length >= KNOWLEDGE_ITEMS_MAX_COUNT) break
      base.push({
        id: newId(),
        title: t,
        body: b,
        enabled: true,
        sortOrder: sort++,
      })
    }
    const desc = businessDescription.trim()
    if (desc) {
      const title = 'Business description'
      const key = title.toLowerCase()
      const idx = base.findIndex((k) => k.title.trim().toLowerCase() === key)
      if (idx >= 0) {
        base[idx] = { ...base[idx], body: desc.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS), enabled: true }
      } else {
        base.push({
          id: newId(),
          title,
          body: desc.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS),
          enabled: true,
          sortOrder: sort++,
        })
      }
    }
    return base.map((k, i) => ({ ...k, sortOrder: i }))
  }, [callAi?.knowledgeItems, urlKnowledgePairs, businessDescription])

  const buildInboundPlaybook = () => {
    const lines = [greeting.trim()]
    const collect: string[] = []
    if (collectName) collect.push('full name')
    if (collectPhone) collect.push('phone number')
    if (collectEmail) collect.push('email address')
    if (collect.length) {
      lines.push(`When appropriate, collect: ${collect.join(', ')}.`)
    }
    return lines.filter(Boolean).join('\n\n')
  }

  const runTrain = async () => {
    if (!homepageUrl.trim()) {
      obLog('train_blocked', { reason: 'empty_homepage_url' })
      toast.error('Enter your homepage URL')
      return
    }
    setTraining(true)
    obLog('train_start', {
      homepageUrlLen: homepageUrl.trim().length,
      analyzePath: superAdminClinicId?.trim()
        ? '/api/super-admin/analyze-business-url'
        : '/api/clinic/analyze-website',
    })
    try {
      const headers = await authHeaders()
      const analyzeUrl = superAdminClinicId?.trim()
        ? '/api/super-admin/analyze-business-url'
        : '/api/clinic/analyze-website'
      const res = await fetch(analyzeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({ url: homepageUrl.trim() }),
      })
      const data = await res.json()
      obLog('train_response', { ok: res.ok, status: res.status })
      if (!res.ok) throw new Error(data.error || 'Analysis failed')
      const rawKi = Array.isArray(data.knowledgeItems) ? data.knowledgeItems : []
      const pairs: { title: string; body: string }[] = []
      for (const row of rawKi) {
        if (!row || typeof row !== 'object') continue
        const o = row as Record<string, unknown>
        const t = typeof o.title === 'string' ? o.title.trim() : ''
        const b = typeof o.body === 'string' ? o.body.trim() : ''
        if (!t || !b) continue
        pairs.push({ title: t.slice(0, 200), body: b.slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS) })
      }
      setUrlKnowledgePairs(pairs)
      if (typeof data.businessName === 'string' && data.businessName.trim()) {
        setBusinessName(data.businessName.trim())
      }
      if (typeof data.description === 'string' && data.description.trim()) {
        setBusinessDescription(data.description.trim().slice(0, KNOWLEDGE_ITEM_BODY_MAX_CHARS))
      }
      toast.success('Website analyzed')
      obLog('train_success_advance', { pairsCount: pairs.length, nextStep: 1 })
      setStep(1)
    } catch (e) {
      obLog('train_error', { message: e instanceof Error ? e.message : String(e) })
      toast.error(e instanceof Error ? e.message : 'Train failed')
    } finally {
      setTraining(false)
    }
  }

  const finish = async () => {
    if (!callAi) {
      obLog('finish_blocked', { reason: 'callAi_null' })
      return
    }
    setSaving(true)
    obLog('finish_start', {
      selectedVoiceId: selectedElevenLabsVoiceId.trim() || null,
      selectedPhoneId: selectedElPhoneNumberId.trim() || null,
      businessNameLen: businessName.trim().length,
    })
    try {
      const headers = await authHeaders()
      const nextCallAi: ClinicCallAiSettings = {
        ...callAi,
        knowledgeItems: mergedKnowledgeItems,
        inboundPlaybook: buildInboundPlaybook(),
      }
      const pickedRow = elPhoneNumbers.find((p) => p.phoneNumberId === selectedElPhoneNumberId.trim())
      const fallbackLinePhone = pickedRow?.phoneNumber?.trim().slice(0, 80) || ''
      const nextClinicPhone = businessPhone.trim().slice(0, 80) || fallbackLinePhone
      const agentClinicFacts: Record<string, unknown> = {
        clinicName: businessName.trim().slice(0, 200),
        hoursOpen: defaultAgentConfig.hoursOpen,
        hoursClose: defaultAgentConfig.hoursClose,
      }
      if (nextClinicPhone) agentClinicFacts.phoneNumber = nextClinicPhone
      const agentUiPatch: Record<string, unknown> = {
        voiceStyle,
        speechSpeed: 1,
        elevenLabsVoiceId: selectedElevenLabsVoiceId.trim(),
      }
      if (selectedElPhoneNumberId.trim()) {
        agentUiPatch.elevenLabsPhoneNumberId = selectedElPhoneNumberId.trim()
      }
      const body: Record<string, unknown> = {
        callAi: nextCallAi,
        agentClinicFacts,
        agentUiPatch,
        completeClinicOnboarding: true,
      }
      if (profile?.role === 'admin' || profile?.role === 'super_admin' || superAdminClinicId?.trim()) {
        if (businessName.trim()) body.clinicName = businessName.trim().slice(0, 200)
      }
      const res = await fetch(settingsUrl, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      })
      const data = await res.json()
      obLog('finish_response', { ok: res.ok, status: res.status })
      if (!res.ok) throw new Error(data.error || 'Save failed')
      if (data.agentConfig) {
        setAgentConfig(data.agentConfig)
      }
      if (profile && !superAdminClinicId?.trim()) {
        setProfile({ ...profile, needsClinicOnboarding: false })
      }
      setCelebrate(true)
      toast.success('Setup complete')
      const elp = data.elevenLabsProvisioning as
        | { ok?: boolean; skippedReason?: string; error?: string }
        | undefined
      if (elp && elp.ok === false) {
        if (elp.skippedReason === 'no_api_key') {
          toast.warning(
            'Setup saved. Add ELEVENLABS_API_KEY on the server to create and sync your voice agent.'
          )
        } else if (typeof elp.error === 'string' && elp.error.trim()) {
          toast.warning(`Voice agent provisioning issue: ${elp.error.trim().slice(0, 240)}`)
        }
      }
      obLog('finish_success', { celebrate: true })
    } catch (e) {
      obLog('finish_error', { message: e instanceof Error ? e.message : String(e) })
      toast.error(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  if (exitingAlreadyComplete) {
    return null
  }

  if (loadingSettings || !callAi) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-600" />
        <p className="text-sm text-muted-foreground">Loading your workspace…</p>
      </div>
    )
  }

  if (celebrate) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-10">
        <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50/90 to-card px-8 py-10 text-center shadow-lg">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-200/30 to-transparent" />
          <h1 className="text-2xl font-bold text-emerald-800">You are all set!</h1>
          <p className="mt-2 text-sm text-emerald-900/80">Ready to see what your receptionist can do?</p>
          <ul className="mt-8 space-y-4 text-left text-sm">
            {[
              ['Take a message', 'Collect caller info and route it to your team'],
              ['Answer questions', 'Train your receptionist with the knowledge you added'],
              ['Book appointments', 'Share scheduling links or staff follow-up'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <Sparkles className="h-4 w-4" />
                </span>
                <span>
                  <span className="font-semibold text-foreground">{t}</span>
                  <span className="mt-0.5 block text-muted-foreground">{d}</span>
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-sm text-muted-foreground">
            {selectedElPhoneNumberId.trim() ? (
              <>
                Voice line saved:{' '}
                <span className="font-semibold text-foreground">{selectedElPhoneDisplay || selectedElPhoneNumberId}</span>.
                You can change it anytime under Settings → Agent.
              </>
            ) : (
              <>
                No ElevenLabs phone number was selected. Add or import a number in ElevenLabs, then assign it under
                Settings → Agent.
              </>
            )}
          </p>
          <Button
            className="mt-8 w-full gap-2 rounded-xl bg-emerald-600 py-6 text-base hover:bg-emerald-700"
            onClick={() => {
              onDone()
              router.replace(superAdminClinicId?.trim() ? '/businesses' : '/dashboard')
            }}
          >
            <Sparkles className="h-4 w-4" />
            Let&apos;s go!
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50/80 pb-28 pt-8">
      <div className="mx-auto max-w-3xl px-4">
        {/* Progress — click a completed or current step to jump back */}
        <div className="mb-10">
          <div className="flex gap-2 sm:gap-3">
            {STEPS.map((label, i) => {
              const reachable = i <= step
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (!reachable) {
                      obLog('step_tab_blocked', { targetIndex: i, currentStep: step })
                      return
                    }
                    obLog('step_tab_click', { from: step, to: i })
                    setStep(i)
                  }}
                  disabled={!reachable}
                  className={cn(
                    'min-w-0 flex-1 rounded-xl px-1 pb-1 pt-0.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2',
                    reachable && 'cursor-pointer hover:bg-white/90',
                    !reachable && 'cursor-not-allowed opacity-60'
                  )}
                  aria-current={i === step ? 'step' : undefined}
                  aria-label={reachable ? `Go to ${label}` : `${label} (not yet available)`}
                >
                  <div
                    className={cn(
                      'h-1.5 rounded-full transition-colors sm:h-2',
                      i < step ? 'bg-emerald-400' : i === step ? 'bg-emerald-600' : 'bg-zinc-200'
                    )}
                  />
                  <p
                    className={cn(
                      'mt-3 text-center text-sm font-bold leading-tight sm:text-base',
                      i === step ? 'text-foreground' : reachable ? 'text-foreground/85' : 'text-muted-foreground'
                    )}
                  >
                    {label}
                  </p>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200/80 bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.06)] sm:p-10">
          {step === 0 && (
            <div className="space-y-7">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Train your agent</h2>
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  Let&apos;s fetch information about your business from your website.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Homepage</Label>
                <Input
                  className="h-12 rounded-xl border-zinc-200 text-base"
                  placeholder="https://www.example.com"
                  value={homepageUrl}
                  onChange={(e) => setHomepageUrl(e.target.value)}
                />
                <p className="text-sm font-medium text-muted-foreground">
                  We&apos;ll use the page to suggest knowledge for your receptionist.
                </p>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-7">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">This is what we gathered</h2>
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  You can edit this later under Settings → Agent → Knowledge.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Business name</Label>
                <Input
                  className="h-12 rounded-xl border-zinc-200 text-base"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Business phone number</Label>
                <Input
                  className="h-12 rounded-xl border-zinc-200 text-base"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                />
                <p className="text-sm font-medium text-muted-foreground">The number callers know for your practice.</p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">What does your business do?</Label>
                <Textarea
                  className="min-h-[140px] rounded-xl border-zinc-200 text-base"
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                />
                <p className="text-sm font-medium leading-relaxed text-muted-foreground">
                  On finish, this becomes a Knowledge card titled &quot;Business description&quot; for the receptionist.
                  If you used <span className="font-bold text-foreground">Train agent</span>, extra cards from your
                  website are saved too.
                </p>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-7">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Select a voice for your agent</h2>
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  You can always change this later in Settings.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Receptionist voices</Label>
                <div className="max-h-80 overflow-y-auto rounded-xl border border-zinc-200 bg-white">
                  {voicesLoadState === 'loading' && (
                    <div className="flex items-center gap-2 p-4 text-base font-medium text-muted-foreground">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Loading voices…
                    </div>
                  )}
                  {voicesLoadState === 'error' && (
                    <div className="space-y-3 p-4">
                      <p className="text-base font-medium text-muted-foreground">
                        Could not load the voice list. Ensure <span className="font-bold text-foreground">ELEVENLABS_API_KEY</span>{' '}
                        is set for this deployment.
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-lg"
                        onClick={() => setVoiceListRetryKey((k) => k + 1)}
                      >
                        Retry
                      </Button>
                    </div>
                  )}
                  {voicesLoadState === 'done' && voicePresetGroups.length === 0 && (
                    <p className="p-4 text-base font-medium text-muted-foreground">
                      No curated voices were returned from ElevenLabs.
                    </p>
                  )}
                  {voicesLoadState === 'done' &&
                    voicePresetGroups.map((group) => (
                      <div key={group.label}>
                        <div className="bg-zinc-50 px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-foreground/80">
                          {group.label}
                        </div>
                        {group.voices.map((v) => (
                          <VoicePickerRow
                            key={v.voiceId}
                            voice={v}
                            selected={selectedElevenLabsVoiceId === v.voiceId}
                            playing={playingVoiceId === v.voiceId}
                            previewLoading={previewLoadingVoiceId === v.voiceId}
                            onSelect={() => setSelectedElevenLabsVoiceId(v.voiceId)}
                            onPreview={() => void playVoicePreview(v)}
                          />
                        ))}
                      </div>
                    ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Voice style</Label>
                <Select value={voiceStyle} onValueChange={(v) => setVoiceStyle(v as VoiceStyle)}>
                  <SelectTrigger className="h-12 w-full rounded-xl border-zinc-200 text-base font-semibold">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VOICE_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value} className="text-base font-medium">
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-7">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Final touches</h2>
                <p className="mt-2 text-base font-medium text-muted-foreground">Personalize your agent</p>
              </div>
              <div className="space-y-2">
                <Label className="text-base font-bold text-foreground">Greeting</Label>
                <Textarea
                  className="min-h-[120px] rounded-xl border-zinc-200 text-base"
                  value={greeting}
                  onChange={(e) => setGreeting(e.target.value)}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <Label className="text-base font-bold text-foreground">Info your agent will collect from callers</Label>
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    You can add or remove questions later in Settings.
                  </p>
                </div>
                {(
                  [
                    { label: 'Full name', checked: collectName, set: setCollectName },
                    { label: 'Phone number', checked: collectPhone, set: setCollectPhone },
                    { label: 'Email address', checked: collectEmail, set: setCollectEmail },
                  ] as const
                ).map((row) => (
                  <label key={row.label} className="flex cursor-pointer items-center gap-3 text-base font-semibold">
                    <Checkbox checked={row.checked} onCheckedChange={(v) => row.set(v === true)} className="size-5" />
                    <span>{row.label}</span>
                  </label>
                ))}
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-zinc-100 bg-zinc-50/50 p-5 text-base font-medium leading-snug">
                <Checkbox
                  checked={recordAck}
                  onCheckedChange={(v) => setRecordAck(v === true)}
                  className="mt-1 size-5 shrink-0"
                />
                <span>
                  I acknowledge that calls may be recorded. I am responsible for notifying callers as required by law.
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-7">
              <div>
                <h2 className="text-3xl font-bold tracking-tight text-foreground">Pick a phone number</h2>
                <p className="mt-2 text-base font-medium text-muted-foreground">
                  You can forward calls to this number.{' '}
                  <Link
                    href="/help/call-forwarding"
                    className="font-semibold text-emerald-700 underline underline-offset-2 hover:text-emerald-800"
                  >
                    Learn how
                  </Link>
                </p>
              </div>
              <div className="space-y-3">
                {phonesLoadState === 'loading' && (
                  <div className="flex items-center gap-2 rounded-xl border border-zinc-200 p-4 text-base font-medium text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Loading numbers from ElevenLabs…
                  </div>
                )}
                {phonesLoadState === 'error' && (
                  <div className="space-y-3 rounded-xl border border-zinc-200 p-4">
                    <p className="text-base font-medium text-muted-foreground">
                      Could not load numbers. Check <span className="font-bold text-foreground">ELEVENLABS_API_KEY</span>{' '}
                      and your ElevenLabs account.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-lg text-base font-semibold"
                      onClick={() => setPhoneListRetryKey((k) => k + 1)}
                    >
                      Retry
                    </Button>
                  </div>
                )}
                {phonesLoadState === 'done' &&
                  elPhoneNumbers.length === 0 &&
                  !selectedElPhoneNumberId.trim() && (
                    <p className="rounded-xl border border-zinc-200 p-4 text-base font-medium text-muted-foreground">
                      No phone numbers in ElevenLabs yet. Buy numbers in Twilio, import them into ElevenLabs (ConvAI phone
                      numbers), then Retry—or set the Phone Number ID under Settings → Agent.
                    </p>
                  )}
                {phonesLoadState === 'done' &&
                  selectedElPhoneNumberId.trim() &&
                  (elPhoneNumbers.length === 0 ||
                    !elPhoneNumbers.some((p) => p.phoneNumberId === selectedElPhoneNumberId.trim())) && (
                    <p className="text-sm font-medium text-amber-900">
                      {elPhoneNumbers.length === 0
                        ? 'A phone number ID is already saved for this clinic, but ElevenLabs returned no numbers. Finish keeps that ID, or update it later under Settings → Agent.'
                        : 'Your saved line ID is not in the list below. Finish keeps that ID unless you pick a different number.'}
                    </p>
                  )}
                {phonesLoadState === 'done' &&
                  elPhoneNumbers.map((row) => {
                    const display = formatPhoneDisplay(row.phoneNumber) || row.phoneNumber
                    const selected = selectedElPhoneNumberId === row.phoneNumberId
                    return (
                      <button
                        key={row.phoneNumberId}
                        type="button"
                        onClick={() => setSelectedElPhoneNumberId(row.phoneNumberId)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-xl border px-4 py-4 text-left transition-colors',
                          selected ? 'border-emerald-600 bg-emerald-50/60' : 'border-zinc-200 hover:bg-zinc-50'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-4 w-4 shrink-0 rounded-full border-2',
                            selected ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-300'
                          )}
                        />
                        <span className="min-w-0 flex-1 text-base font-bold text-foreground">{display}</span>
                      </button>
                    )
                  })}
              </div>
            </div>
          )}
        </div>

        {/* Nav */}
        <div className="mx-auto mt-8 flex max-w-3xl items-center justify-between gap-4 px-1">
          <Button
            type="button"
            variant="outline"
            className="gap-2 rounded-xl border-zinc-200 px-5 py-6 text-base font-bold"
            disabled={step === 0 || saving}
            onClick={() => {
              obLog('back_click', { from: step, to: Math.max(0, step - 1) })
              setStep((s) => Math.max(0, s - 1))
            }}
          >
            <ChevronLeft className="h-5 w-5" />
            Back
          </Button>
          {step === 0 && (
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                className="rounded-xl px-4 py-6 text-base font-bold"
                onClick={() => {
                  obLog('skip_train_click', { fromStep: 0, toStep: 1 })
                  setStep(1)
                }}
                disabled={training}
              >
                Skip
              </Button>
              <Button
                type="button"
                className="gap-2 rounded-xl bg-emerald-600 px-7 py-6 text-base font-bold hover:bg-emerald-700"
                disabled={training}
                onClick={() => {
                  if (training) {
                    obLog('train_click_ignored', { training: true })
                    return
                  }
                  obLog('train_click', { hasUrl: !!homepageUrl.trim() })
                  void runTrain()
                }}
              >
                {training ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
                Train agent
              </Button>
            </div>
          )}
          {step > 0 && step < 4 && (
            <Button
              type="button"
              className="gap-2 rounded-xl bg-emerald-600 px-7 py-6 text-base font-bold hover:bg-emerald-700"
              disabled={(step === 3 && !recordAck) || saving}
              onClick={() => {
                const blocked = (step === 3 && !recordAck) || saving
                if (blocked) {
                  obLog('next_blocked', { step, recordAck, saving, reason: step === 3 && !recordAck ? 'need_record_ack' : 'saving' })
                  return
                }
                obLog('next_click', { from: step, to: step + 1 })
                setStep((s) => s + 1)
              }}
            >
              Next
              <ChevronRight className="h-5 w-5" />
            </Button>
          )}
          {step === 4 && (
            <Button
              type="button"
              className="gap-2 rounded-xl bg-emerald-600 px-7 py-6 text-base font-bold hover:bg-emerald-700"
              disabled={saving}
              onClick={() => {
                if (saving) {
                  obLog('finish_click_ignored', { saving: true })
                  return
                }
                obLog('finish_click', { step: 4 })
                void finish()
              }}
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Sparkles className="h-5 w-5" />}
              Finish
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
