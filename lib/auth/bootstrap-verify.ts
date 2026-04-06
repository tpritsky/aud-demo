import { fetchWithTimeout } from '@/lib/utils'

async function responseErrorSnippet(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string }
    if (typeof j.error === 'string' && j.error.trim()) return j.error.trim()
  } catch {
    /* ignore */
  }
  try {
    const t = await res.text()
    return t.trim().slice(0, 160) || res.statusText
  } catch {
    return res.statusText
  }
}

export type ProfileRole = 'super_admin' | 'admin' | 'member'

export type VerifiedProfileSnapshot = {
  role: ProfileRole
  clinicId: string | null
}

/**
 * Validates that all backend reads required for a usable session succeed (service-role APIs, etc.).
 * Used to block showing the logged-in shell until critical data paths work.
 */
export async function verifyRequiredBackendReads(opts: {
  userId: string
  token: string
  role: ProfileRole | null
  clinicId: string | null
}): Promise<{
  ok: boolean
  errors: string[]
  profileFromApi: VerifiedProfileSnapshot | null
}> {
  const errors: string[] = []
  const { userId, token, role, clinicId } = opts

  let profileFromApi: VerifiedProfileSnapshot | null = null

  const pr = await fetchWithTimeout(
    '/api/profile',
    { headers: { Authorization: `Bearer ${token}` } },
    15_000
  )
  if (!pr.ok) {
    errors.push(`Profile API (${pr.status}): ${await responseErrorSnippet(pr)}`)
  } else {
    try {
      const j = (await pr.json()) as { role?: string | null; clinicId?: string | null }
      if (j.role !== 'super_admin' && j.role !== 'admin' && j.role !== 'member') {
        errors.push('Profile API: response missing a valid role (super_admin, admin, or member).')
      } else {
        profileFromApi = {
          role: j.role as ProfileRole,
          clinicId: j.clinicId ?? null,
        }
      }
    } catch {
      errors.push('Profile API: invalid JSON response.')
    }
  }

  const effectiveRole = profileFromApi?.role ?? role
  const effectiveClinicId = profileFromApi?.clinicId ?? clinicId

  if (!effectiveRole) {
    errors.push('Account role could not be determined (profile API and local fallbacks).')
  }

  if (effectiveRole === 'super_admin') {
    const biz = await fetchWithTimeout(
      '/api/super-admin/businesses',
      { headers: { Authorization: `Bearer ${token}` } },
      22_000
    )
    if (!biz.ok) {
      errors.push(`Super Admin — businesses (${biz.status}): ${await responseErrorSnippet(biz)}`)
    }

    const dash = await fetchWithTimeout(
      `/api/super-admin/user-dashboard-data?userId=${encodeURIComponent(userId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
      25_000
    )
    if (!dash.ok) {
      errors.push(`Super Admin — dashboard data (${dash.status}): ${await responseErrorSnippet(dash)}`)
    }
  }

  if ((effectiveRole === 'admin' || effectiveRole === 'member') && effectiveClinicId) {
    const cs = await fetchWithTimeout('/api/clinic/settings', { headers: { Authorization: `Bearer ${token}` } }, 22_000)
    if (!cs.ok) {
      errors.push(`Clinic settings (${cs.status}): ${await responseErrorSnippet(cs)}`)
    }
  }

  return { ok: errors.length === 0, errors, profileFromApi }
}
