import { NextRequest, NextResponse } from 'next/server'
import { requireVoiceApiUser } from '@/lib/server/elevenlabs-voice-api-auth'
import {
  RECEPTIONIST_TTS_PREVIEW_TEXT,
  isAllowlistedReceptionistVoice,
} from '@/lib/receptionist-voices'

function elevenLabsErrorHint(status: number, raw: string): string | null {
  const t = raw.slice(0, 2000)
  try {
    const j = JSON.parse(t) as { detail?: unknown }
    const d = j.detail
    if (typeof d === 'string') return d.slice(0, 400)
    if (Array.isArray(d) && d[0] && typeof d[0] === 'object') {
      const o = d[0] as Record<string, unknown>
      const msg = o.msg
      if (typeof msg === 'string') return msg.slice(0, 400)
    }
    if (d && typeof d === 'object' && 'message' in d && typeof (d as { message: unknown }).message === 'string') {
      return ((d as { message: string }).message || '').slice(0, 400)
    }
  } catch {
    /* ignore */
  }
  if (status === 401) return 'Invalid or expired ElevenLabs API key.'
  if (status === 403) return 'ElevenLabs refused this request (quota or permissions).'
  return null
}

function isQuotaOrCreditError(body: string): boolean {
  const b = body.toLowerCase()
  return (
    (b.includes('quota') || b.includes('credit')) &&
    (b.includes('exceed') || b.includes('required') || b.includes('remaining') || b.includes('subscription'))
  )
}

function ttsModelCandidates(): string[] {
  const fromEnv = process.env.ELEVENLABS_TTS_MODEL?.trim()
  /** Cheapest / lowest-latency first (English Flash before multilingual). */
  const fallback = [
    'eleven_flash_v2',
    'eleven_flash_v2_5',
    'eleven_turbo_v2_5',
    'eleven_multilingual_v2',
    'eleven_monolingual_v1',
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const m of [fromEnv, ...fallback]) {
    if (!m || seen.has(m)) continue
    seen.add(m)
    out.push(m)
  }
  return out
}

function parsePreviewSpeed(raw: string | null): number | undefined {
  if (raw === null || raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  return Math.min(1.5, Math.max(0.5, Math.round(n * 100) / 100))
}

/**
 * GET /api/elevenlabs/voice-preview?voiceId=...&speed=1
 * Short TTS clip of the fixed receptionist line (same script for every voice).
 * Optional `speed` (0.5–1.5) maps to ElevenLabs `voice_settings.speed`.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireVoiceApiUser(request)
    if (auth instanceof NextResponse) return auth

    const voiceId = request.nextUrl.searchParams.get('voiceId')?.trim() || ''
    if (!voiceId || !isAllowlistedReceptionistVoice(voiceId)) {
      return NextResponse.json({ error: 'Invalid voice' }, { status: 400 })
    }

    const speed = parsePreviewSpeed(request.nextUrl.searchParams.get('speed'))

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey?.trim()) {
      return NextResponse.json({ error: 'ELEVENLABS_API_KEY not configured' }, { status: 503 })
    }

    const models = ttsModelCandidates()
    let lastStatus = 502
    let lastBody = ''

    for (const modelId of models) {
      const url = new URL(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`)
      url.searchParams.set('output_format', 'mp3_22050_32')

      const baseBody = { text: RECEPTIONIST_TTS_PREVIEW_TEXT, model_id: modelId }
      const attempts: Record<string, unknown>[] =
        typeof speed === 'number'
          ? [
              {
                ...baseBody,
                voice_settings: { stability: 0.5, similarity_boost: 0.75, speed },
              },
              baseBody,
            ]
          : [baseBody]

      for (const jsonBody of attempts) {
        const res = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(jsonBody),
        })

        if (res.ok) {
          const buf = await res.arrayBuffer()
          return new NextResponse(buf, {
            status: 200,
            headers: {
              'Content-Type': 'audio/mpeg',
              'Cache-Control': 'private, max-age=3600',
            },
          })
        }

        lastStatus = res.status
        lastBody = await res.text().catch(() => '')
        console.error('ElevenLabs TTS preview', modelId, res.status, lastBody.slice(0, 400))

        if (isQuotaOrCreditError(lastBody)) {
          break
        }
      }

      if (isQuotaOrCreditError(lastBody)) {
        break
      }
    }

    const hint = elevenLabsErrorHint(lastStatus, lastBody)
    if (isQuotaOrCreditError(lastBody)) {
      return NextResponse.json(
        {
          error: 'Not enough ElevenLabs credits for a custom preview.',
          detail: hint || 'Upgrade your plan or add characters in ElevenLabs.',
          useLibraryPreview: true,
        },
        { status: 429 }
      )
    }

    return NextResponse.json(
      {
        error: 'Could not generate preview',
        ...(hint ? { detail: hint } : {}),
      },
      { status: 502 }
    )
  } catch (e) {
    console.error('GET /api/elevenlabs/voice-preview', e)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
