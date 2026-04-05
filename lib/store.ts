'use client'

import { createContext, useContext } from 'react'
import {
  Call,
  Patient,
  ProactiveSequence,
  CallbackTask,
  ActivityEvent,
  AgentConfig,
  KPIData,
  ScheduledCheckIn,
  type ProfileRole,
} from './types'
import {
  mockCalls,
  mockPatients,
  mockProactiveSequences,
  mockCallbackTasks,
  mockActivityEvents,
  defaultAgentConfig,
  mockKPIData,
} from './data'

export interface AppState {
  calls: Call[]
  patients: Patient[]
  sequences: ProactiveSequence[]
  callbackTasks: CallbackTask[]
  scheduledCheckIns: ScheduledCheckIn[]
  activityEvents: ActivityEvent[]
  agentConfig: AgentConfig
  kpiData: KPIData
  isLoggedIn: boolean
  isHydrated: boolean
  /**
   * Current user's profile (role + clinic). Loaded when logged in; may be swapped during super_admin view-as.
   * `needsClinicOnboarding` is true when the clinic was created with the setup wizard pending (admins/members only).
   */
  profile: { role: ProfileRole; clinicId: string | null; needsClinicOnboarding?: boolean } | null
  /** Signed-in user for shell (header): name, email, real role — not swapped during view-as. */
  sessionAccount: { email: string; fullName: string | null; role: ProfileRole } | null
  /** When set, UI and data reflect this user (super_admin "view as" mode). */
  viewAs: { userId: string; displayName: string } | null
}

export interface AppActions {
  setCalls: (calls: Call[]) => void
  addCall: (call: Call) => void
  updateCall: (id: string, updates: Partial<Call>) => void
  setPatients: (patients: Patient[]) => void
  addPatient: (patient: Patient) => void
  updatePatient: (id: string, updates: Partial<Patient>) => void
  setSequences: (sequences: ProactiveSequence[]) => void
  addSequence: (sequence: ProactiveSequence) => void
  updateSequence: (id: string, updates: Partial<ProactiveSequence>) => void
  setCallbackTasks: (tasks: CallbackTask[]) => void
  addCallbackTask: (task: CallbackTask) => void
  updateCallbackTask: (id: string, updates: Partial<CallbackTask>) => void
  removeCallbackTask: (id: string) => void
  setScheduledCheckIns: (checkIns: ScheduledCheckIn[]) => void
  addScheduledCheckIn: (checkIn: ScheduledCheckIn) => void
  updateScheduledCheckIn: (id: string, updates: Partial<ScheduledCheckIn>) => void
  clearFutureCheckIns: () => void
  checkAndProcessDueItems: () => void
  addActivityEvent: (event: ActivityEvent) => void
  setActivityEvents: (events: ActivityEvent[]) => void
  setAgentConfig: (config: AgentConfig) => void
  setIsLoggedIn: (value: boolean) => void
  setProfile: (
    profile: { role: ProfileRole; clinicId: string | null; needsClinicOnboarding?: boolean } | null
  ) => void
  setViewAs: (viewAs: { userId: string; displayName: string } | null) => void
  clearViewAs: () => void | Promise<void>
}

export type AppStore = AppState & AppActions

export const initialState: AppState = {
  calls: mockCalls,
  patients: mockPatients,
  sequences: mockProactiveSequences,
  callbackTasks: mockCallbackTasks,
  scheduledCheckIns: [],
  activityEvents: mockActivityEvents,
  agentConfig: defaultAgentConfig,
  kpiData: mockKPIData,
  isLoggedIn: false,
  isHydrated: false,
  profile: null,
  sessionAccount: null,
  viewAs: null,
}

export const AppContext = createContext<AppStore | null>(null)

export function useAppStore() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppStore must be used within AppProvider')
  }
  return context
}
