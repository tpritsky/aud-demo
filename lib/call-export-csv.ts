import type { Call } from '@/lib/types'

function escapeCsvCell(value: string): string {
  if (value.includes('"') || value.includes(',') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export type CallsCsvExportMode = 'excerpt' | 'full_transcript'

/**
 * Build CSV for the currently filtered call list (client download).
 */
export function callsToCsv(calls: Call[], mode: CallsCsvExportMode = 'excerpt'): string {
  const transcriptCol = mode === 'full_transcript' ? 'transcript_full' : 'transcript_excerpt'
  const headers = [
    'timestamp',
    'direction',
    'caller_name',
    'phone',
    'ai_urgency',
    'ai_value',
    'intent',
    'outcome',
    'status',
    'duration_sec',
    'ai_summary',
    'ai_tags',
    transcriptCol,
  ]
  const lines = [headers.join(',')]
  for (const c of calls) {
    const rawTx = (c.transcript || '').replace(/\s+/g, ' ').trim()
    const transcriptCell =
      mode === 'full_transcript' ? rawTx : rawTx.slice(0, 2000)
    const row = [
      c.timestamp.toISOString(),
      c.callDirection || 'unknown',
      c.callerName,
      c.phone,
      c.aiResponseUrgency != null ? String(c.aiResponseUrgency) : '',
      c.aiBusinessValue != null ? String(c.aiBusinessValue) : '',
      c.intent,
      c.outcome,
      c.status,
      String(c.durationSec),
      c.aiBriefSummary || '',
      (c.aiTags || []).join(';'),
      transcriptCell,
    ].map((x) => escapeCsvCell(String(x)))
    lines.push(row.join(','))
  }
  return lines.join('\n')
}

export function downloadCallsCsv(
  calls: Call[],
  filename = 'calls-export.csv',
  mode: CallsCsvExportMode = 'excerpt'
) {
  const csv = callsToCsv(calls, mode)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** JSON export of the same fields the table cares about (full transcript when present). */
export function callsToExportJson(calls: Call[]) {
  return calls.map((c) => ({
    id: c.id,
    timestamp: c.timestamp.toISOString(),
    direction: c.callDirection || 'unknown',
    callerName: c.callerName,
    phone: c.phone,
    aiResponseUrgency: c.aiResponseUrgency,
    aiBusinessValue: c.aiBusinessValue,
    intent: c.intent,
    outcome: c.outcome,
    status: c.status,
    durationSec: c.durationSec,
    escalated: c.escalated,
    patientId: c.patientId,
    aiBriefSummary: c.aiBriefSummary,
    aiTags: c.aiTags,
    transcript: c.transcript || '',
  }))
}

export function downloadCallsJson(calls: Call[], filename = 'calls-export.json') {
  const json = JSON.stringify(callsToExportJson(calls), null, 2)
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
