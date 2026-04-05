import { createServerClient } from '@/lib/supabase/server'
import { postProcessCallTranscript } from '@/lib/ai/call-post-process'
import {
  buildClaudeCallContext,
  mergeCallAiSettings,
  normalizeVertical,
  parseClinicSettingsBlob,
} from '@/lib/clinic-call-ai'

/**
 * Service-role job: load call by id, run Claude, persist AI columns.
 * Uses an atomic claim so concurrent QStash retries / duplicate deliveries don't double-run Claude.
 */
export async function runCallPostProcessJob(callId: string): Promise<void> {
  const supabase = createServerClient()

  const hasKey = Boolean(process.env.CALUDE_CALL_SUMMARY_KEY1 || process.env.ANTHROPIC_API_KEY)
  if (!hasKey) {
    const { data: row } = await supabase
      .from('calls')
      .select('id')
      .eq('id', callId)
      .maybeSingle()
    if (!row) return
    await supabase
      .from('calls')
      .update({
        ai_processing_status: 'skipped',
        ai_error: 'No Anthropic API key configured',
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', callId)
    return
  }

  const { data: claimed, error: claimErr } = await supabase
    .from('calls')
    .update({ ai_processing_status: 'processing', ai_error: null })
    .eq('id', callId)
    .in('ai_processing_status', ['pending', 'failed'])
    .select('id, transcript, clinic_id')
    .maybeSingle()

  if (claimErr) {
    console.error('[runCallPostProcessJob] claim:', claimErr.message)
    return
  }

  if (!claimed) {
    const { data: snap } = await supabase
      .from('calls')
      .select('ai_processing_status')
      .eq('id', callId)
      .maybeSingle()
    const st = (snap as { ai_processing_status?: string } | null)?.ai_processing_status
    if (st === 'completed' || st === 'skipped') return
    if (st === 'processing') return
    return
  }

  const row = claimed as { id: string; transcript: string | null; clinic_id: string | null }

  let clinicName: string | undefined
  let extraClinicContext: string | undefined
  if (row.clinic_id) {
    const { data: clinic } = await supabase
      .from('clinics')
      .select('name, vertical, settings')
      .eq('id', row.clinic_id)
      .maybeSingle()
    if (clinic) {
      const c = clinic as { name?: string; vertical?: string; settings?: unknown }
      clinicName = c.name ?? undefined
      const vertical = normalizeVertical(c.vertical)
      const { callAi: partialAi } = parseClinicSettingsBlob(c.settings)
      const callAi = mergeCallAiSettings(vertical, partialAi)
      extraClinicContext = buildClaudeCallContext({ clinicName, vertical, callAi })
    }
  }

  try {
    const result = await postProcessCallTranscript(row.transcript || '', { clinicName, extraClinicContext })
    await supabase
      .from('calls')
      .update({
        ai_processing_status: 'completed',
        ai_brief_summary: result.brief_summary,
        ai_caller_name: result.caller_name,
        ai_caller_phone: result.caller_phone,
        ai_response_urgency: result.response_urgency,
        ai_business_value: result.business_value,
        ai_tags: result.tags,
        ai_processed_at: new Date().toISOString(),
        ai_error: null,
      })
      .eq('id', callId)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error'
    console.error('[runCallPostProcessJob]', msg)
    await supabase
      .from('calls')
      .update({
        ai_processing_status: 'failed',
        ai_error: msg.slice(0, 2000),
        ai_processed_at: new Date().toISOString(),
      })
      .eq('id', callId)
  }
}
