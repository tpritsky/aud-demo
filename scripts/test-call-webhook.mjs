#!/usr/bin/env node
/**
 * POST a synthetic ElevenLabs-style webhook to /api/calls with a valid HMAC signature.
 * Load env from project root, e.g.:
 *   node --env-file=.env.local scripts/test-call-webhook.mjs
 */
import { createHmac } from 'node:crypto'

const secret = process.env.ELEVENLABS_WEBHOOK_SECRET
const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '')

if (!secret) {
  console.error('Missing ELEVENLABS_WEBHOOK_SECRET')
  process.exit(1)
}

const conversationId = `test_webhook_${Date.now()}`
const nowSec = Math.floor(Date.now() / 1000)

const body = {
  type: 'post_call_transcription',
  event_timestamp: nowSec,
  data: {
    conversation_id: conversationId,
    transcript: [
      { role: 'agent', message: 'Thanks for calling. How can I help?' },
      { role: 'user', message: "Hi, this is Jane. I'd like to schedule a hearing check." },
    ],
    metadata: {
      start_time_unix_secs: nowSec - 120,
      call_duration_secs: 120,
      phone_call: {
        external_number: '+15551234567',
        agent_number: '+18005550100',
        direction: 'inbound',
      },
    },
    analysis: {
      transcript_summary: 'Caller requested scheduling. Agent offered times.',
      call_summary_title: 'Schedule appointment',
      call_successful: 'success',
      call_outcome: 'appointment_scheduled',
    },
  },
}

const rawBody = JSON.stringify(body)
const timestamp = String(nowSec)
const sig = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
const elevenLabsSignature = `t=${timestamp},v0=${sig}`

const url = `${baseUrl}/api/calls`
console.log('POST', url)
console.log('conversation_id:', conversationId)

const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'ElevenLabs-Signature': elevenLabsSignature,
  },
  body: rawBody,
})

const text = await res.text()
let json
try {
  json = JSON.parse(text)
} catch {
  json = text
}

console.log('Status:', res.status)
console.log('Body:', JSON.stringify(json, null, 2))

if (!res.ok) process.exit(1)
if (json && json.success === false) process.exit(1)
