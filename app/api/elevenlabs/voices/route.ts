import { NextRequest, NextResponse } from 'next/server'
import { requireVoiceApiUser } from '@/lib/server/elevenlabs-voice-api-auth'
import { buildReceptionistPresetGroups } from '@/lib/receptionist-voices'
import type { ElevenLabsVoiceOption } from '@/lib/types'

/** GET /api/elevenlabs/voices — curated receptionist-friendly voices only. */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireVoiceApiUser(request)
    if (auth instanceof NextResponse) return auth

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 })
    }

    const res = await fetch('https://api.elevenlabs.io/v1/voices', {
      headers: { 'xi-api-key': apiKey.trim() },
    })
    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('ElevenLabs /v1/voices', res.status, errText.slice(0, 200))
      return NextResponse.json({ error: 'Failed to load voices from ElevenLabs' }, { status: 502 })
    }

    const json = (await res.json()) as { voices?: unknown[] }
    const raw = Array.isArray(json.voices) ? json.voices : []
    const byId = new Map<string, ElevenLabsVoiceOption>()

    for (const row of raw) {
      if (!row || typeof row !== 'object') continue
      const v = row as Record<string, unknown>
      const voiceId = typeof v.voice_id === 'string' ? v.voice_id.trim() : ''
      const name = typeof v.name === 'string' ? v.name.trim() : ''
      if (!voiceId || !name) continue
      const previewUrl = typeof v.preview_url === 'string' && v.preview_url.startsWith('http') ? v.preview_url : null
      const labels = v.labels && typeof v.labels === 'object' ? (v.labels as Record<string, unknown>) : {}
      const gender = typeof labels.gender === 'string' ? labels.gender : null
      const accent = typeof labels.accent === 'string' ? labels.accent : null
      const category = typeof v.category === 'string' ? v.category : null
      byId.set(voiceId, { voiceId, name, previewUrl, category, gender, accent })
    }

    const presetGroups = buildReceptionistPresetGroups(byId)
    const voices = presetGroups.flatMap((g) => g.voices)

    return NextResponse.json({ presetGroups, voices })
  } catch (e) {
    console.error('GET /api/elevenlabs/voices', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
