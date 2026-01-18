import { SupabaseClient } from '@supabase/supabase-js'
import { ActivityEvent } from '@/lib/types'
import { ActivityEventRow, ActivityEventInsert } from './types'
import { dbActivityEventToApp, appActivityEventToDb } from './utils'

type Supabase = SupabaseClient<any>

export async function getActivityEvents(supabase: Supabase, userId: string, limit?: number): Promise<ActivityEvent[]> {
  let query = supabase
    .from('activity_events')
    .select('*')
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (limit) {
    query = query.limit(limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching activity events:', error)
    throw error
  }

  return (data || []).map(dbActivityEventToApp)
}

export async function createActivityEvent(supabase: Supabase, event: ActivityEvent, userId: string): Promise<ActivityEvent> {
  const insertData = appActivityEventToDb(event, userId)
  
  const { data, error } = await supabase
    .from('activity_events')
    .insert(insertData as any)
    .select()
    .single()

  if (error) {
    console.error('Error creating activity event:', error)
    throw error
  }

  return dbActivityEventToApp(data)
}

export async function getActivityEventsByPatient(supabase: Supabase, patientId: string, userId: string): Promise<ActivityEvent[]> {
  const { data, error } = await supabase
    .from('activity_events')
    .select('*')
    .eq('patient_id', patientId)
    .eq('user_id', userId)
    .order('timestamp', { ascending: false })

  if (error) {
    console.error('Error fetching activity events by patient:', error)
    throw error
  }

  return (data || []).map(dbActivityEventToApp)
}
