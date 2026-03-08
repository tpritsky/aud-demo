/**
 * One-time script: create a Supabase user and set their profile to super_admin.
 * Uses .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
 *
 * Usage:
 *   node scripts/create-super-admin.js
 *   node scripts/create-super-admin.js your@email.com YourPassword
 *
 * If no args: uses superadmin@aud-demo.test and a generated password (printed).
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

function randomPassword(length = 16) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let s = ''
  for (let i = 0; i < length; i++) s += chars[Math.floor(Math.random() * chars.length)]
  return s
}

loadEnvLocal()
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const email = process.argv[2] || 'superadmin@aud-demo.test'
const password = process.argv[3] || randomPassword(16)

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

async function main() {
  console.log('Creating super_admin account...\n')

  const { data: userData, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError) {
    if (createError.message && createError.message.includes('already been registered')) {
      console.log('User already exists. Updating profile to super_admin...')
      const { data: existing } = await supabase.auth.admin.listUsers()
      const existingUser = existing?.users?.find((u) => u.email === email)
      if (!existingUser) {
        console.error('Could not find existing user.')
        process.exit(1)
      }
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'super_admin' })
        .eq('id', existingUser.id)
      if (updateError) {
        console.error('Failed to set super_admin:', updateError.message)
        console.error('Make sure migration 010 is applied (profiles_role_check allows super_admin).')
        process.exit(1)
      }
      console.log('Profile updated to super_admin.')
      console.log('\n--- Credentials ---')
      console.log('Email:', email)
      console.log('Password:', password)
      console.log('\nSign in at http://localhost:3000 (or your app URL).')
      return
    }
    console.error('Create user error:', createError.message)
    process.exit(1)
  }

  const userId = userData?.user?.id
  if (!userId) {
    console.error('No user id returned')
    process.exit(1)
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ role: 'super_admin' })
    .eq('id', userId)

  if (updateError) {
    console.error('User created but failed to set super_admin:', updateError.message)
    console.error('Run migration 010_profiles_super_admin_role.sql in Supabase, then run:')
    console.error('  UPDATE profiles SET role = \'super_admin\' WHERE id = \'', userId, '\';')
    console.log('\n--- Credentials ---')
    console.log('Email:', email)
    console.log('Password:', password)
    process.exit(1)
  }

  console.log('Account created and set to super_admin.')
  console.log('\n--- Credentials ---')
  console.log('Email:', email)
  console.log('Password:', password)
  console.log('\nSign in at http://localhost:3000 (or your app URL).')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
