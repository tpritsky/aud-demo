import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { fetchPhoneNumberIdsTakenByOtherClinics } from '@/lib/server/clinic-phone-assignments'
import { requireVoiceApiUser } from '@/lib/server/elevenlabs-voice-api-auth'
import type { ElevenLabsPhoneNumberOption } from '@/lib/types'

function parsePhoneRows(json: unknown): ElevenLabsPhoneNumberOption[] {
  const rawList = Array.isArray(json)
    ? json
    : json && typeof json === 'object' && Array.isArray((json as Record<string, unknown>).phone_numbers)
      ? ((json as Record<string, unknown>).phone_numbers as unknown[])
      : []
  const out: ElevenLabsPhoneNumberOption[] = []
  for (const row of rawList) {
    if (!row || typeof row !== 'object') continue
    const o = row as Record<string, unknown>
    const phoneNumberId = typeof o.phone_number_id === 'string' ? o.phone_number_id.trim() : ''
    const phoneNumber = typeof o.phone_number === 'string' ? o.phone_number.trim() : ''
    const label = typeof o.label === 'string' ? o.label.trim() : ''
    if (!phoneNumberId || !phoneNumber) continue
    let assignedAgentName: string | null = null
    let assignedAgentId: string | null = null
    const aa = o.assigned_agent
    if (aa && typeof aa === 'object') {
      const ar = aa as Record<string, unknown>
      const an = ar.agent_name
      if (typeof an === 'string' && an.trim()) assignedAgentName = an.trim()
      const aid = ar.agent_id
      if (typeof aid === 'string' && aid.trim()) assignedAgentId = aid.trim()
    }
    out.push({
      phoneNumberId,
      phoneNumber,
      label: label || phoneNumber,
      provider: typeof o.provider === 'string' ? o.provider : undefined,
      assignedAgentName,
      assignedAgentId,
    })
  }
  return out
}

/**
 * GET /api/elevenlabs/phone-numbers?clinicId=<uuid>
 * ConvAI numbers for the workspace. Omits lines already saved on another clinic so each number maps to one business.
 * - Admin/member: uses their profile clinic (ignores clinicId).
 * - Super admin: optional `clinicId` = clinic being edited; that clinic’s current line stays in the list, others’ lines are excluded.
 * - No clinic context: only numbers not assigned to any clinic are returned.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireVoiceApiUser(request)
    if (auth instanceof NextResponse) return auth

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 })
    }

    const res = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
      headers: { 'xi-api-key': apiKey.trim() },
    })

    const text = await res.text()
    if (!res.ok) {
      console.error('ElevenLabs GET /v1/convai/phone-numbers', res.status, text.slice(0, 400))
      let detail: string | undefined
      try {
        const j = JSON.parse(text) as { detail?: unknown }
        if (typeof j.detail === 'string') detail = j.detail.slice(0, 300)
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        {
          error: 'Failed to load phone numbers from ElevenLabs',
          ...(detail ? { detail } : {}),
        },
        { status: res.status === 401 || res.status === 403 ? res.status : 502 }
      )
    }

    let parsed: unknown
    try {
      parsed = JSON.parse(text) as unknown
    } catch {
      return NextResponse.json({ error: 'Invalid response from ElevenLabs' }, { status: 502 })
    }

    let phoneNumbers = parsePhoneRows(parsed)

    const supabase = createServerClient()
    const { data: profile } = await supabase
      .from('profiles')
      .select('clinic_id, role')
      .eq('id', auth.user.id)
      .maybeSingle()
    const role = (profile as { role?: string } | null)?.role
    const myClinicId = (profile as { clinic_id?: string | null } | null)?.clinic_id?.trim() || null
    const paramClinic = new URL(request.url).searchParams.get('clinicId')?.trim() || null

    let exceptClinicId: string | null = null
    if (role === 'super_admin' && paramClinic) {
      exceptClinicId = paramClinic
    } else if (myClinicId) {
      exceptClinicId = myClinicId
    }

    const takenElsewhere = await fetchPhoneNumberIdsTakenByOtherClinics(supabase, exceptClinicId)
    phoneNumbers = phoneNumbers.filter((p) => !takenElsewhere.has(p.phoneNumberId))

    return NextResponse.json({ phoneNumbers })
  } catch (e) {
    console.error('GET /api/elevenlabs/phone-numbers', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
