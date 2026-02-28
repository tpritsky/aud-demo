/**
 * Run migration 005 (clinics + profiles.clinic_id) against Supabase.
 * Requires DATABASE_URL in .env.local (Supabase Dashboard → Settings → Database → Connection string).
 *
 * Usage: npm run db:migrate
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local. Add DATABASE_URL (Supabase → Settings → Database → Connection string).')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

loadEnvLocal()
const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Missing DATABASE_URL in .env.local. Get it from Supabase Dashboard → Settings → Database → Connection string (URI).')
  process.exit(1)
}

const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '005_clinics_and_profiles_clinic_id.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

async function run() {
  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    console.log('Running migration 005_clinics_and_profiles_clinic_id.sql...')
    await client.query(sql)
    console.log('Migration applied successfully.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
