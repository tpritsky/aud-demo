/**
 * Public (anon) key from env. Supabase docs sometimes use NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
 * this repo historically used NEXT_PUBLIC_SUPABASE_ANON_KEY — same value, either name works.
 */
export function supabasePublishableKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY?.trim() ||
    ''
  )
}
