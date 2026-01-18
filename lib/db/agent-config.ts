import { SupabaseClient } from '@supabase/supabase-js'
import { AgentConfig } from '@/lib/types'
import { Database, AgentConfigRow, AgentConfigInsert, AgentConfigUpdate } from './types'
import { dbAgentConfigToApp, appAgentConfigToDb } from './utils'

type Supabase = SupabaseClient<Database>

export async function getAgentConfig(supabase: Supabase, userId: string): Promise<AgentConfig | null> {
  const { data, error } = await supabase
    .from('agent_config')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    console.error('Error fetching agent config:', error)
    throw error
  }

  return data ? dbAgentConfigToApp(data) : null
}

export async function createAgentConfig(supabase: Supabase, config: AgentConfig, userId: string): Promise<AgentConfig> {
  const insertData = appAgentConfigToDb(config, userId)
  
  const { data, error } = await supabase
    .from('agent_config')
    .insert(insertData)
    .select()
    .single()

  if (error) {
    console.error('Error creating agent config:', error)
    throw error
  }

  return dbAgentConfigToApp(data)
}

export async function updateAgentConfig(
  supabase: Supabase,
  config: AgentConfig,
  userId: string
): Promise<AgentConfig> {
  const updateData: AgentConfigUpdate = {}
  
  if (config.clinicName !== undefined) updateData.clinic_name = config.clinicName
  if (config.phoneNumber !== undefined) updateData.phone_number = config.phoneNumber
  if (config.hoursOpen !== undefined) updateData.hours_open = config.hoursOpen
  if (config.hoursClose !== undefined) updateData.hours_close = config.hoursClose
  if (config.voiceStyle !== undefined) updateData.voice_style = config.voiceStyle
  if (config.speechSpeed !== undefined) updateData.speech_speed = config.speechSpeed
  if (config.elevenLabsAgentId !== undefined) updateData.eleven_labs_agent_id = config.elevenLabsAgentId || null
  if (config.elevenLabsOutboundAgentId !== undefined) updateData.eleven_labs_outbound_agent_id = config.elevenLabsOutboundAgentId || null
  if (config.elevenLabsPhoneNumberId !== undefined) updateData.eleven_labs_phone_number_id = config.elevenLabsPhoneNumberId || null
  if (config.allowedIntents !== undefined) updateData.allowed_intents = config.allowedIntents as Record<string, unknown>
  if (config.escalationRules !== undefined) updateData.escalation_rules = config.escalationRules as Record<string, unknown>
  if (config.callbackSettings !== undefined) updateData.callback_settings = config.callbackSettings as Record<string, unknown>

  // Try to update first
  const { data: updateData_result, error: updateError } = await supabase
    .from('agent_config')
    .update(updateData)
    .eq('user_id', userId)
    .select()
    .single()

  if (updateError) {
    // If update fails, try to create
    if (updateError.code === 'PGRST116') {
      return createAgentConfig(supabase, config, userId)
    }
    console.error('Error updating agent config:', updateError)
    throw updateError
  }

  return dbAgentConfigToApp(updateData_result)
}
