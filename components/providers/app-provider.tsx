'use client'

import { useState, useMemo, useEffect, useRef, ReactNode } from 'react'
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
import * as dbPatients from '@/lib/db/patients'
import * as dbCalls from '@/lib/db/calls'
import * as dbSequences from '@/lib/db/sequences'
import * as dbCallbackTasks from '@/lib/db/callback-tasks'
import * as dbScheduledCheckIns from '@/lib/db/scheduled-checkins'
import * as dbActivityEvents from '@/lib/db/activity-events'
import * as dbAgentConfig from '@/lib/db/agent-config'
import { toast } from 'sonner'

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
  
  // Use ref to prevent concurrent executions of checkDueItems
  const isProcessingRef = useRef(false)
  const userIdRef = useRef<string | null>(null)

  // Check Supabase session on mount
  useEffect(() => {
    const checkSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          userIdRef.current = session.user.id
          setIsLoggedIn(true)
          await loadInitialData(session.user.id)
        } else {
          setIsLoggedIn(false)
        }
      } catch (error) {
        console.error('Error checking session:', error)
        setIsLoggedIn(false)
      } finally {
        setIsHydrated(true)
        setIsLoading(false)
      }
    }

    checkSession()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id
        setIsLoggedIn(true)
        await loadInitialData(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        userIdRef.current = null
        setIsLoggedIn(false)
        // Clear all data
        setCalls([])
        setPatients([])
        setSequences([])
        setCallbackTasks([])
        setScheduledCheckIns([])
        setActivityEvents([])
        setAgentConfig(initialState.agentConfig)
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
      
      // Load all data in parallel
      const [patientsData, callsData, sequencesData, tasksData, checkInsData, eventsData, configData] = await Promise.all([
        dbPatients.getPatients(supabase, userId).catch(() => []),
        dbCalls.getCalls(supabase, userId, 100).catch(() => []),
        dbSequences.getSequences(supabase, userId).catch(() => []),
        dbCallbackTasks.getCallbackTasks(supabase, userId).catch(() => []),
        dbScheduledCheckIns.getScheduledCheckIns(supabase, userId).catch(() => []),
        dbActivityEvents.getActivityEvents(supabase, userId, 50).catch(() => []),
        dbAgentConfig.getAgentConfig(supabase, userId).catch(() => null),
      ])

      setPatients(patientsData)
      setCalls(callsData)
      setSequences(sequencesData)
      setCallbackTasks(tasksData)
      setScheduledCheckIns(checkInsData)
      setActivityEvents(eventsData)
      if (configData) {
        setAgentConfig(configData)
      }
    } catch (error) {
      console.error('Error loading initial data:', error)
      toast.error('Failed to load data', {
        description: 'Please refresh the page',
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Set up real-time subscriptions
  useEffect(() => {
    if (!userIdRef.current) return

    const userId = userIdRef.current

    // Subscribe to calls
    const callsSubscription = supabase
      .channel('calls-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'calls',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const call = await dbCalls.getCall(supabase, payload.new.id as string, userId)
          if (call) {
            setCalls((prev) => {
              const existing = prev.find(c => c.id === call.id)
              if (existing) {
                return prev.map(c => c.id === call.id ? call : c)
              }
              return [call, ...prev].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
            })
          }
        } else if (payload.eventType === 'DELETE') {
          setCalls((prev) => prev.filter(c => c.id !== payload.old.id))
        }
      })
      .subscribe()

    // Subscribe to patients
    const patientsSubscription = supabase
      .channel('patients-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'patients',
        filter: `user_id=eq.${userId}`,
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const patient = await dbPatients.getPatient(supabase, payload.new.id as string, userId)
          if (patient) {
            setPatients((prev) => {
              const existing = prev.find(p => p.id === patient.id)
              if (existing) {
                return prev.map(p => p.id === patient.id ? patient : p)
              }
              return [patient, ...prev]
            })
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
      }, async (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          const sequence = await dbSequences.getSequence(supabase, payload.new.id as string, userId)
          if (sequence) {
            setSequences((prev) => {
              const existing = prev.find(s => s.id === sequence.id)
              if (existing) {
                return prev.map(s => s.id === sequence.id ? sequence : s)
              }
              return [sequence, ...prev]
            })
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
      callsSubscription.unsubscribe()
      patientsSubscription.unsubscribe()
      sequencesSubscription.unsubscribe()
      tasksSubscription.unsubscribe()
      checkInsSubscription.unsubscribe()
      eventsSubscription.unsubscribe()
    }
  }, [isLoggedIn])

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
        if (!userIdRef.current) return
        
        try {
          const created = await dbPatients.createPatient(supabase, patient, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Patient added')
        } catch (error) {
          console.error('Error adding patient:', error)
          toast.error('Failed to add patient')
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
        if (!userIdRef.current) return
        
        try {
          const created = await dbSequences.createSequence(supabase, sequence, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Sequence added')
        } catch (error) {
          console.error('Error adding sequence:', error)
          toast.error('Failed to add sequence')
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
        if (!userIdRef.current) return
        
        try {
          const created = await dbCallbackTasks.createCallbackTask(supabase, task, userIdRef.current)
          // Real-time subscription will update state
          toast.success('Callback task created')
        } catch (error) {
          console.error('Error adding callback task:', error)
          toast.error('Failed to create callback task')
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
      addActivityEvent: async (event: ActivityEvent) => {
        if (!userIdRef.current) return
        
        try {
          await dbActivityEvents.createActivityEvent(supabase, event, userIdRef.current)
          // Real-time subscription will update state
        } catch (error) {
          console.error('Error adding activity event:', error)
        }
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
      isHydrated,
    }),
    [calls, patients, sequences, callbackTasks, scheduledCheckIns, activityEvents, agentConfig, kpiData, isLoggedIn, isHydrated, isLoading]
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
