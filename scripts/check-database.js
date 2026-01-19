/**
 * Simple script to check what data exists in your Supabase database
 * Run with: node scripts/check-database.js
 * 
 * Make sure your .env.local file has the Supabase credentials
 * Or set them as environment variables:
 * NEXT_PUBLIC_SUPABASE_URL=...
 * SUPABASE_SERVICE_ROLE_KEY=...
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

// Try to load .env.local
try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const match = line.match(/^([^=]+)=(.*)$/)
      if (match) {
        const key = match[1].trim()
        const value = match[2].trim().replace(/^["']|["']$/g, '')
        process.env[key] = value
      }
    })
  }
} catch (e) {
  console.warn('Could not load .env.local, using environment variables')
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing Supabase environment variables in .env.local')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function checkDatabase() {
  console.log('Checking Supabase database...\n')

  // Check users
  const { data: users, error: usersError } = await supabase.auth.admin.listUsers()
  if (usersError) {
    console.error('Error fetching users:', usersError)
  } else {
    console.log(`Users: ${users.users.length}`)
    users.users.forEach(user => {
      console.log(`  - ${user.email} (${user.id})`)
    })
  }

  // Check profiles
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('*')
  
  if (profilesError) {
    console.error('Error fetching profiles:', profilesError)
  } else {
    console.log(`\nProfiles: ${profiles?.length || 0}`)
    profiles?.forEach(profile => {
      console.log(`  - ${profile.email} (${profile.id})`)
    })
  }

  // Check patients
  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id, name, email, user_id')
  
  if (patientsError) {
    console.error('Error fetching patients:', patientsError)
  } else {
    console.log(`\nPatients: ${patients?.length || 0}`)
    patients?.forEach(patient => {
      console.log(`  - ${patient.name} (user_id: ${patient.user_id})`)
    })
  }

  // Check calls
  const { data: calls, error: callsError } = await supabase
    .from('calls')
    .select('id, caller_name, user_id')
    .limit(10)
  
  if (callsError) {
    console.error('Error fetching calls:', callsError)
  } else {
    console.log(`\nCalls: ${calls?.length || 0} (showing first 10)`)
    calls?.forEach(call => {
      console.log(`  - ${call.caller_name} (user_id: ${call.user_id})`)
    })
  }

  // Check callback tasks
  const { data: tasks, error: tasksError } = await supabase
    .from('callback_tasks')
    .select('id, patient_name, user_id')
  
  if (tasksError) {
    console.error('Error fetching callback tasks:', tasksError)
  } else {
    console.log(`\nCallback Tasks: ${tasks?.length || 0}`)
    tasks?.forEach(task => {
      console.log(`  - ${task.patient_name} (user_id: ${task.user_id})`)
    })
  }

  // Check sequences
  const { data: sequences, error: sequencesError } = await supabase
    .from('proactive_sequences')
    .select('id, name, user_id')
  
  if (sequencesError) {
    console.error('Error fetching sequences:', sequencesError)
  } else {
    console.log(`\nProactive Sequences: ${sequences?.length || 0}`)
    sequences?.forEach(seq => {
      console.log(`  - ${seq.name} (user_id: ${seq.user_id})`)
    })
  }

  console.log('\n--- Summary ---')
  console.log(`Total Users: ${users?.users?.length || 0}`)
  console.log(`Total Profiles: ${profiles?.length || 0}`)
  console.log(`Total Patients: ${patients?.length || 0}`)
  console.log(`Total Calls: ${calls?.length || 0}`)
  console.log(`Total Tasks: ${tasks?.length || 0}`)
  console.log(`Total Sequences: ${sequences?.length || 0}`)

  if ((patients?.length || 0) === 0 && (calls?.length || 0) === 0 && (tasks?.length || 0) === 0) {
    console.log('\n⚠️  Database appears to be empty!')
    console.log('You can:')
    console.log('1. Create data through the UI (add patients, create tasks, etc.)')
    console.log('2. Receive calls via webhook (they will be saved automatically)')
    console.log('3. Check that you are logged in with the correct user account')
  }
}

checkDatabase().catch(console.error)
