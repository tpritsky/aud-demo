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
  bootstrapAgentConfig,
  zeroKpiData,
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
  /** First session probe finished (page load or cold start). */
  authSessionChecked: boolean
  /** Running gated bootstrap after sign-in / session restore (required API checks). */
  authVerifying: boolean
  /** Cold bootstrap exceeded the app’s startup time budget (see lib/auth/bootstrap-budget.ts). */
  authBootstrapError: string | null
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
  /** Clear error and re-run session + gate (same as first load). */
  retrySessionBootstrap: () => void
}

export type AppStore = AppState & AppActions

export const initialState: AppState = {
  calls: [],
  patients: [],
  sequences: [],
  callbackTasks: [],
  scheduledCheckIns: [],
  activityEvents: [],
  agentConfig: bootstrapAgentConfig,
  kpiData: zeroKpiData,
  isLoggedIn: false,
  authSessionChecked: false,
  authVerifying: false,
  authBootstrapError: null,
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
