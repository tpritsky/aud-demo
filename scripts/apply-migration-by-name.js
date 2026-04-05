/**
 * Apply one SQL file from supabase/migrations using .env.local.
 * Uses DIRECT_URL if set, else DATABASE_URL.
 *
 * Supabase “direct” URLs (db.*.supabase.co:5432) are IPv6-only. If you see
 * EHOSTUNREACH, set DATABASE_URL to the Session pooler string from the dashboard
 * (Connect → Session pooler), or enable the IPv4 add-on, or paste the SQL in
 * the Supabase SQL Editor.
 *
 * Usage:
 *   node scripts/apply-migration-by-name.js 011_calls_clinic_ai_postprocess.sql
 */

const fs = require('fs')
const path = require('path')
const dns = require('dns').promises
const { Client } = require('pg')

/**
 * Supabase direct DB hosts are often IPv6-only. Node's default DNS can yield ENOTFOUND for `pg`;
 * resolve AAAA and connect by IP, preserving TLS SNI via `ssl.servername`.
 */
async function clientOptionsFromUrl(connectionString) {
  const normalized = connectionString.replace(/^postgresql:/i, 'http:')
  let u
  try {
    u = new URL(normalized)
  } catch {
    return { connectionString, ssl: { rejectUnauthorized: false } }
  }
  const hostname = u.hostname
  let resolved = hostname
  try {
    const v4 = await dns.resolve4(hostname)
    if (v4 && v4[0]) resolved = v4[0]
  } catch {
    try {
      const v6 = await dns.resolve6(hostname)
      if (v6 && v6[0]) resolved = v6[0]
    } catch {
      /* keep hostname */
    }
  }
  if (resolved === hostname) {
    return { connectionString, ssl: { rejectUnauthorized: false } }
  }
  const port = parseInt(u.port || '5432', 10)
  const user = decodeURIComponent(u.username)
  const password = decodeURIComponent(u.password)
  const database = (u.pathname || '/postgres').replace(/^\//, '') || 'postgres'
  return {
    host: resolved,
    port,
    user,
    password,
    database,
    ssl: { rejectUnauthorized: false, servername: hostname },
  }
}

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
  console.error('Missing DIRECT_URL or DATABASE_URL in .env.local (or pass DATABASE_URL in the environment).')
  process.exit(1)
}

const sql = fs.readFileSync(sqlPath, 'utf8')

async function run() {
  const opts = await clientOptionsFromUrl(databaseUrl)
  const client = new Client(opts)
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
