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
  setAgentConfig: (config: AgentConfig) => void
  setIsLoggedIn: (value: boolean) => void
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
}

export const AppContext = createContext<AppStore | null>(null)

export function useAppStore() {
  const context = useContext(AppContext)
  if (!context) {
    throw new Error('useAppStore must be used within AppProvider')
  }
  return context
}
