import { SupabaseClient } from '@supabase/supabase-js'
import { Patient } from '@/lib/types'
import { Database, PatientRow, PatientInsert, PatientUpdate } from './types'
import { dbPatientToApp, appPatientToDb } from './utils'

type Supabase = SupabaseClient<Database>

export async function getPatients(supabase: Supabase, userId: string): Promise<Patient[]> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching patients:', error)
    throw error
  }

  return (data || []).map(dbPatientToApp)
}

export async function getPatient(supabase: Supabase, patientId: string, userId: string): Promise<Patient | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('*')
    .eq('id', patientId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching patient:', error)
    throw error
  }

  return data ? dbPatientToApp(data) : null
}

export async function createPatient(supabase: Supabase, patient: Patient, userId: string): Promise<Patient> {
  const insertData = appPatientToDb(patient, userId)
  
  const { data, error } = await supabase
    .from('patients')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating patient:', error)
    throw error
  }

  return dbPatientToApp(data)
}

export async function updatePatient(
  supabase: Supabase,
  patientId: string,
  updates: Partial<Patient>,
  userId: string
): Promise<Patient> {
  const updateData: PatientUpdate = {}
  
  if (updates.name !== undefined) updateData.name = updates.name
  if (updates.phone !== undefined) updateData.phone = updates.phone
  if (updates.email !== undefined) updateData.email = updates.email
  if (updates.tags !== undefined) updateData.tags = updates.tags
  if (updates.riskScore !== undefined) updateData.risk_score = updates.riskScore
  if (updates.riskReasons !== undefined) updateData.risk_reasons = updates.riskReasons
  if (updates.lastContactAt !== undefined) updateData.last_contact_at = updates.lastContactAt.toISOString()
  if (updates.adoptionSignals !== undefined) updateData.adoption_signals = updates.adoptionSignals as Record<string, unknown>
  if (updates.proactiveCheckInsEnabled !== undefined) updateData.proactive_check_ins_enabled = updates.proactiveCheckInsEnabled
  if (updates.selectedSequenceIds !== undefined) updateData.selected_sequence_ids = updates.selectedSequenceIds || null
  if (updates.deviceBrand !== undefined) updateData.device_brand = updates.deviceBrand || null
  if (updates.deviceModel !== undefined) updateData.device_model = updates.deviceModel || null
  if (updates.fittingDate !== undefined) updateData.fitting_date = updates.fittingDate?.toISOString().split('T')[0] || null

  const { data, error } = await supabase
    .from('patients')
    .update(updateData)
    .eq('id', patientId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    console.error('Error updating patient:', error)
    throw error
  }

  return dbPatientToApp(data)
}

export async function deletePatient(supabase: Supabase, patientId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('patients')
    .delete()
    .eq('id', patientId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error deleting patient:', error)
    throw error
  }
}
