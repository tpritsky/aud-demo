/** Super-admin "view as" uses proxy routes so clinic APIs resolve the target user's clinic, not the admin's JWT. */

export function userClinicSettingsUrl(viewAsUserId: string | null | undefined): string {
  if (viewAsUserId) {
    return `/api/super-admin/user-clinic-settings?userId=${encodeURIComponent(viewAsUserId)}`
  }
  return '/api/clinic/settings'
}

/** Super-admin editing a business via Settings ?clinic= — takes precedence over view-as. */
export function clinicSettingsApiUrl(
  viewAsUserId: string | null | undefined,
  superAdminClinicId: string | null | undefined
): string {
  const cid = superAdminClinicId?.trim()
  if (cid) {
    return `/api/super-admin/clinic-settings?clinicId=${encodeURIComponent(cid)}`
  }
  return userClinicSettingsUrl(viewAsUserId)
}

export function userSyncElevenLabsUrl(viewAsUserId: string | null | undefined): string {
  if (viewAsUserId) return '/api/super-admin/user-sync-elevenlabs'
  return '/api/clinic/sync-elevenlabs'
}

export function syncElevenLabsApiUrl(
  viewAsUserId: string | null | undefined,
  superAdminClinicId: string | null | undefined
): string {
  if (superAdminClinicId?.trim()) return '/api/super-admin/clinic-sync-elevenlabs'
  return userSyncElevenLabsUrl(viewAsUserId)
}

export function userScheduledOutboundUrl(viewAsUserId: string | null | undefined): string {
  if (viewAsUserId) {
    return `/api/super-admin/user-scheduled-outbound?userId=${encodeURIComponent(viewAsUserId)}`
  }
  return '/api/clinic/scheduled-outbound'
}

export function userScheduledOutboundEventsUrl(
  id: string,
  viewAsUserId: string | null | undefined
): string {
  if (viewAsUserId) {
    return `/api/super-admin/user-scheduled-outbound/${encodeURIComponent(id)}/events?userId=${encodeURIComponent(viewAsUserId)}`
  }
  return `/api/clinic/scheduled-outbound/${encodeURIComponent(id)}/events`
}
