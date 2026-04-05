import type { ReceptionistNavKey } from '@/components/settings/receptionist-call-setup'

export type AgentWorkspaceKey = 'agent-settings' | ReceptionistNavKey

/** URL path segment under `/settings/agent/[section]` */
export const AGENT_SECTION_SLUGS: AgentWorkspaceKey[] = [
  'agent-settings',
  'business',
  'knowledge',
  'questions',
  'transfer',
  'texts',
  'scheduling',
  'notifications',
  'extras',
]

export function isAgentSectionSlug(s: string): s is AgentWorkspaceKey {
  return (AGENT_SECTION_SLUGS as string[]).includes(s)
}

export function slugFromAgentSection(key: AgentWorkspaceKey): string {
  return key
}

export const DEFAULT_AGENT_SECTION: AgentWorkspaceKey = 'agent-settings'

export const AGENT_SUBNAV_LABELS: Record<AgentWorkspaceKey, string> = {
  'agent-settings': 'Agent settings',
  business: 'Business type',
  knowledge: 'Knowledge',
  questions: 'Ask questions',
  transfer: 'Transfer calls',
  texts: 'Text & email',
  scheduling: 'Scheduling',
  notifications: 'Notifications',
  extras: 'Extra notes',
}
