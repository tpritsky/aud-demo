import type { SupabaseClient } from '@supabase/supabase-js'
import { parseClinicSettingsBlob } from '@/lib/clinic-call-ai'

/**
 * ConvAI `phone_number_id` values already stored on another clinic (not `exceptClinicId`).
 * Used so each line is only assignable to one business at a time.
 */
export async function fetchPhoneNumberIdsTakenByOtherClinics(
  supabase: SupabaseClient,
  exceptClinicId: string | null
): Promise<Set<string>> {
  const { data, error } = await supabase.from('clinics').select('id, settings')
  if (error || !data) return new Set()
  const taken = new Set<string>()
  for (const row of data as { id: string; settings?: unknown }[]) {
    const cid = row.id
    if (exceptClinicId && cid === exceptClinicId) continue
    const { agentConfig } = parseClinicSettingsBlob(row.settings)
    const pid = agentConfig?.elevenLabsPhoneNumberId?.trim()
    if (pid) taken.add(pid)
  }
  return taken
}
