/**
 * Apply one SQL file from supabase/migrations using .env.local.
 * Uses DIRECT_URL if set (Supabase “direct” / migrations), else DATABASE_URL.
 * (same idea as run-migration.js, but any migration file by basename).
 *
 * Usage:
 *   node scripts/apply-migration-by-name.js 011_calls_clinic_ai_postprocess.sql
 */

const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) {
    console.error('Missing .env.local. Add DATABASE_URL or DIRECT_URL (Supabase Connect → Prisma / Connection string).')
    process.exit(1)
  }
  const content = fs.readFileSync(envPath, 'utf8')
  for (const line of content.split('\n')) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim()
  }
}

const fileArg = process.argv[2]
if (!fileArg) {
  console.error('Usage: node scripts/apply-migration-by-name.js <migration-filename.sql>')
  process.exit(1)
}

const basename = path.basename(fileArg)
const sqlPath = path.join(__dirname, '..', 'supabase', 'migrations', basename)
if (!fs.existsSync(sqlPath)) {
  console.error('File not found:', sqlPath)
  process.exit(1)
}

loadEnvLocal()
const databaseUrl = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('Missing DIRECT_URL or DATABASE_URL in .env.local.')
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

async function run() {
  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } })
  try {
    await client.connect()
    console.log('Applying', basename, '...')
    await client.query(sql)
    console.log('Done.')
  } catch (err) {
    console.error('Migration failed:', err.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

run()
