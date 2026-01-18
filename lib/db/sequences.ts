import { SupabaseClient } from '@supabase/supabase-js'
import { ProactiveSequence } from '@/lib/types'
import { Database, ProactiveSequenceRow, ProactiveSequenceInsert, ProactiveSequenceUpdate } from './types'
import { dbSequenceToApp, appSequenceToDb } from './utils'

type Supabase = SupabaseClient<Database>

export async function getSequences(supabase: Supabase, userId: string): Promise<ProactiveSequence[]> {
  const { data, error } = await supabase
    .from('proactive_sequences')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sequences:', error)
    throw error
  }

  return (data || []).map(dbSequenceToApp)
}

export async function getSequence(supabase: Supabase, sequenceId: string, userId: string): Promise<ProactiveSequence | null> {
  const { data, error } = await supabase
    .from('proactive_sequences')
    .select('*')
    .eq('id', sequenceId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching sequence:', error)
    throw error
  }

  return data ? dbSequenceToApp(data) : null
}

export async function createSequence(supabase: Supabase, sequence: ProactiveSequence, userId: string): Promise<ProactiveSequence> {
  const insertData = appSequenceToDb(sequence, userId)
  
  const { data, error } = await supabase
    .from('proactive_sequences')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating sequence:', error)
    throw error
  }

  return dbSequenceToApp(data)
}

export async function updateSequence(
  supabase: Supabase,
  sequenceId: string,
  updates: Partial<ProactiveSequence>,
  userId: string
): Promise<ProactiveSequence> {
  const updateData: ProactiveSequenceUpdate = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.audienceTag !== undefined) updateData.audience_tag = updates.audienceTag
  if (updates.steps !== undefined) updateData.steps = updates.steps as Record<string, unknown>[]
  if (updates.active !== undefined) updateData.active = updates.active

  const { data, error } = await supabase
    .from('proactive_sequences')
    .update(updateData)
    .eq('id', sequenceId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating sequence:', error)
    throw error
  }

  return dbSequenceToApp(data)
}

export async function deleteSequence(supabase: Supabase, sequenceId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('proactive_sequences')
    .delete()
    .eq('id', sequenceId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting sequence:', error)
    throw error
  }
}
