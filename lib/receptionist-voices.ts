/**
 * Curated ElevenLabs voices for receptionist pickers.
 * Every `voiceId` is listed in the UI; GET /v1/voices may only return a subset for
 * your account — we still show all rows and merge labels/preview URLs when present.
 */

import type { ElevenLabsVoiceOption } from '@/lib/types'

/** Shown in UI copy where a fuller greeting is referenced. */
export const RECEPTIONIST_PREVIEW_SCRIPT =
  "Hey, thanks for calling. I'm your virtual receptionist, how may I help you today?"

/** Short line for TTS previews (same for every voice; fewer characters = lower credit use). */
export const RECEPTIONIST_TTS_PREVIEW_TEXT =
  'Hi, thanks for calling. How can I help you today?'

/** Characters per custom TTS preview (ElevenLabs usage is character-based; same for every voice). */
export const RECEPTIONIST_TTS_PREVIEW_CHAR_COUNT = [...RECEPTIONIST_TTS_PREVIEW_TEXT].length

export type ReceptionistVoiceEntry = {
  voiceId: string
  /** Shown in the picker (your product names). */
  displayName: string
}

export const RECEPTIONIST_VOICE_PRESETS: readonly {
  label: string
  voices: readonly ReceptionistVoiceEntry[]
}[] = [
  {
    label: 'Recommended',
    voices: [
      { voiceId: '56AoDkrOh6qfVPDXZ7Pt', displayName: 'Cassidy' },
      { voiceId: 'XrExE9yKIg1WjnnlVkGX', displayName: 'Matilda' },
      { voiceId: 'cgSgspJ2msm6clMCkdW9', displayName: 'Jessica' },
      { voiceId: '5l5f8iK3YPeGga21rQIX', displayName: 'Adeline' },
      { voiceId: 'rCmVtv8cYU60uhlsOo1M', displayName: 'Ana' },
      { voiceId: 'gs0tAILXbY5DNrJrsM6F', displayName: 'Jeff' },
      { voiceId: 'DTKMou8ccj1ZaWGBiotd', displayName: 'Jamahal' },
      { voiceId: 'jdVRqFnO8jznZjspX89f', displayName: 'Eric' },
      { voiceId: 'iP95p4xoKVk53GoZ742B', displayName: 'Chris' },
      { voiceId: 'pNInz6obpgDQGcFmaJgB', displayName: 'Adam' },
    ],
  },
  {
    label: 'More voices',
    voices: [
      { voiceId: 'LyJdFqe4G1teMZetsPSx', displayName: 'Tiffany' },
      { voiceId: 'pFZP5JQG7iQjIQuC4Bku', displayName: 'Lilly Wolf' },
      { voiceId: 'tnSpp4vdxKPjI9w0GnoV', displayName: 'Hope' },
      { voiceId: 'Z3R5wn05IrDiVCyEkUrK', displayName: 'Arabella' },
      { voiceId: 'pREMn4INXSs2KOPsNcsD', displayName: 'Alexandra' },
      { voiceId: 'Se2Vw1WbHmGbBbyWTuu4', displayName: 'Allison' },
      { voiceId: 'Bj9UqZbhQsanLzgalpEG', displayName: 'Austin' },
      { voiceId: 'ZthjuvLPty3kTMaNKVKb', displayName: 'Peter' },
      { voiceId: 'UgBBYS2sOqTuMpoF3BR0', displayName: 'Mark' },
      { voiceId: 'vBKc2FfBKJfcZNyEt1n6', displayName: 'Finn' },
      { voiceId: 'M7ya1YbaeFaPXljg9BpK', displayName: 'Hannah from Australia' },
      { voiceId: 'cmudN4ihcI42n48urXgc', displayName: 'Jason from Australia' },
      { voiceId: 'FqTvupDLWXjo91Dte1vR', displayName: 'Kate from Australia' },
      { voiceId: 'Fahco4VZzobUeiPqni1S', displayName: 'Archer from Britain' },
      { voiceId: 'bqbHGIIO5oETYIqhWmfk', displayName: 'Alexander from Britain' },
      { voiceId: 'AeRdCCKzvd23BpJoofzx', displayName: 'Nathaniel from Britain' },
      { voiceId: 'fhWgCDAdAXgPVl5ls9uP', displayName: 'Hugh from Britain' },
      { voiceId: 'WzsP0bfiCpSDfNgLrUuN', displayName: 'Casey from Britain' },
      { voiceId: '4CrZuIW9am7gYAxgo2Af', displayName: 'Shelley from Britain' },
      { voiceId: 'AXdMgz6evoL7OPd7eU12', displayName: 'Elizabeth from Britain' },
      { voiceId: 'kdmDKE6EkgrWrrykO9Qt', displayName: 'Alexis from Britain' },
      { voiceId: 'Xb7hH8MSUJpSbSDYk0k2', displayName: 'Shelby from Britain' },
      { voiceId: '3eeY9rFz1akxkQTWoYXs', displayName: 'Isla from Scotland' },
      { voiceId: 'LhG6Tsjmn5tklSCyReiu', displayName: 'Labhaoise from Ireland' },
      { voiceId: 'oWAxZDx7w5VEj9dCyTzz', displayName: 'Clint from Texas' },
      { voiceId: '94zOad0g7T7K4oa7zhDq', displayName: 'Mauricio from Colombia' },
      { voiceId: '86V9x9hrQds83qf7zaGn', displayName: 'Norah from Colombia' },
      { voiceId: '5Aahq892EEb6MdNwMM3p', displayName: 'Laura Lopez from Spain' },
      { voiceId: 'orF2qy9215xjwqqxqsWW', displayName: 'Rafa from Spain' },
      { voiceId: 'gD1IexrzCvsXPHUuT0s3', displayName: 'Sara Martin from Spain' },
      { voiceId: 'b3jcIbyC3BSnaRu8avEk', displayName: 'Emma from the Netherlands' },
      { voiceId: 'GBp66gF5eXCkPPSbXSDf', displayName: 'Fabian from the Netherlands' },
    ],
  },
] as const

const RECEPTIONIST_VOICE_IDS_ORDERED: readonly string[] = (() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const p of RECEPTIONIST_VOICE_PRESETS) {
    for (const { voiceId } of p.voices) {
      if (seen.has(voiceId)) continue
      seen.add(voiceId)
      out.push(voiceId)
    }
  }
  return out
})()

export const RECEPTIONIST_VOICE_IDS = RECEPTIONIST_VOICE_IDS_ORDERED

const RECEPTIONIST_SET = new Set(RECEPTIONIST_VOICE_IDS)

export function isAllowlistedReceptionistVoice(voiceId: string): boolean {
  return RECEPTIONIST_SET.has(voiceId.trim())
}

/** Merge ElevenLabs /v1/voices rows with our full curated list (always one row per curated id). */
export function buildReceptionistPresetGroups(
  byId: Map<string, ElevenLabsVoiceOption>
): { label: string; voices: ElevenLabsVoiceOption[] }[] {
  const out: { label: string; voices: ElevenLabsVoiceOption[] }[] = []
  for (const preset of RECEPTIONIST_VOICE_PRESETS) {
    const voices: ElevenLabsVoiceOption[] = []
    for (const { voiceId, displayName } of preset.voices) {
      const fromApi = byId.get(voiceId)
      if (fromApi) {
        voices.push({ ...fromApi, name: displayName })
      } else {
        voices.push({
          voiceId,
          name: displayName,
          previewUrl: null,
          category: null,
          gender: null,
          accent: null,
        })
      }
    }
    out.push({ label: preset.label, voices })
  }
  return out
}
