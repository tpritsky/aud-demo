'use client'

import { useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { processElevenLabsWebhook } from '@/lib/calls-api'
import { Call } from '@/lib/types'

/**
 * Hook to sync calls from Eleven Labs webhooks
 * Can be used to manually trigger sync or set up polling
 */
export function useCallSync() {
  const { addCall } = useAppStore()

  const syncCall = useCallback(async (webhookPayload: unknown) => {
    const call = await processElevenLabsWebhook(webhookPayload)
    if (call) {
      addCall(call)
      return call
    }
    return null
  }, [addCall])

  return { syncCall }
}

/**
 * Hook to set up automatic polling for new calls
 * Useful if you want to periodically check for new calls
 */
export function useCallPolling(intervalMs: number = 30000) {
  const { syncCall } = useCallSync()

  useEffect(() => {
    // This is a placeholder - in a real implementation, you'd fetch new calls
    // from an endpoint that returns calls since the last sync
    const interval = setInterval(() => {
      // Polling logic would go here
      // For now, this is just a structure
    }, intervalMs)

    return () => clearInterval(interval)
  }, [intervalMs, syncCall])
}

