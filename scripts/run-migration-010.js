/**
 * Run migration 010 (super_admin role) against Supabase.
 * Requires DATABASE_URL in .env.local (Supabase → Settings → Database → Connection string).
 * Usage: node scripts/run-migration-010.js
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(process.cwd(), '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local. Add DATABASE_URL for Supabase connection.')
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

const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '010_profiles_super_admin_role.sql')
const sql = fs.readFileSync(sqlPath, 'utf8')

async function run() {
  const client = new Client({ connectionString: databaseUrl })
  try {
    await client.connect()
    console.log('Running migration 010_profiles_super_admin_role.sql...')
    await client.query(sql)
    console.log('Migration 010 applied successfully.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
