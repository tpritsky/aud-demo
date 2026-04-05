/**
 * Resolve public Supabase URL/key without throwing during `next build` when env is unset
 * (e.g. Vercel preview missing vars). Real requests still need production env at runtime.
 *
 * Mirrors @supabase/supabase-js URL checks: must be non-empty and start with http:// or https://
 * (dashboard copy/paste sometimes includes quotes or a BOM).
 */
function normalizeSupabaseUrlInput(value: string | undefined): string {
  let s = (value ?? '').trim().replace(/^\uFEFF/, '')
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim()
  }
  return s
}

const BUILD_PLACEHOLDER_URL = 'https://build-placeholder.supabase.co'

export function getPublicSupabaseUrl(): string {
  const raw = normalizeSupabaseUrlInput(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!raw || !/^https?:\/\//i.test(raw)) {
    return BUILD_PLACEHOLDER_URL
  }
  try {
    const u = new URL(raw)
    if (u.protocol === 'http:' || u.protocol === 'https:') return raw
  } catch {
    /* invalid */
  }
  return BUILD_PLACEHOLDER_URL
}

/** Placeholder anon JWT shape so @supabase/supabase-js accepts it at init (build-only). */
const BUILD_PLACEHOLDER_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIn0.build-placeholder'

export function getPublicSupabaseAnonKey(): string {
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    ''
  return k || BUILD_PLACEHOLDER_ANON_KEY
}

export function hasRealSupabaseConfig(): boolean {
  const raw = normalizeSupabaseUrlInput(process.env.NEXT_PUBLIC_SUPABASE_URL)
  if (!raw || !/^https?:\/\//i.test(raw)) return false
  try {
    const u = new URL(raw)
    return (u.protocol === 'http:' || u.protocol === 'https:') && !raw.includes('build-placeholder')
  } catch {
    return false
  }
}
