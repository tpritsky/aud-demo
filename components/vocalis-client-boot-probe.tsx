'use client'

import { useLayoutEffect } from 'react'

/** One reliable console line when client JS runs (filter: Vocalis:boot). */
export function VocalisClientBootProbe() {
  useLayoutEffect(() => {
    console.info('[Vocalis:boot] client shell mounted', {
      t: new Date().toISOString(),
      path: typeof window !== 'undefined' ? window.location.pathname : '',
    })
  }, [])
  return null
}
