function toValidTimeMs(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null
  const d = value instanceof Date ? value : new Date(value)
  const t = d.getTime()
  return Number.isNaN(t) ? null : t
}

/** Accepts Date or JSON-serialized timestamps (string / number). */
export function formatDistanceToNow(date: Date | string | number | null | undefined): string {
  const then = toValidTimeMs(date)
  if (then == null) return '—'
  const now = new Date()
  const diffMs = now.getTime() - then
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'yesterday'
  if (diffDays < 7) return `${diffDays}d ago`

  return new Date(then).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatPhone(phone: string): string {
  return phone
}
