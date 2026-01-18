import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { Call, CallIntent, CallOutcome, CallStatus, Sentiment } from '@/lib/types'
import { createServerClient } from '@/lib/supabase/server'
import * as dbCalls from '@/lib/db/calls'
import { normalizePhoneNumber } from '@/lib/phone-format'

interface ElevenLabsWebhook {
  type: string
  event_timestamp: number
  data: {
    agent_id?: string
    conversation_id?: string
    status?: string
    user_id?: string
    transcript?: Array<{
      role: 'agent' | 'user'
      message: string
      time_in_call_secs?: number
    }>
    metadata?: {
      start_time_unix_secs?: number
      call_duration_secs?: number
      phone_call?: {
        external_number?: string
        agent_number?: string
        direction?: string
      }
    }
    analysis?: {
      transcript_summary?: string
      call_summary_title?: string
      call_successful?: string
      call_outcome?: string
    }
  }
}

// Map Eleven Labs call_outcome to our CallOutcome type
function mapCallOutcome(elevenLabsOutcome: string): CallOutcome {
  const outcomeMap: Record<string, CallOutcome> = {
    'appointment_booked': 'resolved',
    'appointment_scheduled': 'resolved',
    'resolved': 'resolved',
    'success': 'resolved',
    'escalated': 'escalated',
    'callback_scheduled': 'callback_scheduled',
    'voicemail': 'voicemail',
    'no_answer': 'no_answer',
    'transferred': 'transferred',
    'cancelled': 'resolved',
    'failed': 'escalated',
  }
  
  return outcomeMap[elevenLabsOutcome.toLowerCase()] || 'resolved'
}

// Map outcome to status
function mapStatus(outcome: CallOutcome): CallStatus {
  const statusMap: Record<CallOutcome, CallStatus> = {
    'resolved': 'resolved',
    'escalated': 'escalated',
    'callback_scheduled': 'pending_callback',
    'voicemail': 'pending_callback',
    'no_answer': 'pending_callback',
    'transferred': 'resolved',
  }
  
  return statusMap[outcome] || 'resolved'
}

// Infer intent from transcript, summary, and call outcome
function inferIntent(transcript: string, summary: string, callOutcome?: string): CallIntent {
  const text = (transcript + ' ' + summary).toLowerCase()
  const outcome = callOutcome?.toLowerCase() || ''
  
  // If the outcome explicitly mentions appointment booking, prioritize scheduling
  if (outcome.includes('appointment') && (outcome.includes('book') || outcome.includes('schedule'))) {
    return 'scheduling'
  }
  
  if (text.includes('schedule') || text.includes('appointment') || text.includes('book')) {
    if (text.includes('cancel') || text.includes('reschedule')) {
      return 'reschedule'
    }
    return 'scheduling'
  }
  
  if (text.includes('cancel')) {
    return 'cancel'
  }
  
  if (text.includes('new patient') || text.includes('first time') || text.includes('never been')) {
    return 'new_patient'
  }
  
  if (text.includes('troubleshoot') || text.includes('not working') || text.includes('issue') || 
      text.includes('problem') || text.includes('bluetooth') || text.includes('battery')) {
    return 'device_troubleshooting'
  }
  
  if (text.includes('bill') || text.includes('payment') || text.includes('insurance') || 
      text.includes('cost') || text.includes('price')) {
    return 'billing'
  }
  
  return 'general_inquiry'
}

// Infer sentiment from transcript
function inferSentiment(transcript: string, summary: string): Sentiment {
  const text = (transcript + ' ' + summary).toLowerCase()
  
  const positiveWords = ['thank', 'great', 'perfect', 'wonderful', 'excellent', 'happy', 'pleased']
  const negativeWords = ['frustrated', 'angry', 'upset', 'terrible', 'awful', 'disappointed', 'problem']
  
  const positiveCount = positiveWords.filter(word => text.includes(word)).length
  const negativeCount = negativeWords.filter(word => text.includes(word)).length
  
  if (negativeCount > positiveCount) return 'negative'
  if (positiveCount > negativeCount) return 'positive'
  return 'neutral'
}

// Extract caller name from transcript (basic extraction)
function extractCallerName(transcript: string, phone: string): string {
  // Try to find "This is [Name]" or "I'm [Name]" patterns
  const namePatterns = [
    /(?:this is|i'm|i am|my name is|it's)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    /(?:hi|hello),?\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
  ]
  
  for (const pattern of namePatterns) {
    const match = transcript.match(pattern)
    if (match && match[1]) {
      return match[1].trim()
    }
  }
  
  // Fallback to phone number formatted
  return phone.replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')
}

// HMAC webhook secret - should be stored in environment variable in production
const WEBHOOK_SECRET = process.env.ELEVENLABS_WEBHOOK_SECRET || 'wsec_54bcfb274290a95acb54cc9ebe91e2f813605e0f8394690ca25cf40cdc0690ce'
const TIMESTAMP_TOLERANCE_SEC = 30 * 60 // 30 minutes

/**
 * Verify the HMAC signature from Eleven Labs webhook
 * Eleven Labs sends signature as: t=<timestamp>,v0=<hash>
 * where hash is SHA-256 HMAC of timestamp.body using the secret
 */
function verifyWebhookSignature(
  signature: string,
  timestamp: string,
  body: string
): boolean {
  try {
    const toSign = `${timestamp}.${body}`
    const hmac = createHmac('sha256', WEBHOOK_SECRET)
    hmac.update(toSign)
    const expectedHash = hmac.digest('hex')
    
    // Extract hash from signature (format: t=<timestamp>,v0=<hash>)
    const hashMatch = signature.match(/v0=([a-f0-9]+)/i)
    if (!hashMatch) {
      return false
    }
    
    const providedHash = hashMatch[1]
    
    // Use timing-safe comparison to prevent timing attacks
    if (expectedHash.length !== providedHash.length) {
      return false
    }
    
    let result = 0
    for (let i = 0; i < expectedHash.length; i++) {
      result |= expectedHash.charCodeAt(i) ^ providedHash.charCodeAt(i)
    }
    
    return result === 0
  } catch (error) {
    console.error('Error verifying webhook signature:', error)
    return false
  }
}

/**
 * Parse and validate the ElevenLabs-Signature header
 * Returns { timestamp, signature } or null if invalid
 */
function parseSignatureHeader(header: string | null): { timestamp: string; signature: string } | null {
  if (!header) {
    return null
  }
  
  // Format: t=<timestamp>,v0=<hash>
  const timestampMatch = header.match(/t=(\d+)/)
  if (!timestampMatch) {
    return null
  }
  
  return {
    timestamp: timestampMatch[1],
    signature: header,
  }
}

/**
 * Validate timestamp is within tolerance window
 */
function validateTimestamp(timestamp: string): boolean {
  try {
    const timestampInt = parseInt(timestamp, 10)
    if (isNaN(timestampInt)) {
      return false
    }
    
    const nowSec = Math.floor(Date.now() / 1000)
    const diff = Math.abs(nowSec - timestampInt)
    
    return diff <= TIMESTAMP_TOLERANCE_SEC
  } catch {
    return false
  }
}

// Transform Eleven Labs webhook to Call
// Handles missing fields gracefully for short calls
function transformElevenLabsCall(webhook: ElevenLabsWebhook): Call {
  const data = webhook.data || {}
  const metadata = data.metadata || {}
  const analysis = data.analysis || {}
  const phoneCall = metadata.phone_call || {}
  
  // Generate call_id from conversation_id or create one
  const callId = data.conversation_id || `call_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  // Get start time from metadata or use event_timestamp
  const startTimeUnix = metadata.start_time_unix_secs || webhook.event_timestamp
  const startedAt = startTimeUnix ? new Date(startTimeUnix * 1000) : new Date()
  
  // Get duration from metadata
  const durationSeconds = metadata.call_duration_secs || 0
  
  // Get phone numbers
  const fromNumber = phoneCall.external_number || data.user_id || 'Unknown'
  const toNumber = phoneCall.agent_number || 'Unknown'
  
  // Build transcript from transcript array
  let transcript = ''
  if (data.transcript && Array.isArray(data.transcript)) {
    transcript = data.transcript
      .map((entry) => {
        const role = entry.role === 'agent' ? 'Agent' : 'Caller'
        return `${role}: ${entry.message}`
      })
      .join('\n\n')
  }
  
  // Get summary from analysis
  const summaryText = analysis.transcript_summary || analysis.call_summary_title || 'Call completed'
  const callOutcome = analysis.call_outcome || analysis.call_successful || 'resolved'
  
  // Infer values from available data
  const outcome = mapCallOutcome(callOutcome)
  const status = mapStatus(outcome)
  const intent = inferIntent(transcript, summaryText, callOutcome)
  const sentiment = inferSentiment(transcript, summaryText)
  const callerName = extractCallerName(transcript, fromNumber)
  
  // Parse summary to extract reason and resolution
  const summaryParts = summaryText.split('.')
  const reason = summaryParts[0] || summaryText || 'Call completed'
  const resolution = summaryParts.slice(1).join('.') || summaryText || 'No additional details'
  
  return {
    id: callId,
    timestamp: startedAt,
    callerName,
    phone: fromNumber,
    intent,
    outcome,
    status,
    durationSec: durationSeconds,
    sentiment,
    escalated: outcome === 'escalated',
    summary: {
      reason: reason.trim() || 'Call completed',
      resolution: resolution.trim() || 'No additional details',
    },
    transcript: transcript || 'No transcript available',
    entities: {
      phone: fromNumber,
    },
  }
}

// GET endpoint to fetch all calls
export async function GET(request: NextRequest) {
  try {
    const supabase = createServerClient()
    
    // Get user from auth header or session (for webhook calls, we'll use service role)
    // For now, return all calls (webhook endpoint doesn't have user context)
    // In production, you might want to add user authentication here
    
    // Since this is a webhook endpoint, we'll use service role to get calls
    // In a real app, you'd get the user from the session
    const authHeader = request.headers.get('authorization')
    
    // For now, return empty array if no auth
    // The client-side will fetch calls through Supabase with proper RLS
    return NextResponse.json(
      {
        success: true,
        calls: [],
        count: 0,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Error fetching calls:', error)
    return NextResponse.json(
      { error: 'Failed to fetch calls', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log('=== Webhook received ===')
  console.log('Headers:', Object.fromEntries(request.headers.entries()))
  
  try {
    // Get the signature header
    const signatureHeader = request.headers.get('elevenlabs-signature') || 
                           request.headers.get('ElevenLabs-Signature')
    
    console.log('Signature header present:', !!signatureHeader)
    
    if (!signatureHeader) {
      console.error('Missing ElevenLabs-Signature header')
      console.log('Available headers:', Array.from(request.headers.keys()))
      return NextResponse.json(
        { error: 'Missing signature header' },
        { status: 401 }
      )
    }
    
    // Parse signature header
    const parsed = parseSignatureHeader(signatureHeader)
    if (!parsed) {
      console.error('Invalid signature header format')
      return NextResponse.json(
        { error: 'Invalid signature header format' },
        { status: 401 }
      )
    }
    
    // Validate timestamp
    if (!validateTimestamp(parsed.timestamp)) {
      console.error('Timestamp outside tolerance window')
      return NextResponse.json(
        { error: 'Timestamp outside tolerance window' },
        { status: 401 }
      )
    }
    
    // Read raw body as text for signature verification
    const rawBody = await request.text()
    
    // Verify HMAC signature
    const signatureValid = verifyWebhookSignature(parsed.signature, parsed.timestamp, rawBody)
    console.log('Signature valid:', signatureValid)
    console.log('Webhook secret configured:', !!WEBHOOK_SECRET)
    
    if (!signatureValid) {
      console.error('Invalid webhook signature')
      console.error('Expected secret:', WEBHOOK_SECRET ? 'SET' : 'NOT SET')
      console.error('Signature:', parsed.signature)
      console.error('Timestamp:', parsed.timestamp)
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }
    
    // Parse JSON body
    let body: ElevenLabsWebhook
    try {
      body = JSON.parse(rawBody)
    } catch (error) {
      console.error('Invalid JSON body:', error)
      return NextResponse.json(
        { error: 'Invalid JSON body' },
        { status: 400 }
      )
    }
    
    // Log received webhook for debugging
    console.log('Received webhook:', JSON.stringify(body, null, 2))
    console.log('Webhook type:', body.type)
    console.log('Conversation ID:', body.data?.conversation_id)
    
    // Transform the webhook data to our Call type (handles missing fields)
    const call = transformElevenLabsCall(body)
    console.log('Transformed call:', { id: call.id, phone: call.phone, patientId: call.patientId })
    
    // Try to match call to patient by phone number and find user_id
    const supabase = createServerClient()
    console.log('Supabase client created')
    
    // Normalize phone number for matching
    const normalizedPhone = normalizePhoneNumber(call.phone)
    
    // Strategy 1: Find patient by phone number
    const { data: patients } = await supabase
      .from('patients')
      .select('id, user_id')
      .eq('phone', normalizedPhone)
      .limit(1)
    
    let userId: string | null = null
    
    if (patients && patients.length > 0) {
      call.patientId = patients[0].id
      userId = patients[0].user_id
    }
    
    // Strategy 2: If no patient match, try to find user_id from scheduled check-ins or callback tasks
    // by matching conversation_id
    if (!userId && call.id) {
      // Check scheduled check-ins
      const { data: checkIns } = await supabase
        .from('scheduled_check_ins')
        .select('user_id, patient_id')
        .eq('conversation_id', call.id)
        .limit(1)
      
      if (checkIns && checkIns.length > 0) {
        const checkIn = checkIns[0] as { user_id: string; patient_id: string | null }
        userId = checkIn.user_id
        // Also try to find patient from the check-in
        if (!call.patientId && checkIn.patient_id) {
          call.patientId = checkIn.patient_id
        }
      }
      
      // Check callback tasks if still no user_id
      if (!userId) {
        const { data: tasks } = await supabase
          .from('callback_tasks')
          .select('user_id, patient_id')
          .eq('conversation_id', call.id)
          .limit(1)
        
        if (tasks && tasks.length > 0) {
          const task = tasks[0] as { user_id: string; patient_id: string | null }
          userId = task.user_id
          if (!call.patientId && task.patient_id) {
            call.patientId = task.patient_id
          }
        }
      }
    }
    
    // Strategy 3: If still no user_id, get the first user from agent_config or patients table
    // This is a fallback for single-user scenarios or when calls come in before patients are created
    if (!userId) {
      // Try to get a user_id from agent_config (one per user)
      const { data: agentConfigs } = await supabase
        .from('agent_config')
        .select('user_id')
        .limit(1)
      
      if (agentConfigs && agentConfigs.length > 0) {
        userId = agentConfigs[0].user_id
        console.log(`No patient/task match found, using user from agent_config: ${userId}`)
      } else {
        // Last resort: get any user_id from patients table
        const { data: anyPatients } = await supabase
          .from('patients')
          .select('user_id')
          .limit(1)
        
        if (anyPatients && anyPatients.length > 0) {
          userId = anyPatients[0].user_id
          console.log(`No patient/task match found, using user from patients table: ${userId}`)
        }
      }
    }
    
    if (!userId) {
      console.error('No user_id found for call, cannot save to database. Make sure at least one user exists in Supabase.')
      return NextResponse.json(
        { 
          success: false, 
          error: 'No user associated with this call. Please ensure at least one user exists in the system.',
          call 
        },
        { status: 200 } // Still return 200 to acknowledge webhook
      )
    }
    
    // Check if call already exists
    console.log('User ID determined:', userId)
    
    if (!userId) {
      console.error('No user_id found - call cannot be stored')
      return NextResponse.json(
        { error: 'No user_id found for call', call },
        { status: 500 }
      )
    }
    
    const existingCall = await dbCalls.getCall(supabase, call.id, userId)
    console.log('Existing call found:', !!existingCall)
    
    if (existingCall) {
      // Update existing call with all fields
      const updates: Partial<Call> = {
        timestamp: call.timestamp,
        callerName: call.callerName,
        phone: call.phone,
        patientId: call.patientId,
        intent: call.intent,
        outcome: call.outcome,
        status: call.status,
        durationSec: call.durationSec,
        sentiment: call.sentiment,
        escalated: call.escalated,
        summary: call.summary,
        transcript: call.transcript,
        entities: call.entities,
      }
      await dbCalls.updateCall(supabase, call.id, updates, userId)
      console.log('Call updated successfully:', call.id)
    } else {
      // Create new call
      console.log('Creating new call in database...')
      await dbCalls.createCall(supabase, call, userId)
      console.log('Call stored successfully:', call.id)
      
      // Check if this call matches a scheduled check-in or callback task
      // This will be handled by the client-side real-time subscriptions
    }
    
    return NextResponse.json(
      { 
        success: true, 
        call,
        message: 'Call logged successfully' 
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('=== Error processing Eleven Labs webhook ===')
    console.error('Error:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      name: error instanceof Error ? error.name : 'Unknown',
    })
    return NextResponse.json(
      { error: 'Failed to process webhook', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
