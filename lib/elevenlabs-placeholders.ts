import { defaultAgentConfig } from '@/lib/data'
import type { AgentConfig } from '@/lib/types'

/** Demo / seed agent IDs in `defaultAgentConfig` — not agents in your ElevenLabs workspace. */
const PLACEHOLDER_AGENT_IDS = new Set(
  [defaultAgentConfig.elevenLabsAgentId, defaultAgentConfig.elevenLabsOutboundAgentId].filter(
    (id): id is string => typeof id === 'string' && id.trim().length > 0
  )
)

/** Demo / seed IDs in `defaultAgentConfig` are not real provisioned agents — replace on onboarding. */
export function isPlaceholderOrMissingElevenLabsAgentId(id: string | undefined | null): boolean {
  const t = typeof id === 'string' ? id.trim() : ''
  if (!t) return true
  return PLACEHOLDER_AGENT_IDS.has(t)
}

/**
 * Inbound + outbound agent IDs to PATCH for prompt sync, excluding demo IDs (so Push to phone line
 * does not call ElevenLabs with template IDs from `defaultAgentConfig`).
 */
export function getElevenLabsSyncTargets(agentConfig: AgentConfig | null | undefined): {
  targets: string[]
  skippedDemoIds: string[]
} {
  const inbound = agentConfig?.elevenLabsAgentId?.trim() || ''
  const outbound = (agentConfig?.elevenLabsOutboundAgentId?.trim() || inbound) || ''
  const raw = [...new Set([inbound, outbound].filter(Boolean))]
  const skippedDemoIds = raw.filter((id) => isPlaceholderOrMissingElevenLabsAgentId(id))
  const targets = raw.filter((id) => !isPlaceholderOrMissingElevenLabsAgentId(id))
  return { targets, skippedDemoIds }
}
