'use client'

import { useMemo } from 'react'
import type { Call } from '@/lib/types'

function tierRank(n: 1 | 2 | 3 | 4 | null | undefined) {
  return n == null ? 0 : n
}

/**
 * Lightweight stats for the currently filtered call list (client-only).
 */
export function CallInsightsStrip({ calls }: { calls: Call[] }) {
  const stats = useMemo(() => {
    const n = calls.length
    if (n === 0) {
      return { n: 0, escalated: 0, p4: 0, inbound: 0, outbound: 0, avgDur: 0 }
    }
    let escalated = 0
    let p4 = 0
    let inbound = 0
    let outbound = 0
    let durSum = 0
    for (const c of calls) {
      if (c.escalated) escalated++
      if (tierRank(c.aiResponseUrgency) >= 4) p4++
      const d = c.callDirection || 'unknown'
      if (d === 'inbound') inbound++
      if (d === 'outbound') outbound++
      durSum += c.durationSec
    }
    return {
      n,
      escalated,
      p4,
      inbound,
      outbound,
      avgDur: Math.round(durSum / n),
    }
  }, [calls])

  if (stats.n === 0) return null

  const escPct = Math.round((stats.escalated / stats.n) * 100)
  const p4Pct = Math.round((stats.p4 / stats.n) * 100)

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
      <span>
        <span className="font-medium text-foreground">{stats.n}</span> in view
      </span>
      <span>
        Escalated <span className="font-medium text-foreground">{escPct}%</span>
      </span>
      <span>
        P4+ urgency <span className="font-medium text-foreground">{p4Pct}%</span>
      </span>
      <span>
        In / out{' '}
        <span className="font-medium text-foreground">
          {stats.inbound}/{stats.outbound}
        </span>
      </span>
      <span>
        Avg duration <span className="font-medium text-foreground">{stats.avgDur}s</span>
      </span>
    </div>
  )
}
