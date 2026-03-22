/**
 * Create a normal clinic user (admin or member). Uses .env.local.
 *
 * Usage:
 *   node scripts/create-clinic-user.js email@example.com Password123
 *   node scripts/create-clinic-user.js email@example.com Password123 "Full Name"
 *   node scripts/create-clinic-user.js email@example.com Password123 "Full Name" member
 *
 * If no clinic exists, creates "Demo Clinic" and assigns the user to it as admin.
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  content.split('\n').forEach((line) => {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  })
}

loadEnvLocal()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const email = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] || 'Clinic User'
const role = (process.argv[5] === 'member' ? 'member' : 'admin')

if (!email || !password) {
  console.error('Usage: node scripts/create-clinic-user.js <email> <password> [fullName] [admin|member]')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creating clinic user...\n')

  let clinicId
  const { data: clinics } = await supabase.from('clinics').select('id, name').limit(1)
  if (clinics?.length) {
    clinicId = clinics[0].id
    console.log('Using existing clinic:', clinics[0].name)
  } else {
    const { data: clinic, error: clinicErr } = await supabase
      .from('clinics')
      .insert({ name: 'Demo Clinic', vertical: 'general' })
      .select('id, name')
      .single()
    if (clinicErr) {
      console.error('Failed to create Demo Clinic:', clinicErr.message)
      process.exit(1)
    }
    clinicId = clinic.id
    console.log('Created clinic:', clinic.name)
  }

  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)
  let userId

  if (found) {
    console.log('User already exists. Updating password and profile...')
    userId = found.id
    const { error: pwErr } = await supabase.auth.admin.updateUserById(userId, { password })
    if (pwErr) console.warn('Could not set password:', pwErr.message)
  } else {
    const { data: created, error: createErr } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    })
    if (createErr) {
      console.error('Create user error:', createErr.message)
      process.exit(1)
    }
    userId = created?.user?.id
    if (!userId) {
      console.error('No user id returned')
      process.exit(1)
    }
    console.log('User created.')
  }

  const { error: profileErr } = await supabase
    .from('profiles')
    .update({
      clinic_id: clinicId,
      role,
      full_name: fullName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId)

  if (profileErr) {
    const { error: insertErr } = await supabase.from('profiles').insert({
      id: userId,
      email,
      full_name: fullName,
      clinic_id: clinicId,
      role,
    })
    if (insertErr) {
      console.error('Failed to set profile:', insertErr.message)
      process.exit(1)
    }
  }
  console.log('Profile set: role =', role, ', clinic assigned.')

  console.log('\n--- Credentials ---')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('Role:', role)
  console.log('\nSign in at http://localhost:3000/get-started → Log into existing business')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
