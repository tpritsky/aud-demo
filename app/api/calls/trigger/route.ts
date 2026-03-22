import { NextRequest, NextResponse } from 'next/server'
import { normalizePhoneNumber } from '@/lib/phone-format'
import { createServerClient } from '@/lib/supabase/server'

interface ConversationInitiationClientData {
  dynamic_variables?: {
    call_reason?: string
    patient_name?: string
    clinic_name?: string
    call_goal?: string
  }
}

interface TriggerCallRequest {
  agent_id: string
  agent_phone_number_id: string
  to_number: string
  conversation_initiation_client_data?: ConversationInitiationClientData
}

interface ElevenLabsResponse {
  success: boolean
  message: string
  conversation_id: string
  callSid: string
}

/**
 * POST /api/calls/trigger
 * Triggers an outbound call via Eleven Labs API
 */
export async function POST(request: NextRequest) {
  try {
    const body: TriggerCallRequest = await request.json()

    // Validate required fields
    if (!body.agent_id || !body.agent_phone_number_id || !body.to_number) {
      return NextResponse.json(
        { error: 'Missing required fields: agent_id, agent_phone_number_id, to_number' },
        { status: 400 }
      )
    }

    // Normalize phone number to ensure E.164 format (e.g., +15596729884)
    const normalizedToNumber = normalizePhoneNumber(body.to_number)
    
    console.log('API trigger - Original:', body.to_number, 'Normalized:', normalizedToNumber)
    
    // Validate phone number format
    if (!normalizedToNumber.startsWith('+') || normalizedToNumber.length < 11) {
      return NextResponse.json(
        { error: `Invalid phone number format: ${body.to_number}. Expected E.164 format (e.g., +15596729884)` },
        { status: 400 }
      )
    }

    const apiKey = process.env.ELEVENLABS_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Eleven Labs API key not configured (ELEVENLABS_API_KEY)' },
        { status: 500 }
      )
    }

    // Build request payload
    const payload: any = {
      agent_id: body.agent_id,
      agent_phone_number_id: body.agent_phone_number_id,
      to_number: normalizedToNumber,
    }

    // Add dynamic variables if provided
    if (body.conversation_initiation_client_data) {
      payload.conversation_initiation_client_data = body.conversation_initiation_client_data
    }

    console.log('Sending to Eleven Labs:', JSON.stringify(payload, null, 2))

    // Call Eleven Labs API
    const response = await fetch('https://api.elevenlabs.io/v1/convai/twilio/outbound-call', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Eleven Labs API error:', errorText)
      return NextResponse.json(
        { 
          error: 'Failed to trigger call via Eleven Labs',
          details: errorText 
        },
        { status: response.status }
      )
    }

    const data: ElevenLabsResponse = await response.json()

    console.log('Call triggered successfully:', data)

    const authHeader = request.headers.get('Authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '')
    if (token && data.conversation_id) {
      const supabase = createServerClient()
      const {
        data: { user },
        error: authErr,
      } = await supabase.auth.getUser(token)
      if (!authErr && user?.id) {
        const { error: claimErr } = await supabase.from('conversation_claims').upsert(
          {
            conversation_id: data.conversation_id,
            user_id: user.id,
          },
          { onConflict: 'conversation_id' }
        )
        if (claimErr) {
          console.error('[calls/trigger] conversation_claims upsert:', claimErr.message)
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        conversation_id: data.conversation_id,
        callSid: data.callSid,
        message: 'Call triggered successfully',
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error triggering call:', error)
    return NextResponse.json(
      { 
        error: 'Failed to trigger call', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    )
  }
}

