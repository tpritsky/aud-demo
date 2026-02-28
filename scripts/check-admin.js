/**
 * Check (and optionally fix) a user's profile role for Team tab visibility.
 * Run: node scripts/check-admin.js <email>
 * Example: node scripts/check-admin.js tpritsky@gmail.com
 *
 * Uses .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

try {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (fs.existsSync(envPath)) {
    fs.readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
      const m = line.match(/^([^=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
    })
  }
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const email = process.argv[2]
if (!email) {
  console.error('Usage: node scripts/check-admin.js <email>')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)

async function main() {
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  if (listError) {
    console.error('Failed to list users:', listError.message)
    process.exit(1)
  }
  const user = users.find((u) => u.email && u.email.toLowerCase() === email.toLowerCase())
  if (!user) {
    console.error(`No user found with email: ${email}`)
    process.exit(1)
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, clinic_id')
    .eq('id', user.id)
    .single()

  if (profileError && profileError.code !== 'PGRST116') {
    console.error('Failed to load profile:', profileError.message)
    process.exit(1)
  }

  console.log(`User: ${user.email} (id: ${user.id})\n`)
  if (!profile) {
    console.log('Profile: no row in profiles table.')
    console.log('Team tab will not show until this user has a profile with role = "admin".')
    console.log('\nTo fix: add a profile row (e.g. via Supabase SQL Editor):')
    console.log(`  INSERT INTO public.profiles (id, role, clinic_id)`)
    console.log(`  VALUES ('${user.id}', 'admin', NULL)`)
    console.log('  ON CONFLICT (id) DO UPDATE SET role = \'admin\';')
    console.log('\nIf you have a clinic, set clinic_id to that clinic\'s UUID.')
    return
  }

  const role = profile.role || null
  const clinicId = profile.clinic_id || null
  console.log(`Profile role: ${role ?? '(null)'}`)
  console.log(`Profile clinic_id: ${clinicId ?? '(null)'}`)
  console.log('')
  if (role === 'admin') {
    console.log('Confirmed: this user is an admin. Team tab should appear when logged in.')
    if (!clinicId) {
      console.log('Note: clinic_id is not set. Team list/invite will work after you set profiles.clinic_id to a clinic UUID.')
    }
    return
  }

  console.log('This user is NOT an admin. Team tab will not appear.')
  console.log('\nTo make them an admin, run in Supabase SQL Editor (Settings → API has your project):')
  console.log(`  UPDATE public.profiles SET role = 'admin' WHERE id = '${user.id}';`)
  if (!clinicId) {
    console.log('\nTo link to a clinic (required for Team list/invite), first get a clinic id from:')
    console.log('  SELECT id, name FROM public.clinics;')
    console.log(`  Then: UPDATE public.profiles SET clinic_id = '<clinic-uuid>' WHERE id = '${user.id}';`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
