import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeCallAiSettings, normalizeVertical, parseClinicSettingsBlob } from '@/lib/clinic-call-ai'
import { getElevenLabsSyncTargets } from '@/lib/elevenlabs-placeholders'
import { syncElevenLabsAgentPrompt } from '@/lib/server/elevenlabs-prompt-sync'
import type { ClinicVertical } from '@/lib/types'

export type ElevenLabsSyncPatchResult = { agentId: string; ok: boolean; error?: string }

export type RunClinicElevenLabsResult =
  | {
      ran: true
      results: ElevenLabsSyncPatchResult[]
    }
  | {
      ran: false
      results: ElevenLabsSyncPatchResult[]
      skipReason:
        | 'no_api_key'
        | 'clinic_not_found'
        | 'no_agent_ids'
        | 'demo_or_missing_agent_ids'
      /** Present when `skipReason` is `demo_or_missing_agent_ids` */
      skippedDemoIds: string[]
    }

/**
 * Push managed prompt + `send_follow_up_now` tool to all real ConvAI agent IDs for a clinic.
 * Used by `POST /api/clinic/sync-elevenlabs` and after settings PATCH (auto-sync).
 */
export async function runClinicElevenLabsPromptSync(opts: {
  supabase: SupabaseClient
  clinicId: string
}): Promise<RunClinicElevenLabsResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim()
  if (!apiKey) {
    return { ran: false, results: [], skipReason: 'no_api_key', skippedDemoIds: [] }
  }

  const { data, error } = await opts.supabase
    .from('clinics')
    .select('vertical, settings')
    .eq('id', opts.clinicId)
    .maybeSingle()
  if (error || !data) {
    return { ran: false, results: [], skipReason: 'clinic_not_found', skippedDemoIds: [] }
  }

  const vertical = normalizeVertical((data as { vertical?: string }).vertical)
  const { agentConfig, callAi: partialAi } = parseClinicSettingsBlob((data as { settings?: unknown }).settings)
  const callAi = mergeCallAiSettings(vertical, partialAi)
  const { targets, skippedDemoIds } = getElevenLabsSyncTargets(agentConfig ?? null)
  if (targets.length === 0) {
    return {
      ran: false,
      results: [],
      skipReason: skippedDemoIds.length > 0 ? 'demo_or_missing_agent_ids' : 'no_agent_ids',
      skippedDemoIds,
    }
  }

  const results: ElevenLabsSyncPatchResult[] = []
  for (const agentId of targets) {
    const r = await syncElevenLabsAgentPrompt({
      agentId,
      apiKey,
      vertical: vertical as ClinicVertical,
      callAi,
      speechSpeed: agentConfig?.speechSpeed,
    })
    results.push(r.ok ? { agentId, ok: true } : { agentId, ok: false, error: r.error })
  }
  return { ran: true, results }
}
