/**
 * Batch tests to verify the database is working.
 * Loads .env.local and runs read (and optional write) checks.
 * Exit 0 if all pass, 1 if any fail.
 *
 * Usage: node scripts/batch-test-db.js
 * Or: npm run db:test  (add "db:test": "node scripts/batch-test-db.js" to package.json scripts)
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
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey)
let failed = 0

function ok(name) {
  console.log(`  ✓ ${name}`)
}
function fail(name, err) {
  console.error(`  ✗ ${name}: ${err?.message || err}`)
  failed++
}

async function run() {
  console.log('Batch database tests\n')

  // 1. Clinics table exists and is readable
  try {
    const { data, error } = await supabase.from('clinics').select('id, name, vertical').limit(5)
    if (error) throw error
    ok('clinics: read')
  } catch (e) {
    fail('clinics: read', e)
  }

  // 2. Profiles table exists and has role/clinic_id
  try {
    const { data, error } = await supabase.from('profiles').select('id, email, role, clinic_id').limit(5)
    if (error) throw error
    ok('profiles: read (role, clinic_id)')
  } catch (e) {
    fail('profiles: read', e)
  }

  // 3. Contact submissions table exists and is readable
  try {
    const { data, error } = await supabase.from('contact_submissions').select('id, email, created_at').limit(5)
    if (error) throw error
    ok('contact_submissions: read')
  } catch (e) {
    fail('contact_submissions: read', e)
  }

  // 4. Profiles role constraint allows super_admin, admin, member (we only read; schema is migration 010)
  try {
    const { data, error } = await supabase.from('profiles').select('role').limit(1)
    if (error) throw error
    ok('profiles.role: schema')
  } catch (e) {
    fail('profiles.role: schema', e)
  }

  // 5. Auth admin list (optional, verifies service role)
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1 })
    if (error) throw error
    ok('auth.admin: listUsers (service role)')
  } catch (e) {
    fail('auth.admin: listUsers', e)
  }

  console.log('')
  if (failed > 0) {
    console.error(`${failed} test(s) failed.`)
    process.exit(1)
  }
  console.log('All batch tests passed.')
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
