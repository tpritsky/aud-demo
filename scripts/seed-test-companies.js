/**
 * Seed test companies (clinics) with admins and workers.
 * Creates 5 businesses and assigns test users. Uses .env.local.
 *
 * Usage: node scripts/seed-test-companies.js
 *
 * All test users share password: TestPass123!
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

const TEST_PASSWORD = 'TestPass123!'

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

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const COMPANIES = [
  { name: 'Acme Hearing Center', vertical: 'audiology' },
  { name: 'Sound Solutions Audiology', vertical: 'audiology' },
  { name: 'City Ortho & Rehab', vertical: 'ortho' },
  { name: 'Downtown Law Group', vertical: 'law' },
  { name: 'General Practice Partners', vertical: 'general' },
]

const TEST_ADMINS = [
  { email: 'test-admin-1@aud-demo.test', full_name: 'Alice Admin' },
  { email: 'test-admin-2@aud-demo.test', full_name: 'Bob Manager' },
  { email: 'test-admin-3@aud-demo.test', full_name: 'Carol Owner' },
  { email: 'test-admin-4@aud-demo.test', full_name: 'Dave Director' },
  { email: 'test-admin-5@aud-demo.test', full_name: 'Eve Lead' },
]

const TEST_WORKERS = [
  { email: 'test-worker-1@aud-demo.test', full_name: 'Frank Staff' },
  { email: 'test-worker-2@aud-demo.test', full_name: 'Grace Helper' },
  { email: 'test-worker-3@aud-demo.test', full_name: 'Henry Agent' },
  { email: 'test-worker-4@aud-demo.test', full_name: 'Ivy Associate' },
  { email: 'test-worker-5@aud-demo.test', full_name: 'Jack Rep' },
  { email: 'test-worker-6@aud-demo.test', full_name: 'Kate Coordinator' },
  { email: 'test-worker-7@aud-demo.test', full_name: 'Leo Assistant' },
  { email: 'test-worker-8@aud-demo.test', full_name: 'Mia Specialist' },
  { email: 'test-worker-9@aud-demo.test', full_name: 'Noah Clerk' },
  { email: 'test-worker-10@aud-demo.test', full_name: 'Olivia Front Desk' },
]

async function ensureUser(email, full_name) {
  const { data: existing } = await supabase.auth.admin.listUsers()
  const found = existing?.users?.find((u) => u.email === email)
  if (found) {
    // Update only name/email — avoid upsert patterns that can leave role admin without clinic_id
    await supabase
      .from('profiles')
      .update({ email, full_name, updated_at: new Date().toISOString() })
      .eq('id', found.id)
    return found.id
  }
  const { data: created, error } = await supabase.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name },
  })
  if (error) {
    if (error.message?.includes('already') || error.message?.includes('registered')) {
      const { data: list } = await supabase.auth.admin.listUsers()
      const u = list?.users?.find((x) => x.email === email)
      if (u) return u.id
    }
    throw error
  }
  return created?.user?.id
}

async function main() {
  console.log('Seeding test companies...\n')

  // 1. Create 5 clinics
  const clinicIds = []
  for (const c of COMPANIES) {
    const { data: clinic, error } = await supabase
      .from('clinics')
      .insert({ name: c.name, vertical: c.vertical })
      .select('id, name')
      .single()
    if (error) {
      if (error.code === '23505') {
        const { data: existing } = await supabase.from('clinics').select('id').eq('name', c.name).single()
        if (existing) {
          clinicIds.push(existing.id)
          console.log('  Clinic already exists:', c.name)
          continue
        }
      }
      console.error('Failed to create clinic:', c.name, error.message)
      process.exit(1)
    }
    clinicIds.push(clinic.id)
    console.log('  Created clinic:', clinic.name)
  }

  if (clinicIds.length !== 5) {
    console.error('Expected 5 clinics, got', clinicIds.length)
    process.exit(1)
  }

  // 2. Create admin users and assign to clinics
  const adminIds = []
  for (let i = 0; i < TEST_ADMINS.length; i++) {
    const { email, full_name } = TEST_ADMINS[i]
    try {
      const id = await ensureUser(email, full_name)
      adminIds.push(id)
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          clinic_id: clinicIds[i],
          role: 'admin',
          full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (upErr) throw upErr
      console.log('  Admin:', email, '->', COMPANIES[i].name)
    } catch (e) {
      console.error('  Failed admin', email, e.message)
    }
  }

  // 3. Create worker users and assign to clinics (2 workers per clinic)
  for (let i = 0; i < TEST_WORKERS.length; i++) {
    const { email, full_name } = TEST_WORKERS[i]
    const clinicIndex = i % 5
    try {
      const id = await ensureUser(email, full_name)
      const { error: upErr } = await supabase
        .from('profiles')
        .update({
          clinic_id: clinicIds[clinicIndex],
          role: 'member',
          full_name,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
      if (upErr) throw upErr
      console.log('  Worker:', email, '->', COMPANIES[clinicIndex].name)
    } catch (e) {
      console.error('  Failed worker', email, e.message)
    }
  }

  console.log('\n--- Done ---')
  console.log('5 companies created with admins and workers.')
  console.log('Test login: any of the test-*-*@aud-demo.test emails, password:', TEST_PASSWORD)
  console.log('(Sign in at http://localhost:3000)')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
