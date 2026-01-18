import { SupabaseClient } from '@supabase/supabase-js'
import { Call } from '@/lib/types'
import { Database, CallRow, CallInsert, CallUpdate } from './types'
import { dbCallToApp, appCallToDb } from './utils'

type Supabase = SupabaseClient<Database>

export async function getCalls(supabase: Supabase, userId: string, limit?: number): Promise<Call[]> {
  let query = supabase
    .from('calls')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching calls:', error)
    throw error
  }

  return (data || []).map(dbCallToApp)
}

export async function getCall(supabase: Supabase, callId: string, userId: string): Promise<Call | null> {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('id', callId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching call:', error)
    throw error
  }

  return data ? dbCallToApp(data) : null
}

export async function createCall(supabase: Supabase, call: Call, userId: string): Promise<Call> {
  const insertData = appCallToDb(call, userId)
  
  const { data, error } = await supabase
    .from('calls')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating call:', error)
    throw error
  }

  return dbCallToApp(data)
}

export async function updateCall(
  supabase: Supabase,
  callId: string,
  updates: Partial<Call>,
  userId: string
): Promise<Call> {
  const updateData: CallUpdate = {}
  
  if (updates.timestamp !== undefined) updateData.timestamp = updates.timestamp.toISOString()
  if (updates.callerName !== undefined) updateData.caller_name = updates.callerName
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.patientId !== undefined) updateData.patient_id = updates.patientId || null
  if (updates.intent !== undefined) updateData.intent = updates.intent
  if (updates.outcome !== undefined) updateData.outcome = updates.outcome
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.durationSec !== undefined) updateData.duration_sec = updates.durationSec
  if (updates.sentiment !== undefined) updateData.sentiment = updates.sentiment
  if (updates.escalated !== undefined) updateData.escalated = updates.escalated
  if (updates.summary !== undefined) updateData.summary = updates.summary as Record<string, unknown>
  if (updates.transcript !== undefined) updateData.transcript = updates.transcript
  if (updates.entities !== undefined) updateData.entities = updates.entities as Record<string, unknown>

  const { data, error } = await supabase
    .from('calls')
    .update(updateData)
    .eq('id', callId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating call:', error)
    throw error
  }

  return dbCallToApp(data)
}

export async function getCallsByPatient(supabase: Supabase, patientId: string, userId: string): Promise<Call[]> {
  const { data, error } = await supabase
    .from('calls')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (error) {
    console.error('Error fetching calls by patient:', error)
    throw error
  }

  return (data || []).map(dbCallToApp)
}
