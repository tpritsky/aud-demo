import { normalizePhoneNumber } from './phone-format'

export interface CallDynamicVariables {
  call_reason?: string
  patient_name?: string
  clinic_name?: string
  call_goal?: string
}

/**
 * Trigger an outbound call via Eleven Labs API
 */
export async function triggerOutboundCall(
  toNumber: string,
  agentId: string,
  phoneNumberId: string,
  dynamicVariables?: CallDynamicVariables
): Promise<{ success: boolean; conversation_id?: string; callSid?: string; error?: string }> {
  try {
    // Normalize phone number to E.164 format (e.g., +15596729884)
    const normalizedNumber = normalizePhoneNumber(toNumber)
    
    // Log for debugging
    console.log('Call trigger - Original:', toNumber, 'Normalized:', normalizedNumber)
    
    // Validate format
    if (!normalizedNumber.startsWith('+') || normalizedNumber.length < 11) {
      return {
        success: false,
        error: `Invalid phone number format: ${normalizedNumber}. Expected E.164 format (e.g., +15596729884)`,
      }
    }
    
    // Build request payload
    const payload: any = {
      agent_id: agentId,
      agent_phone_number_id: phoneNumberId,
      to_number: normalizedNumber,
    }

    // Add dynamic variables if provided
    if (dynamicVariables && Object.keys(dynamicVariables).length > 0) {
      payload.conversation_initiation_client_data = {
        dynamic_variables: dynamicVariables,
      }
    }

    const response = await fetch('/api/calls/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const error = await response.json()
      return {
        success: false,
        error: error.error || 'Failed to trigger call',
      }
    }

    const data = await response.json()
    return {
      success: true,
      conversation_id: data.conversation_id,
      callSid: data.callSid,
    }
  } catch (error) {
    console.error('Error triggering call:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

