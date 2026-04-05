import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Navigation / prefetch / React Strict Mode can abort in-flight work; not a user-facing failure. */
export function isLikelyAbortError(e: unknown): boolean {
  if (e == null) return false
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    if (o.name === 'AbortError') return true
    // DOMException.ABORT_ERR
    if (o.code === 20) return true
    const msg = typeof o.message === 'string' ? o.message : ''
    if (
      /signal is aborted|without reason|operation was aborted|user aborted|AbortError/i.test(msg)
    ) {
      return true
    }
  }
  if (typeof DOMException !== 'undefined' && e instanceof DOMException) {
    if (e.name === 'AbortError' || e.code === DOMException.ABORT_ERR) return true
  }
  if (e instanceof Error && e.name === 'AbortError') return true
  return false
}

/** Fetch that aborts after `ms` so a stuck API cannot block auth hydration forever. */
export function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  ms = 25_000
): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), ms)
  const { signal: userSignal, ...rest } = init
  if (userSignal) {
    userSignal.addEventListener('abort', () => ac.abort(), { once: true })
  }
  return fetch(input, { ...rest, signal: ac.signal }).finally(() => clearTimeout(t))
}
