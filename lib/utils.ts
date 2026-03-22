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
