import { SupabaseClient } from '@supabase/supabase-js'
import { ScheduledCheckIn } from '@/lib/types'
import { ScheduledCheckInRow, ScheduledCheckInInsert, ScheduledCheckInUpdate } from './types'
import { dbScheduledCheckInToApp, appScheduledCheckInToDb } from './utils'

type Supabase = SupabaseClient<any>

export async function getScheduledCheckIns(supabase: Supabase, userId: string): Promise<ScheduledCheckIn[]> {
  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .select('*')
    .eq('user_id', userId)
    .order('scheduled_for', { ascending: true })

  if (error) {
    console.error('Error fetching scheduled check-ins:', error)
    throw error
  }

  return (data || []).map(dbScheduledCheckInToApp)
}

export async function getScheduledCheckIn(supabase: Supabase, checkInId: string, userId: string): Promise<ScheduledCheckIn | null> {
  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .select('*')
    .eq('id', checkInId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching scheduled check-in:', error)
    throw error
  }

  return data ? dbScheduledCheckInToApp(data) : null
}

export async function createScheduledCheckIn(supabase: Supabase, checkIn: ScheduledCheckIn, userId: string): Promise<ScheduledCheckIn> {
  const insertData = appScheduledCheckInToDb(checkIn, userId)
  
  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating scheduled check-in:', error)
    throw error
  }

  return dbScheduledCheckInToApp(data)
}

export async function createScheduledCheckIns(supabase: Supabase, checkIns: ScheduledCheckIn[], userId: string): Promise<ScheduledCheckIn[]> {
  const insertData = checkIns.map(checkIn => appScheduledCheckInToDb(checkIn, userId))
  
  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .insert(insertData)
    .select()

  if (error) {
    console.error('Error creating scheduled check-ins:', error)
    throw error
  }

  return (data || []).map(dbScheduledCheckInToApp)
}

export async function updateScheduledCheckIn(
  supabase: Supabase,
  checkInId: string,
  updates: Partial<ScheduledCheckIn>,
  userId: string
): Promise<ScheduledCheckIn> {
  const updateData: ScheduledCheckInUpdate = {}
  
  if (updates.patientId !== undefined) updateData.patient_id = updates.patientId
  if (updates.patientName !== undefined) updateData.patient_name = updates.patientName
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.sequenceId !== undefined) updateData.sequence_id = updates.sequenceId
  if (updates.sequenceName !== undefined) updateData.sequence_name = updates.sequenceName
  if (updates.stepDay !== undefined) updateData.step_day = updates.stepDay
  if (updates.scheduledFor !== undefined) updateData.scheduled_for = updates.scheduledFor.toISOString()
  if (updates.channel !== undefined) updateData.channel = updates.channel
  if (updates.goal !== undefined) updateData.goal = updates.goal
  if (updates.script !== undefined) updateData.script = updates.script
  if (updates.questions !== undefined) updateData.questions = updates.questions
  if (updates.status !== undefined) updateData.status = updates.status
  if (updates.completedAt !== undefined) updateData.completed_at = updates.completedAt?.toISOString() || null
  if (updates.completedCallId !== undefined) updateData.completed_call_id = updates.completedCallId || null
  if (updates.triggeredAt !== undefined) updateData.triggered_at = updates.triggeredAt?.toISOString() || null
  if (updates.conversationId !== undefined) updateData.conversation_id = updates.conversationId || null

  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .update(updateData)
    .eq('id', checkInId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating scheduled check-in:', error)
    throw error
  }

  return dbScheduledCheckInToApp(data)
}

export async function deleteScheduledCheckIn(supabase: Supabase, checkInId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_check_ins')
    .delete()
    .eq('id', checkInId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting scheduled check-in:', error)
    throw error
  }
}

export async function deleteScheduledCheckInsByUser(supabase: Supabase, userId: string): Promise<void> {
  const { error } = await supabase
    .from('scheduled_check_ins')
    .delete()
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting scheduled check-ins:', error)
    throw error
  }
}

export async function getScheduledCheckInsByPatient(supabase: Supabase, patientId: string, userId: string): Promise<ScheduledCheckIn[]> {
  const { data, error } = await supabase
    .from('scheduled_check_ins')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('scheduled_for', { ascending: true })

  if (error) {
    console.error('Error fetching scheduled check-ins by patient:', error)
    throw error
  }

  return (data || []).map(dbScheduledCheckInToApp)
}
