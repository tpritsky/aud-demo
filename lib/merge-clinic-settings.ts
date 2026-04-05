/**
 * Deep-merge incoming super-admin `settings` patch into existing clinic.settings
 * so partial updates (e.g. only agentConfig) do not wipe callLogSavedViews / callAi.
 */
export function mergeClinicSettingsPayload(
  existingRaw: unknown,
  patchRaw: unknown
): Record<string, unknown> {
  const existing =
    existingRaw && typeof existingRaw === 'object'
      ? { ...(existingRaw as Record<string, unknown>) }
      : {}
  if (!patchRaw || typeof patchRaw !== 'object') return existing

  const patch = patchRaw as Record<string, unknown>
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue
    if (k === 'agentConfig' && v && typeof v === 'object') {
      const prev =
        existing.agentConfig && typeof existing.agentConfig === 'object'
          ? (existing.agentConfig as Record<string, unknown>)
          : {}
      existing.agentConfig = { ...prev, ...(v as Record<string, unknown>) }
    } else if (k === 'callAi' && v && typeof v === 'object') {
      const prev =
        existing.callAi && typeof existing.callAi === 'object'
          ? (existing.callAi as Record<string, unknown>)
          : {}
      existing.callAi = { ...prev, ...(v as Record<string, unknown>) }
    } else if (k === 'callLogSavedViews' && Array.isArray(v)) {
      existing.callLogSavedViews = v
    } else {
      existing[k] = v
    }
  }
  return existing
}
