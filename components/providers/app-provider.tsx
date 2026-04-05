'use client'

import { useState, useMemo, useEffect, useRef, useCallback, ReactNode } from 'react'
import {
  AppContext,
  AppStore,
  initialState,
} from '@/lib/store'
import {
  Call,
  Patient,
  ProactiveSequence,
  CallbackTask,
  ActivityEvent,
  AgentConfig,
  ScheduledCheckIn,
} from '@/lib/types'
import {
  recalculateAllCheckIns,
  getDueCallbackTasks,
  getDueScheduledCheckIns,
  clearFutureCheckIns,
} from '@/lib/scheduling'
import { triggerOutboundCall, CallDynamicVariables } from '@/lib/call-trigger'
import { normalizePhoneNumber } from '@/lib/phone-format'
import { supabase } from '@/lib/supabase/client'
import { hasRealSupabaseConfig } from '@/lib/supabase/env'
import {
  clearLocalSupabaseSession,
  isRefreshTokenAuthError,
} from '@/lib/supabase/clear-stale-session'
import * as dbPatients from '@/lib/db/patients'
import * as dbCalls from '@/lib/db/calls'
import * as dbSequences from '@/lib/db/sequences'
import * as dbCallbackTasks from '@/lib/db/callback-tasks'
import * as dbScheduledCheckIns from '@/lib/db/scheduled-checkins'
import * as dbActivityEvents from '@/lib/db/activity-events'
import * as dbAgentConfig from '@/lib/db/agent-config'
import * as dbUtils from '@/lib/db/utils'
import { toast } from 'sonner'
import { fetchWithTimeout, isLikelyAbortError } from '@/lib/utils'
import { clinicOnboardingIncomplete } from '@/lib/clinic-call-ai'

type ProfileSnapshot = {
  role: 'super_admin' | 'admin' | 'member'
  clinicId: string | null
  needsClinicOnboarding?: boolean
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [calls, setCalls] = useState<Call[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [sequences, setSequences] = useState<ProactiveSequence[]>([])
  const [callbackTasks, setCallbackTasks] = useState<CallbackTask[]>([])
  const [scheduledCheckIns, setScheduledCheckIns] = useState<ScheduledCheckIn[]>([])
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([])
  const [agentConfig, setAgentConfig] = useState<AgentConfig>(initialState.agentConfig)
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [isHydrated, setIsHydrated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const isHydratedRef = useRef(false)
  isHydratedRef.current = isHydrated
  const [profile, setProfileState] = useState<ProfileSnapshot | null>(null)

  const setProfile = useCallback(
    (next: ProfileSnapshot | null) => {
      if (next === null) {
        setProfileState(null)
        return
      }
      setProfileState((prev) => ({
        role: next.role,
        clinicId: next.clinicId,
        needsClinicOnboarding:
          next.needsClinicOnboarding !== undefined
            ? next.needsClinicOnboarding
            : (prev?.needsClinicOnboarding ?? false),
      }))
    },
    []
  )
  const [sessionAccount, setSessionAccount] = useState<{
    email: string
    fullName: string | null
    role: 'super_admin' | 'admin' | 'member'
  } | null>(null)
  const [viewAs, setViewAsState] = useState<{ userId: string; displayName: string } | null>(null)
  const realProfileRef = useRef<ProfileSnapshot | null>(null)
  const viewAsRef = useRef<typeof viewAs>(null)
  viewAsRef.current = viewAs
  const profileRef = useRef<typeof profile>(null)
  profileRef.current = profile

  const setViewAs = useCallback((v: { userId: string; displayName: string } | null) => {
    setViewAsState(v)
  }, [])

  // Use ref to prevent concurrent executions of checkDueItems
  const isProcessingRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

  // NEXT_PUBLIC_* are baked in at build time; missing values → login hits the wrong project or a placeholder.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!hasRealSupabaseConfig()) {
      console.error(
        '[Vocalis] Supabase URL/key missing or invalid in this deployment. In Vercel set NEXT_PUBLIC_SUPABASE_URL (https://…supabase.co) and NEXT_PUBLIC_SUPABASE_ANON_KEY (or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY) for Production and Preview, then redeploy.',
      )
    }
  }, [])

  // Next.js / Turbopack / Link prefetch often abort in-flight fetch; avoid noisy runtime overlay.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isLikelyAbortError(event.reason)) {
        event.preventDefault()
      }
    }
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => window.removeEventListener('unhandledrejection', onUnhandledRejection)
  }, [])

  /** Last-resort unlock if anything above fails to flip `isHydrated` (Strict Mode + async race, throttled timers, etc.). */
  useEffect(() => {
    const ABSOLUTE_MAX_MS = 32_000
    const t = window.setTimeout(() => {
      if (!isHydratedRef.current) {
        console.warn(
          '[Vocalis] Auth UI still locked after deadline — forcing hydrate. If you are signed in but see the login screen, refresh once.',
        )
        setIsHydrated(true)
        setIsLoading(false)
      }
    }, ABSOLUTE_MAX_MS)
    return () => window.clearTimeout(t)
  }, [])

  // Check Supabase session on mount
  useEffect(() => {
    let bootstrapFinished = false
    /**
     * Bound only `getSession()` — not the whole bootstrap. A hung `getSession()` still needs a ceiling.
     * `finishBootstrap` must not consult an effect `cancelled` flag: Strict Mode runs cleanup before the
     * first async `checkSession` completes, which would skip `setIsHydrated(true)` and trap the UI on "Loading…".
     */
    const GET_SESSION_TIMEOUT_MS = 28_000

    const finishBootstrap = () => {
      if (bootstrapFinished) return
      bootstrapFinished = true
      setIsHydrated(true)
      setIsLoading(false)
    }

    const checkSession = async () => {
      try {
        const sessionOutcome = await Promise.race([
          supabase.auth.getSession().then((result) => ({ kind: 'ok' as const, result })),
          new Promise<{ kind: 'timeout' }>((resolve) =>
            setTimeout(() => resolve({ kind: 'timeout' }), GET_SESSION_TIMEOUT_MS),
          ),
        ])

        if (sessionOutcome.kind === 'timeout') {
          // Rare: stalled storage, extension, or network. Unblock UI as signed-out; onAuthStateChange may still recover.
          console.info(
            '[Vocalis] Session check exceeded time limit — showing signed-out state. Refresh or clear site data if you should be signed in.',
          )
          setIsLoggedIn(false)
          return
        }

        const { data: { session }, error } = sessionOutcome.result

        if (error && isRefreshTokenAuthError(error)) {
          console.warn('Session refresh failed; clearing local session:', error.message)
          await clearLocalSupabaseSession()
          setIsLoggedIn(false)
          return
        }

        if (session?.user) {
          userIdRef.current = session.user.id
          setIsLoggedIn(true)
          // Do not await: loadInitialData can hang on slow/stuck API or network; that would block
          // `finally` and leave isHydrated false → perpetual full-page "Loading..." in AppShell.
          void loadInitialData(session.user.id).catch((e: unknown) => {
            if (!isLikelyAbortError(e)) console.error('loadInitialData (bootstrap):', e)
          })
        } else {
          setIsLoggedIn(false)
        }
      } catch (error: unknown) {
        if (isLikelyAbortError(error)) {
          // Prefetch / navigation / Strict Mode — ignore
        } else {
          console.error('Error checking session:', error)
          if (isRefreshTokenAuthError(error)) {
            await clearLocalSupabaseSession()
          }
          setIsLoggedIn(false)
        }
      } finally {
        finishBootstrap()
      }
    }

    void checkSession().catch((e: unknown) => {
      if (!isLikelyAbortError(e)) console.error('checkSession:', e)
      finishBootstrap()
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id
        setIsLoggedIn(true)
        try {
          await loadInitialData(session.user.id)
        } catch (e: unknown) {
          if (!isLikelyAbortError(e)) console.error('loadInitialData after sign-in:', e)
        }
      } else if (event === 'SIGNED_OUT') {
        userIdRef.current = null
        setIsLoggedIn(false)
        setProfile(null)
        setSessionAccount(null)
        // Clear all data
        setCalls([])
        setPatients([])
        setSequences([])
        setCallbackTasks([])
        setScheduledCheckIns([])
        setActivityEvents([])
        setAgentConfig(initialState.agentConfig)
      } else if (event === 'TOKEN_REFRESHED') {
        // Token refreshed successfully, no action needed
        // Don't reload data on token refresh to avoid unnecessary lag
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  // Load initial data from Supabase
  const loadInitialData = async (userId: string) => {
    try {
      setIsLoading(true)

      // Load profile first (role, clinic_id) for Team and access control.
      // Prefer API route (service role) so we don't depend on RLS / client session.
      let role: 'super_admin' | 'admin' | 'member' | null = null
      let clinicId: string | null = null
      let sessionAcc: {
        email: string
        fullName: string | null
        role: 'super_admin' | 'admin' | 'member'
      } | null = null
      let onboardingFromApi: boolean | null = null

      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (token) {
        try {
          const res = await fetchWithTimeout('/api/profile', {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (res.ok) {
            const data = (await res.json()) as {
              role?: string
              clinicId?: string | null
              email?: string | null
              fullName?: string | null
              needsClinicOnboarding?: boolean
            }
            if (typeof data.needsClinicOnboarding === 'boolean') {
              onboardingFromApi = data.needsClinicOnboarding
            }
            if (data.role === 'super_admin' || data.role === 'admin' || data.role === 'member') {
              role = data.role
              clinicId = data.clinicId ?? null
            }
            if (
              typeof data.email === 'string' &&
              data.email &&
              (data.role === 'super_admin' || data.role === 'admin' || data.role === 'member')
            ) {
              sessionAcc = {
                email: data.email,
                fullName: data.fullName ?? null,
                role: data.role as 'super_admin' | 'admin' | 'member',
              }
            }
          }
        } catch (_) {
          // Fall through to direct Supabase fetch
        }
      }
      if (role === null) {
        const { data: profileRow, error: profileError } = await supabase
          .from('profiles')
          .select('role, clinic_id, email, full_name')
          .eq('id', userId)
          .single()
        if (!profileError && profileRow) {
          const r = profileRow as {
            role: string
            clinic_id?: string | null
            email?: string
            full_name?: string | null
          }
          if (r.role === 'super_admin' || r.role === 'admin' || r.role === 'member') {
            role = r.role as 'super_admin' | 'admin' | 'member'
            clinicId = r.clinic_id ?? null
            if (r.email) {
              sessionAcc = {
                email: r.email,
                fullName: r.full_name ?? null,
                role,
              }
            }
          }
        } else {
          if (profileError) {
            console.warn('[Profile] Failed to load profile:', profileError.message, profileError.code)
          }
          const { data: roleRow } = await supabase
            .from('profiles')
            .select('role, email, full_name')
            .eq('id', userId)
            .single()
          const r = roleRow as {
            role: string
            email?: string
            full_name?: string | null
          } | null
          if (r && (r.role === 'super_admin' || r.role === 'admin' || r.role === 'member')) {
            role = r.role as 'super_admin' | 'admin' | 'member'
            if (r.email) {
              sessionAcc = {
                email: r.email,
                fullName: r.full_name ?? null,
                role,
              }
            }
          }
        }
      }

      if (role && !sessionAcc && session?.user?.email) {
        const meta = session.user.user_metadata as { full_name?: string } | undefined
        sessionAcc = {
          email: session.user.email,
          fullName: typeof meta?.full_name === 'string' ? meta.full_name : null,
          role,
        }
      }

      let needsClinicOnboarding = false
      if (role && role !== 'super_admin' && clinicId) {
        if (onboardingFromApi !== null) {
          needsClinicOnboarding = onboardingFromApi
        } else {
          const { data: cr } = await supabase
            .from('clinics')
            .select('settings')
            .eq('id', clinicId)
            .maybeSingle()
          needsClinicOnboarding = clinicOnboardingIncomplete(
            (cr as { settings?: unknown } | null)?.settings
          )
        }
      }

      if (role) {
        const profileValue: ProfileSnapshot = { role, clinicId, needsClinicOnboarding }
        setProfileState(profileValue)
        realProfileRef.current = profileValue
        setSessionAccount(sessionAcc)
      } else {
        setProfileState(null)
        realProfileRef.current = null
        setSessionAccount(null)
      }

      // Load critical data first (calls, patients) to show UI quickly
      // Then load less critical data in parallel
      const [patientsData, callsData] = await Promise.all([
        dbPatients.getPatients(supabase, userId).catch(() => []),
        dbCalls.listCallsForSession(supabase, 200).catch(() => []),
      ])

      // Set critical data immediately so UI can render
      setPatients(patientsData)
      setCalls(callsData)
      setIsLoading(false) // Allow UI to render while loading other data

      // Prefer GET /api/clinic/settings so server can heal display phone + outbound agent id from the ConvAI line.
      const clinicSettingsPromise =
        clinicId && token
          ? fetchWithTimeout('/api/clinic/settings', { headers: { Authorization: `Bearer ${token}` } })
              .then(async (res) => {
                if (!res.ok) return null
                const j = (await res.json()) as { agentConfig?: AgentConfig | null }
                return j.agentConfig ?? null
              })
              .catch(() => null)
          : clinicId
            ? supabase
                .from('clinics')
                .select('settings')
                .eq('id', clinicId)
                .single()
                .then(
                  ({ data }) =>
                    (data as { settings?: { agentConfig?: AgentConfig } } | null)?.settings?.agentConfig ?? null
                )
            : Promise.resolve(null)

      const [sequencesData, tasksData, checkInsData, eventsData, configData, clinicSettingsData] = await Promise.allSettled([
        dbSequences.getSequences(supabase, userId).catch(() => []),
        dbCallbackTasks.getCallbackTasks(supabase, userId).catch(() => []),
        dbScheduledCheckIns.getScheduledCheckIns(supabase, userId).catch(() => []),
        dbActivityEvents.getActivityEvents(supabase, userId, 50).catch(() => []),
        dbAgentConfig.getAgentConfig(supabase, userId).catch(() => null),
        clinicSettingsPromise,
      ])

      // Update state with remaining data
      if (sequencesData.status === 'fulfilled') setSequences(sequencesData.value)
      if (tasksData.status === 'fulfilled') setCallbackTasks(tasksData.value)
      if (checkInsData.status === 'fulfilled') setScheduledCheckIns(checkInsData.value)
      if (eventsData.status === 'fulfilled') setActivityEvents(eventsData.value)
      // Prefer clinic-level agent config (set by super_admin) over user's agent_config
      const clinicAgentConfig =
        clinicSettingsData.status === 'fulfilled' && clinicSettingsData.value ? clinicSettingsData.value : null
      if (clinicAgentConfig) {
        setAgentConfig(clinicAgentConfig)
      } else if (configData.status === 'fulfilled' && configData.value) {
        setAgentConfig(configData.value)
      }
    } catch (error: unknown) {
      if (isLikelyAbortError(error)) {
        setIsLoading(false)
        return
      }
      console.error('Error loading initial data:', error)
      toast.error('Failed to load data', {
        description: 'Please refresh the page',
      })
      setIsLoading(false)
    }
  }

  const loadInitialDataRef = useRef(loadInitialData)
  loadInitialDataRef.current = loadInitialData

  const refetchProfileFromApi = useCallback(async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) return
      const res = await fetchWithTimeout('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return
      const data = (await res.json()) as {
        role?: string
        clinicId?: string | null
        email?: string | null
        fullName?: string | null
        needsClinicOnboarding?: boolean
      }
      if (data.role !== 'super_admin' && data.role !== 'admin' && data.role !== 'member') return
      const profileValue: ProfileSnapshot = {
        role: data.role as 'super_admin' | 'admin' | 'member',
        clinicId: data.clinicId ?? null,
        needsClinicOnboarding: data.needsClinicOnboarding === true,
      }
      setProfileState(profileValue)
      realProfileRef.current = profileValue
      const email = typeof data.email === 'string' ? data.email.trim() : ''
      if (email) {
        setSessionAccount((prev) =>
          prev
            ? { ...prev, role: profileValue.role }
            : {
                email,
                fullName: data.fullName ?? null,
                role: profileValue.role,
              }
        )
      }
    } catch {
      // ignore
    }
  }, [])

  const clearViewAs = useCallback(async () => {
    setViewAsState(null)
    const uid = userIdRef.current
    if (uid) {
      await loadInitialDataRef.current(uid)
    }
  }, [])

  // When clinic_id / role is updated in the DB (e.g. super admin assigned a clinic), refresh the
  // in-memory profile without requiring a full page reload. Skip while impersonating via view-as.
  useEffect(() => {
    if (!isLoggedIn || !userIdRef.current) return
    const uid = userIdRef.current
    const channel = supabase
      .channel(`profiles-self-${uid}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${uid}`,
        },
        () => {
          if (viewAsRef.current) return
          void refetchProfileFromApi()
        }
      )
      .subscribe()
    return () => {
      void supabase.removeChannel(channel)
    }
  }, [isLoggedIn, refetchProfileFromApi])

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (viewAsRef.current) return
      const p = profileRef.current
      if (p?.role === 'super_admin') return
      if (p && !p.clinicId) void refetchProfileFromApi()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [refetchProfileFromApi])

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userIdRef.current) return

    const userId = userIdRef.current
    const clinicId = profile?.clinicId ?? null

    const handleCallPayload = (payload: {
      eventType: string
      new: Record<string, unknown>
      old: { id?: string }
    }) => {
      if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
        try {
          const callRow = payload.new as unknown as Parameters<typeof dbUtils.dbCallToApp>[0]
          const call = dbUtils.dbCallToApp(callRow)

          if (call) {
            setCalls((prev) => {
              const existing = prev.find((c) => c.id === call.id)
              if (existing) {
                const hasChanges =
                  existing.timestamp.getTime() !== call.timestamp.getTime() ||
                  existing.status !== call.status ||
                  existing.outcome !== call.outcome ||
                  existing.transcript !== call.transcript ||
                  JSON.stringify(existing.summary) !== JSON.stringify(call.summary) ||
                  existing.aiProcessingStatus !== call.aiProcessingStatus ||
                  existing.aiBriefSummary !== call.aiBriefSummary ||
                  existing.aiResponseUrgency !== call.aiResponseUrgency ||
                  existing.aiBusinessValue !== call.aiBusinessValue ||
                  JSON.stringify(existing.aiTags) !== JSON.stringify(call.aiTags) ||
                  existing.callDirection !== call.callDirection

                if (hasChanges) {
                  return prev.map((c) => (c.id === call.id ? call : c))
                }
                return prev
              }
              return [call, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            })
          }
        } catch (error) {
          console.error('Error processing call update from real-time:', error)
        }
      } else if (payload.eventType === 'DELETE') {
        setCalls((prev) => prev.filter((c) => c.id !== payload.old.id))
      }
    }

    const callsChannel = supabase
      .channel(`calls-changes-${userId}${clinicId ? `-${clinicId}` : ''}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `user_id=eq.${userId}`,
        },
        handleCallPayload
      )

    if (clinicId) {
      callsChannel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'calls',
          filter: `clinic_id=eq.${clinicId}`,
        },
        handleCallPayload
      )
    }

    callsChannel.subscribe()

    // Subscribe to patients
    const patientsSubscription = supabase
      .channel('patients-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // Use payload data directly to avoid database query lag
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          try {
            const patientRow = payload.new as any
            const patient = dbUtils.dbPatientToApp(patientRow)
            
            if (patient) {
              setPatients((prev) => {
                const existing = prev.find(p => p.id === patient.id)
                if (existing) {
                  return prev.map(p => p.id === patient.id ? patient : p)
                }
                return [patient, ...prev]
              })
            }
          } catch (error) {
            console.error('Error processing patient update from real-time:', error)
          }
        } else if (payload.eventType === 'DELETE') {
          setPatients((prev) => prev.filter(p => p.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to sequences
    const sequencesSubscription = supabase
      .channel('sequences-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'proactive_sequences',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        // Use payload data directly to avoid database query lag
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          try {
            const sequenceRow = payload.new as any
            const sequence = dbUtils.dbSequenceToApp(sequenceRow)
            
            if (sequence) {
              setSequences((prev) => {
                const existing = prev.find(s => s.id === sequence.id)
                if (existing) {
                  return prev.map(s => s.id === sequence.id ? sequence : s)
                }
                return [sequence, ...prev]
              })
            }
          } catch (error) {
            console.error('Error processing sequence update from real-time:', error)
          }
        } else if (payload.eventType === 'DELETE') {
          setSequences((prev) => prev.filter(s => s.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to callback tasks
    const tasksSubscription = supabase
      .channel('tasks-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'callback_tasks',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const task = await dbCallbackTasks.getCallbackTask(supabase, payload.new.id as string, userId)
          if (task) {
            setCallbackTasks((prev) => {
              const existing = prev.find(t => t.id === task.id)
              if (existing) {
                return prev.map(t => t.id === task.id ? task : t)
              }
              return [task, ...prev]
            })
          }
        } else if (payload.eventType === 'DELETE') {
          setCallbackTasks((prev) => prev.filter(t => t.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to scheduled check-ins
    const checkInsSubscription = supabase
      .channel('checkins-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'scheduled_check_ins',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const checkIn = await dbScheduledCheckIns.getScheduledCheckIn(supabase, payload.new.id as string, userId)
          if (checkIn) {
            setScheduledCheckIns((prev) => {
              const existing = prev.find(ci => ci.id === checkIn.id)
              if (existing) {
                return prev.map(ci => ci.id === checkIn.id ? checkIn : ci)
              }
              return [...prev, checkIn]
            })
          }
        } else if (payload.eventType === 'DELETE') {
          setScheduledCheckIns((prev) => prev.filter(ci => ci.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to activity events
    const eventsSubscription = supabase
      .channel('events-changes')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'activity_events',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        const event = await dbActivityEvents.getActivityEvents(supabase, userId, 1)
        if (event.length > 0) {
          setActivityEvents((prev) => {
            const existing = prev.find(e => e.id === event[0].id)
            if (existing) return prev
            return [event[0], ...prev]
          })
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(callsChannel)
      patientsSubscription.unsubscribe()
      sequencesSubscription.unsubscribe()
      tasksSubscription.unsubscribe()
      checkInsSubscription.unsubscribe()
      eventsSubscription.unsubscribe()
    }
  }, [isLoggedIn, profile?.clinicId])

  // Normalize phone number for matching using the shared utility
  const normalizePhone = (phone: string): string => {
    return normalizePhoneNumber(phone)
  }

  // Match call to patient by phone number
  const matchCallToPatient = (call: Call): Call => {
    if (call.patientId) {
      return call
    }

    const callPhone = normalizePhone(call.phone)
    const matchedPatient = patients.find((patient) => {
      const patientPhone = normalizePhone(patient.phone)
      return patientPhone === callPhone
    })

    if (matchedPatient) {
      return {
        ...call,
        patientId: matchedPatient.id,
      }
    }

    return call
  }

  // Persist login state
  const handleSetIsLoggedIn = async (value: boolean) => {
    if (!value) {
      await supabase.auth.signOut()
      setIsLoggedIn(false)
      setProfile(null)
      setSessionAccount(null)
      userIdRef.current = null
    }
    // Sign in is handled by login screen
  }

  // Calculate KPI data dynamically from calls
  const kpiData = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    const callsToday = calls.filter(
      (call) => new Date(call.timestamp) >= today
    ).length
    
    const appointmentsBooked = calls.filter(
      (call) => 
        call.intent === 'scheduling' && 
        call.outcome === 'resolved' &&
        new Date(call.timestamp) >= today
    ).length
    
    const escalationsCreated = calls.filter(
      (call) => 
        call.escalated && 
        new Date(call.timestamp) >= today
    ).length
    
    return {
      callsToday,
      missedCallsPrevented: initialState.kpiData.missedCallsPrevented,
      appointmentsBooked,
      proactiveCheckInsCompleted: initialState.kpiData.proactiveCheckInsCompleted,
      escalationsCreated,
    }
  }, [calls])

  // Recalculate scheduled check-ins when patients or sequences change
  useEffect(() => {
    if (!userIdRef.current || isLoading) return

    const userId = userIdRef.current
    const cleared = clearFutureCheckIns(scheduledCheckIns)
    const recalculated = recalculateAllCheckIns(patients, sequences, cleared)
    
    // Only update if there are actual changes
    const prevIds = new Set(scheduledCheckIns.map(ci => ci.id))
    const newIds = new Set(recalculated.map(ci => ci.id))
    
    if (prevIds.size !== newIds.size || 
        ![...prevIds].every(id => newIds.has(id)) ||
        ![...newIds].every(id => prevIds.has(id))) {
      // Save new check-ins to database
      const newCheckIns = recalculated.filter(ci => !prevIds.has(ci.id))
      if (newCheckIns.length > 0) {
        dbScheduledCheckIns.createScheduledCheckIns(supabase, newCheckIns, userId)
          .then((created) => {
            setScheduledCheckIns((prev) => [...prev, ...created])
          })
          .catch(console.error)
      } else {
        setScheduledCheckIns(recalculated)
      }
    }
  }, [patients, sequences, isLoading])

  const store: AppStore = useMemo(
    () => ({
      calls,
      patients,
      sequences,
      callbackTasks,
      scheduledCheckIns,
      activityEvents,
      agentConfig,
      kpiData,
      isLoggedIn,
      profile,
      sessionAccount,
      viewAs,
      setViewAs,
      clearViewAs,
      setCalls,
      addCall: async (call: Call) => {
        if (!userIdRef.current) return
        
        const matchedCall = matchCallToPatient(call)
        
        try {
          const created = await dbCalls.createCall(supabase, matchedCall, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error adding call:', error)
          toast.error('Failed to add call')
        }
      },
      updateCall: async (id: string, updates: Partial<Call>) => {
        if (!userIdRef.current) return
        
        try {
          await dbCalls.updateCall(supabase, id, updates, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error updating call:', error)
          toast.error('Failed to update call')
        }
      },
      setPatients,
      addPatient: async (patient: Patient) => {
        if (!userIdRef.current) {
          throw new Error('User not authenticated')
        }
        
        try {
          const created = await dbPatients.createPatient(supabase, patient, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Patient added', {
            description: `${patient.name} has been added to the directory.`,
          })
          
          // Also add activity event
          await dbActivityEvents.createActivityEvent(supabase, {
            id: `event-${Date.now()}`,
            type: 'new_patient',
            description: `New patient added: ${patient.name}`,
            timestamp: new Date(),
            patientName: patient.name,
            patientId: created.id,
          }, userIdRef.current)
        } catch (error) {
          console.error('Error adding patient:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to add patient'
          toast.error('Failed to add patient', {
            description: errorMessage,
          })
          throw error // Re-throw so the UI can handle it
        }
      },
      updatePatient: async (id: string, updates: Partial<Patient>) => {
        if (!userIdRef.current) return
        
        try {
          await dbPatients.updatePatient(supabase, id, updates, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error updating patient:', error)
          toast.error('Failed to update patient')
        }
      },
      setSequences,
      addSequence: async (sequence: ProactiveSequence) => {
        if (!userIdRef.current) {
          throw new Error('User not authenticated')
        }
        
        try {
          const created = await dbSequences.createSequence(supabase, sequence, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Sequence added', {
            description: `"${sequence.name}" has been created.`,
          })
        } catch (error) {
          console.error('Error adding sequence:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to add sequence'
          toast.error('Failed to add sequence', {
            description: errorMessage,
          })
          throw error
        }
      },
      updateSequence: async (id: string, updates: Partial<ProactiveSequence>) => {
        if (!userIdRef.current) return
        
        try {
          await dbSequences.updateSequence(supabase, id, updates, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error updating sequence:', error)
          toast.error('Failed to update sequence')
        }
      },
      setCallbackTasks,
      addCallbackTask: async (task: CallbackTask) => {
        if (!userIdRef.current) {
          throw new Error('User not authenticated')
        }
        
        try {
          const created = await dbCallbackTasks.createCallbackTask(supabase, task, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Callback task created')
          
          // Also add activity event
          await dbActivityEvents.createActivityEvent(supabase, {
            id: `event-${Date.now()}`,
            type: 'callback',
            description: `Callback task created: ${task.callReason}`,
            timestamp: new Date(),
            patientName: task.patientName,
            patientId: task.patientId,
          }, userIdRef.current)
        } catch (error) {
          console.error('Error adding callback task:', error)
          const errorMessage = error instanceof Error ? error.message : 'Failed to create callback task'
          toast.error('Failed to create callback task', {
            description: errorMessage,
          })
          throw error
        }
      },
      updateCallbackTask: async (id: string, updates: Partial<CallbackTask>) => {
        if (!userIdRef.current) return
        
        try {
          await dbCallbackTasks.updateCallbackTask(supabase, id, updates, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error updating callback task:', error)
          toast.error('Failed to update callback task')
        }
      },
      removeCallbackTask: async (id: string) => {
        if (!userIdRef.current) return
        
        try {
          await dbCallbackTasks.deleteCallbackTask(supabase, id, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Task deleted')
        } catch (error) {
          console.error('Error deleting callback task:', error)
          toast.error('Failed to delete task')
        }
      },
      setScheduledCheckIns: (checkIns: ScheduledCheckIn[]) => {
        setScheduledCheckIns(checkIns)
      },
      addScheduledCheckIn: async (checkIn: ScheduledCheckIn) => {
        if (!userIdRef.current) return
        
        try {
          const created = await dbScheduledCheckIns.createScheduledCheckIn(supabase, checkIn, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error adding scheduled check-in:', error)
          toast.error('Failed to add scheduled check-in')
        }
      },
      updateScheduledCheckIn: async (id: string, updates: Partial<ScheduledCheckIn>) => {
        if (!userIdRef.current) return
        
        try {
          await dbScheduledCheckIns.updateScheduledCheckIn(supabase, id, updates, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error updating scheduled check-in:', error)
          toast.error('Failed to update scheduled check-in')
        }
      },
      clearFutureCheckIns: () => {
        setScheduledCheckIns((prev) => clearFutureCheckIns(prev))
      },
      checkAndProcessDueItems: () => {
        // This is handled automatically by the useEffect polling
        // Left as no-op for API compatibility
      },
      addActivityEvent: async (event: ActivityEvent) => {
        if (!userIdRef.current) return
        
        try {
          await dbActivityEvents.createActivityEvent(supabase, event, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error adding activity event:', error)
        }
      },
      setActivityEvents: (events: ActivityEvent[]) => {
        setActivityEvents(events)
      },
      setAgentConfig: async (config: AgentConfig) => {
        if (!userIdRef.current) return
        
        try {
          await dbAgentConfig.updateAgentConfig(supabase, config, userIdRef.current)
          // Reload config
          const updated = await dbAgentConfig.getAgentConfig(supabase, userIdRef.current)
          if (updated) {
            setAgentConfig(updated)
          }
        } catch (error) {
          console.error('Error updating agent config:', error)
          toast.error('Failed to update agent config')
        }
      },
      setIsLoggedIn: handleSetIsLoggedIn,
      setProfile,
      isHydrated,
    }),
    [calls, patients, sequences, callbackTasks, scheduledCheckIns, activityEvents, agentConfig, kpiData, isLoggedIn, profile, sessionAccount, isHydrated, isLoading, viewAs, setViewAs, clearViewAs]
  )

  // Poll for due tasks and check-ins every minute and trigger calls
  useEffect(() => {
    if (!userIdRef.current || isLoading) return

    const checkDueItems = async () => {
      if (isProcessingRef.current) {
        return
      }
      
      isProcessingRef.current = true
      
      try {
        const dueTasks = getDueCallbackTasks(callbackTasks)
        const dueCheckIns = getDueScheduledCheckIns(scheduledCheckIns)

        const outboundAgentId = agentConfig.elevenLabsOutboundAgentId || agentConfig.elevenLabsAgentId
        if (!outboundAgentId || !agentConfig.elevenLabsPhoneNumberId) {
          if (dueTasks.length > 0 || dueCheckIns.length > 0) {
            console.warn('Eleven Labs outbound agent not configured. Cannot trigger calls.')
          }
          return
        }

        // Process due callback tasks
        for (const task of dueTasks) {
          const hasAnswered = task.attempts.some(a => a.outcome === 'answered')
          if (hasAnswered) continue // Skip if already answered

          console.log(`Triggering callback call for ${task.patientName} (${task.phone})`)
          
          const dynamicVars: CallDynamicVariables = {
            patient_name: task.patientName,
            clinic_name: agentConfig.clinicName,
            call_reason: task.callReason,
            call_goal: task.callGoal,
          }

          const result = await triggerOutboundCall(
            task.phone,
            outboundAgentId!,
            agentConfig.elevenLabsPhoneNumberId!,
            dynamicVars
          )

          if (result.success && userIdRef.current) {
            // Update task with conversation_id
            await dbCallbackTasks.updateCallbackTask(
              supabase,
              task.id,
              { conversationId: result.conversation_id },
              userIdRef.current
            )

            // Add activity event
            await dbActivityEvents.createActivityEvent(
              supabase,
              {
                id: `event-${Date.now()}`,
                type: 'callback',
                description: `Callback call initiated for ${task.patientName}`,
                timestamp: new Date(),
                patientName: task.patientName,
                patientId: task.patientId,
              },
              userIdRef.current
            )
          }
        }

        // Process due check-ins
        for (const checkIn of dueCheckIns) {
          if (checkIn.channel === 'call' && checkIn.status === 'scheduled') {
            console.log(`Triggering check-in call for ${checkIn.patientName} - ${checkIn.goal}`)
            
            const dynamicVars: CallDynamicVariables = {
              patient_name: checkIn.patientName,
              clinic_name: agentConfig.clinicName,
              call_reason: checkIn.goal || 'Proactive check-in',
              call_goal: checkIn.goal || 'Follow up on hearing aid usage',
            }

            const result = await triggerOutboundCall(
              checkIn.phone,
              outboundAgentId!,
              agentConfig.elevenLabsPhoneNumberId!,
              dynamicVars
            )

            if (result.success && userIdRef.current) {
              // Update check-in with conversation_id
              await dbScheduledCheckIns.updateScheduledCheckIn(
                supabase,
                checkIn.id,
                {
                  status: 'in_progress',
                  triggeredAt: new Date(),
                  conversationId: result.conversation_id,
                },
                userIdRef.current
              )

              // Add activity event
              await dbActivityEvents.createActivityEvent(
                supabase,
                {
                  id: `event-${Date.now()}`,
                  type: 'checkin',
                  description: `Proactive check-in call initiated: ${checkIn.goal}`,
                  timestamp: new Date(),
                  patientName: checkIn.patientName,
                  patientId: checkIn.patientId,
                },
                userIdRef.current
              )
            }
          }
        }
      } catch (error) {
        console.error('Error checking due items:', error)
      } finally {
        isProcessingRef.current = false
      }
    }

    checkDueItems()
    const interval = setInterval(checkDueItems, 60000)

    return () => {
      clearInterval(interval)
      isProcessingRef.current = false
    }
  }, [callbackTasks, scheduledCheckIns, agentConfig, isLoading])

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>
}
