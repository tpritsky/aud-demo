-- Add super_admin role: platform owner sees all businesses and their workers.
-- Admins = business owners (manage workers). Members = workers (limited perms).

ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('super_admin', 'admin', 'member'));

-- Super admins typically have no clinic_id (they are not tied to one business)
-- No change to RLS needed: service role is used for super-admin API; super_admin can be set manually in Supabase.
