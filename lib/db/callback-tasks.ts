import { SupabaseClient } from '@supabase/supabase-js'
import { CallbackTask, CallbackAttempt } from '@/lib/types'
import { CallbackTaskRow, CallbackTaskInsert, CallbackTaskUpdate, CallbackAttemptRow, CallbackAttemptInsert } from './types'
import { dbCallbackTaskToApp, appCallbackTaskToDb, dbCallbackAttemptToApp, appCallbackAttemptToDb } from './utils'

type Supabase = SupabaseClient<any>

export async function getCallbackTasks(supabase: Supabase, userId: string): Promise<CallbackTask[]> {
  const { data, error } = await supabase
    .from('callback_tasks')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching callback tasks:', error)
    throw error
  }

  // Fetch attempts for each task
  const tasksWithAttempts = await Promise.all(
    (data || []).map(async (taskRow) => {
      const attempts = await getAttemptsForTask(supabase, taskRow.id)
      return dbCallbackTaskToApp(taskRow, attempts)
    })
  )

  return tasksWithAttempts
}

export async function getCallbackTask(supabase: Supabase, taskId: string, userId: string): Promise<CallbackTask | null> {
  const { data, error } = await supabase
    .from('callback_tasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching callback task:', error)
    throw error
  }

  if (!data) return null

  const attempts = await getAttemptsForTask(supabase, taskId)
  return dbCallbackTaskToApp(data, attempts)
}

async function getAttemptsForTask(supabase: Supabase, taskId: string): Promise<CallbackAttempt[]> {
  const { data, error } = await supabase
    .from('callback_attempts')
    .select('*')
    .eq('task_id', taskId)
    .order('attempt_number', { ascending: true })

  if (error) {
    console.error('Error fetching attempts:', error)
    return []
  }

  return (data || []).map(dbCallbackAttemptToApp)
}

export async function createCallbackTask(supabase: Supabase, task: CallbackTask, userId: string): Promise<CallbackTask> {
  const insertData = appCallbackTaskToDb(task, userId)
  
  const { data, error } = await supabase
    .from('callback_tasks')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating callback task:', error)
    throw error
  }

  // Insert attempts if any
  if (task.attempts.length > 0) {
    const attemptInserts = task.attempts.map(attempt => appCallbackAttemptToDb(attempt, data.id))
    const { error: attemptsError } = await supabase
      .from('callback_attempts')
      .insert(attemptInserts)

    if (attemptsError) {
      console.error('Error creating attempts:', attemptsError)
      // Don't throw - task was created successfully
    }
  }

  const attempts = await getAttemptsForTask(supabase, data.id)
  return dbCallbackTaskToApp(data, attempts)
}

export async function updateCallbackTask(
  supabase: Supabase,
  taskId: string,
  updates: Partial<CallbackTask>,
  userId: string
): Promise<CallbackTask> {
  const updateData: CallbackTaskUpdate = {}
  
  if (updates.patientId !== undefined) updateData.patient_id = updates.patientId
  if (updates.patientName !== undefined) updateData.patient_name = updates.patientName
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.callReason !== undefined) updateData.call_reason = updates.callReason
  if (updates.callGoal !== undefined) updateData.call_goal = updates.callGoal
  if (updates.priority !== undefined) updateData.priority = updates.priority
  if (updates.dueAt !== undefined) updateData.due_at = updates.dueAt?.toISOString() || null
  if (updates.callId !== undefined) updateData.call_id = updates.callId || null
  if (updates.maxAttempts !== undefined) updateData.max_attempts = updates.maxAttempts
  if (updates.nextAttemptAt !== undefined) updateData.next_attempt_at = updates.nextAttemptAt?.toISOString() || null
  if (updates.conversationId !== undefined) updateData.conversation_id = updates.conversationId || null

  const { data, error } = await supabase
    .from('callback_tasks')
    .update(updateData)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating callback task:', error)
    throw error
  }

  // Update attempts if provided
  if (updates.attempts !== undefined) {
    // Delete existing attempts
    await supabase
      .from('callback_attempts')
      .delete()
      .eq('task_id', taskId)

    // Insert new attempts
    if (updates.attempts.length > 0) {
      const attemptInserts = updates.attempts.map(attempt => appCallbackAttemptToDb(attempt, taskId))
      await supabase
        .from('callback_attempts')
        .insert(attemptInserts)
    }
  }

  const attempts = await getAttemptsForTask(supabase, taskId)
  return dbCallbackTaskToApp(data, attempts)
}

export async function addCallbackAttempt(
  supabase: Supabase,
  taskId: string,
  attempt: CallbackAttempt
): Promise<void> {
  const insertData = appCallbackAttemptToDb(attempt, taskId)
  
  const { error } = await supabase
    .from('callback_attempts')
    .insert(insertData)

  if (error) {
    console.error('Error adding callback attempt:', error)
    throw error
  }
}

export async function deleteCallbackTask(supabase: Supabase, taskId: string, userId: string): Promise<void> {
  // Delete attempts first (foreign key constraint)
  await supabase
    .from('callback_attempts')
    .delete()
    .eq('task_id', taskId)

  // Delete task
  const { error } = await supabase
    .from('callback_tasks')
    .delete()
    .eq('id', taskId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting callback task:', error)
    throw error
  }
}
