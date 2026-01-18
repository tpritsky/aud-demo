import { Call } from './types'

/**
 * Fetch a call from the API by call ID
 * This can be used to sync a call that was received via webhook
 */
export async function fetchCallFromAPI(callId: string): Promise<Call | null> {
  try {
    const response = await fetch(`/api/calls/${callId}`)
    if (!response.ok) {
      console.error('Failed to fetch call:', response.statusText)
      return null
    }
    const data = await response.json()
    return data.call
  } catch (error) {
    console.error('Error fetching call:', error)
    return null
  }
}

/**
 * Process an Eleven Labs webhook payload and add it to the store
 * This should be called from the frontend after receiving a webhook notification
 * or can be used to manually sync calls
 */
export async function processElevenLabsWebhook(webhookPayload: unknown): Promise<Call | null> {
  try {
    const response = await fetch('/api/calls', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(webhookPayload),
    })

    if (!response.ok) {
      const error = await response.json()
      console.error('Failed to process webhook:', error)
      return null
    }

    const data = await response.json()
    return data.call
  } catch (error) {
    console.error('Error processing webhook:', error)
    return null
  }
}

